/**
 * Teste Automatizado: Exclusão Recuperável e Segura de Fotografias de OS (Etapa 4)
 * 
 * Valida:
 * 1. Exclusão normal bem-sucedida (remove metadados da OS, arquivo e fila de pendências limpa)
 * 2. Bloqueio 403 Forbidden para usuários sem permissão (workOrdersDelete: false)
 * 3. Falha simulada no storage com gravação no banco (Outbox pattern)
 * 4. Integridade da OS preservada (foto removida da OS sem quebrar outros dados)
 * 5. Sanitização de logs de erro (zero vazamento de tokens, chaves ou credenciais)
 * 6. Reprocessamento / Retry bem-sucedido via /api/work-orders/photos/cleanup-pending
 * 7. Idempotência em retries adicionais
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

const SAMPLE_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runRecoverableDeletionTests() {
  console.log('================================================================');
  console.log(' TESTE: EXCLUSÃO RECUPERÁVEL E SEGURA DE FOTOS DE OS (ETAPA 4)');
  console.log('================================================================\n');

  // 1. Autenticar como Admin
  console.log('1. Autenticando com usuário administrador...');
  const adminLogin = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  if (adminLogin.status !== 200 || !adminLogin.json?.token) {
    throw new Error(`Falha no login do admin: ${adminLogin.body}`);
  }
  const adminToken = adminLogin.json.token;
  console.log('   ✓ Admin autenticado com sucesso.\n');

  // 2. Buscar OS para os testes
  console.log('2. Buscando OS de teste...');
  const osRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const testOS = (osRes.json || [])[0];
  if (!testOS) throw new Error('Nenhuma OS encontrada para testes.');
  console.log(`   ✓ OS selecionada: #${testOS.number} (ID: ${testOS.id})\n`);

  // 3. Criar ou autenticar usuário restrito (sem permissão de exclusão de OS)
  console.log('3. Configurando usuário restrito (workOrdersDelete: false)...');
  const restrictedUserPayload = {
    username: 'tecnico_sem_delete',
    password: 'password123',
    name: 'Técnico Sem Permissão Deletar',
    role: 'tecnico',
    permissions: {
      workOrders: true,
      workOrdersDelete: false
    }
  };

  await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, restrictedUserPayload);

  const restrictedLogin = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'tecnico_sem_delete', password: 'password123' });

  if (restrictedLogin.status !== 200 || !restrictedLogin.json?.token) {
    throw new Error(`Falha no login do usuário restrito: ${restrictedLogin.body}`);
  }
  const restrictedToken = restrictedLogin.json.token;
  console.log('   ✓ Usuário restrito autenticado com sucesso.\n');

  // 4. Teste de Exclusão Normal (Happy Path)
  console.log('4. Testando fluxo de exclusão normal bem-sucedida...');
  const uploadNormal = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    stage: 'entrada',
    fileName: 'foto_normal_delete.jpg',
    base64Data: SAMPLE_JPEG_BASE64,
    mimeType: 'image/jpeg'
  });

  if (uploadNormal.status !== 201 || !uploadNormal.json?.photo) {
    throw new Error(`Falha no upload para teste normal: ${uploadNormal.body}`);
  }
  const photoNormal = uploadNormal.json.photo;
  console.log(`   ✓ Foto criada para teste: ID=${photoNormal.id}`);

  const deleteNormal = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos/${photoNormal.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (deleteNormal.status !== 200 || !deleteNormal.json?.success) {
    throw new Error(`Falha na exclusão normal: ${deleteNormal.body}`);
  }
  console.log('   ✓ Resposta de exclusão normal: status 200 e success=true');

  // Verifica que não consta na fila de pendências
  const pendingCheckRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/pending-deletions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const normalInPending = (pendingCheckRes.json?.pendingDeletions || []).some(p => p.photoId === photoNormal.id);
  if (normalInPending) {
    throw new Error('Foto de teste normal não deveria constar na fila de pendências após exclusão bem-sucedida.');
  }
  console.log('   ✓ Confirmado: Fila de pendências limpa para foto excluída normalmente.\n');

  // 5. Teste de Permissão de Exclusão (403 Forbidden para usuário restrito)
  console.log('5. Testando bloqueio 403 Forbidden para usuário sem permissão...');
  const uploadForPermTest = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    stage: 'reparo',
    fileName: 'foto_perm_test.jpg',
    base64Data: SAMPLE_JPEG_BASE64,
    mimeType: 'image/jpeg'
  });

  const photoPerm = uploadForPermTest.json.photo;

  // Tentativa 1: DELETE na foto
  const unauthDeleteRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos/${photoPerm.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${restrictedToken}` }
  });

  if (unauthDeleteRes.status !== 403) {
    throw new Error(`FALHA DE SEGURANÇA: Usuário restrito recebeu status ${unauthDeleteRes.status} ao invés de 403.`);
  }
  console.log('   ✓ DELETE /photos/:photoId bloqueado corretamente com 403 Forbidden.');

  // Tentativa 2: GET na fila de pendências
  const unauthGetPendingRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/pending-deletions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${restrictedToken}` }
  });
  if (unauthGetPendingRes.status !== 403) {
    throw new Error(`FALHA DE SEGURANÇA: GET /pending-deletions recebeu status ${unauthGetPendingRes.status} ao invés de 403.`);
  }
  console.log('   ✓ GET /photos/pending-deletions bloqueado corretamente com 403 Forbidden.');

  // Tentativa 3: POST no cleanup de pendências
  const unauthCleanupRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/cleanup-pending',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${restrictedToken}` }
  });
  if (unauthCleanupRes.status !== 403) {
    throw new Error(`FALHA DE SEGURANÇA: POST /cleanup-pending recebeu status ${unauthCleanupRes.status} ao invés de 403.`);
  }
  console.log('   ✓ POST /photos/cleanup-pending bloqueado corretamente com 403 Forbidden.');

  // Confirma que a foto NÃO foi excluída da OS
  const checkPhotosRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const photoStillThere = (checkPhotosRes.json?.photos || []).some(p => p.id === photoPerm.id);
  if (!photoStillThere) {
    throw new Error('A foto foi indevidamente removida após tentativa não autorizada!');
  }
  console.log('   ✓ Foto permanece na OS íntegra e inalterada.\n');

  // 6. Teste de Falha Simulada de Storage e Gravação de Pendência Recuperável
  console.log('6. Testando falha simulada no storage e gravação de pendência...');
  
  // Ativa simulação de falha
  await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/test-simulation',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    enabled: true,
    message: 'Supabase Storage error 500: Internal server error with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret'
  });
  console.log('   ✓ Simulação de falha no storage ativada.');

  // Executa exclusão da foto
  const failedDeleteRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos/${photoPerm.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (failedDeleteRes.status !== 200 || !failedDeleteRes.json?.pendingStorageDeletion) {
    throw new Error(`Falha esperada com pendência não retornada: ${failedDeleteRes.body}`);
  }
  console.log('   ✓ Resposta recebida com pendingStorageDeletion=true e pendingId:', failedDeleteRes.json.pendingId);

  // 7. Verificação de integridade da OS (não corrompe a OS)
  console.log('7. Verificando integridade da OS após falha no storage...');
  const afterSimList = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const photoInOS = (afterSimList.json?.photos || []).some(p => p.id === photoPerm.id);
  if (photoInOS) {
    throw new Error('A foto ainda consta na listagem ativa da OS, apesar da desvinculação!');
  }
  console.log('   ✓ Confirmado: Foto desvinculada com sucesso de os.photos.');

  // 8. Verificação do registro da pendência e sanitização de credenciais
  console.log('8. Verificando rastreabilidade da pendência e sanitização de credenciais...');
  const pendingListRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/pending-deletions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const pendingItem = (pendingListRes.json?.pendingDeletions || []).find(p => p.photoId === photoPerm.id);
  if (!pendingItem) {
    throw new Error('O item de exclusão pendente NÃO foi registrado na fila!');
  }
  console.log(`   ✓ Item registrado na fila: ID=${pendingItem.id}, status=${pendingItem.status}, attempts=${pendingItem.attempts}`);

  if (pendingItem.lastError.includes('eyJhbGci') || pendingItem.lastError.includes('.secret')) {
    throw new Error(`VIOLAÇÃO DE SEGURANÇA: Token JWT não foi sanitizado! Erro: ${pendingItem.lastError}`);
  }
  if (!pendingItem.lastError.includes('[TOKEN_REDACTED]')) {
    throw new Error(`Sanitização incompleta: esperado [TOKEN_REDACTED]. Erro: ${pendingItem.lastError}`);
  }
  console.log(`   ✓ Mensagem de erro devidamente sanitizada: "${pendingItem.lastError}"`);
  console.log('   ✓ ZERO credenciais ou tokens vazados no log ou banco de dados.\n');

  // 9. Teste do Mecanismo de Retry / Limpeza
  console.log('9. Testando reprocessamento / retry das exclusões pendentes...');
  
  // Desativa simulação de falha
  await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/test-simulation',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { enabled: false });
  console.log('   ✓ Simulação de falha desativada.');

  // Executa endpoint de limpeza / retry
  const cleanupRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/cleanup-pending',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (cleanupRes.status !== 200 || !cleanupRes.json?.success) {
    throw new Error(`Falha no reprocessamento de pendências: ${cleanupRes.body}`);
  }
  const results = cleanupRes.json.results;
  console.log(`   ✓ Resultado do reprocessamento: processados=${results.processed}, sucedidos=${results.succeeded}, falhas=${results.failed}, restantes=${results.remaining}`);

  if (results.succeeded < 1) {
    throw new Error('Nenhuma exclusão foi concluída com sucesso no reprocessamento.');
  }

  // Verifica que a fila agora está limpa
  const checkEmptyPending = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/pending-deletions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if ((checkEmptyPending.json?.pendingDeletions || []).length !== 0) {
    throw new Error(`A fila de pendências ainda contém itens: ${JSON.stringify(checkEmptyPending.json)}`);
  }
  console.log('   ✓ Confirmado: Fila de pendências 100% limpa após retry.\n');

  // 10. Teste de Idempotência
  console.log('10. Testando idempotência do reprocessamento...');
  const secondCleanup = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders/photos/cleanup-pending',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (secondCleanup.status !== 200 || secondCleanup.json?.results?.remaining !== 0) {
    throw new Error('Falha no teste de idempotência da fila de pendências.');
  }
  console.log('   ✓ Reprocessamento com fila vazia executa de forma limpa e idempotente.\n');

  console.log('================================================================');
  console.log(' TODOS OS TESTES DE EXCLUSÃO RECUPERÁVEL PASSARAM COM SUCESSO! ');
  console.log('================================================================\n');
}

runRecoverableDeletionTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err.message);
  process.exit(1);
});
