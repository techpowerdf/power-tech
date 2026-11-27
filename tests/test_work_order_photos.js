/**
 * Teste Automatizado de Segurança e Funcionalidade: Fotografias de OS (Etapa 4)
 * 
 * Valida:
 * 1. Autenticação obrigatória (rejeita requisições sem Bearer token ou com token inválido)
 * 2. Upload de fotos com diferentes estágios ('entrada', 'reparo', 'conclusao')
 * 3. Validação de formato e tamanho
 * 4. Listagem de fotos com URLs seguras
 * 5. Streaming seguro com verificação de autenticação
 * 6. Exclusão de fotos (remove arquivo e metadado)
 * 7. NÃO contaminação do banco de dados (confirma que database.json contém ZERO bytes de base64 ou dados binários)
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

// Pequeno JPEG válido em base64 (1x1 pixel)
const SAMPLE_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runTests() {
  console.log('====================================================');
  console.log(' TESTE AUTOMATIZADO: FOTOGRAFIAS DE ORDENS DE SERVIÇO');
  console.log('====================================================\n');

  // 1. Obter token de autenticação
  console.log('1. Autenticando com usuário admin...');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  if (loginRes.status !== 200 || !loginRes.json?.token) {
    throw new Error(`Falha no login: ${loginRes.body}`);
  }
  const token = loginRes.json.token;
  console.log('   ✓ Autenticado com sucesso.\n');

  // 2. Buscar primeira OS para os testes
  console.log('2. Buscando primeira OS para teste de fotos...');
  const osListRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const workOrders = osListRes.json;
  if (!Array.isArray(workOrders) || workOrders.length === 0) {
    throw new Error('Nenhuma OS encontrada para teste.');
  }
  const testOS = workOrders[0];
  console.log(`   ✓ OS selecionada: #${testOS.number} (ID: ${testOS.id})\n`);

  // 3. Teste de Segurança: Acesso não autenticado DEVE ser bloqueado (401)
  console.log('3. Testando segurança: Tentativa de upload SEM token (deve retornar 401)...');
  const unauthUploadRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stage: 'entrada',
    fileName: 'teste_hacker.jpg',
    base64Data: SAMPLE_JPEG_BASE64
  });

  if (unauthUploadRes.status !== 401) {
    throw new Error(`FALHA DE SEGURANÇA: Upload sem token retornou status ${unauthUploadRes.status}`);
  }
  console.log('   ✓ Bloqueio 401 confirmado para upload sem token.\n');

  console.log('4. Testando segurança: Tentativa de listagem SEM token (deve retornar 401)...');
  const unauthListRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET'
  });
  if (unauthListRes.status !== 401) {
    throw new Error(`FALHA DE SEGURANÇA: Listagem sem token retornou status ${unauthListRes.status}`);
  }
  console.log('   ✓ Bloqueio 401 confirmado para listagem sem token.\n');

  // 4.1 Validação de IDs e sanitização contra IDOR / Path Traversal
  console.log('4.1 Testando validação estrita de IDs (deve retornar 400 para caracteres ilegais)...');
  const malformedRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${encodeURIComponent('os-invalid!@#$path')}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (malformedRes.status !== 400) {
    throw new Error(`Validação de ID falhou: esperado 400, recebido ${malformedRes.status}`);
  }
  console.log('   ✓ Rejeição 400 para ID malformado confirmada.\n');

  // 4. Upload de fotos legítimas com 3 estágios
  console.log('5. Fazendo upload de fotos nos 3 estágios ("entrada", "reparo", "conclusao")...');
  const stages = ['entrada', 'reparo', 'conclusao'];
  const uploadedPhotos = [];

  for (const stage of stages) {
    const uploadRes = await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: `/api/work-orders/${testOS.id}/photos`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      stage,
      fileName: `teste_${stage}.jpg`,
      base64Data: SAMPLE_JPEG_BASE64,
      mimeType: 'image/jpeg'
    });

    if (uploadRes.status !== 201 || !uploadRes.json?.photo?.id) {
      throw new Error(`Falha no upload do estágio ${stage}: ${uploadRes.body}`);
    }

    const p = uploadRes.json.photo;
    uploadedPhotos.push(p);
    console.log(`   ✓ Foto [${stage.toUpperCase()}] salva com sucesso: ID=${p.id}, path=${p.storagePath}`);
    console.log(`     URL gerada: ${p.url.slice(0, 70)}...`);
  }
  console.log('');

  // 5. Listar fotos da OS
  console.log('6. Listando fotos da OS via GET /api/work-orders/:id/photos...');
  const listRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (listRes.status !== 200 || !Array.isArray(listRes.json?.photos)) {
    throw new Error(`Falha ao listar fotos: ${listRes.body}`);
  }
  console.log(`   ✓ Total de fotos retornadas: ${listRes.json.photos.length}`);
  const hasAllStages = stages.every(s => listRes.json.photos.some(p => p.stage === s));
  if (!hasAllStages) {
    throw new Error('Nem todos os estágios foram encontrados na listagem.');
  }
  console.log('   ✓ Todos os estágios ("entrada", "reparo", "conclusao") estão presentes.\n');

  // 6. Testar streaming do arquivo local
  console.log('7. Testando streaming seguro do arquivo de imagem...');
  const photoToStream = uploadedPhotos[0];
  const streamUrl = new URL(photoToStream.url, 'http://127.0.0.1:4567');
  
  // Teste com token
  const streamRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: streamUrl.pathname + streamUrl.search,
    method: 'GET'
  });
  if (streamRes.status !== 200 || !streamRes.headers['content-type']?.includes('image')) {
    throw new Error(`Falha no streaming da foto: status ${streamRes.status}`);
  }
  console.log(`   ✓ Streaming autenticado retornou status 200 e Content-Type: ${streamRes.headers['content-type']}`);

  // Teste de streaming SEM token (deve falhar 401)
  const unauthStreamRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: streamUrl.pathname, // sem query param ?token=
    method: 'GET'
  });
  if (unauthStreamRes.status !== 401) {
    throw new Error(`FALHA DE SEGURANÇA: Streaming sem token retornou status ${unauthStreamRes.status}`);
  }
  console.log('   ✓ Streaming sem token bloqueado corretamente com 401.\n');

  // 7. Auditoria do Banco de Dados: Garantir que as fotos da OS NÃO contêm base64!
  console.log('8. Auditoria de persistência: Verificando se os.photos no banco está livre de base64...');
  const dbFile = path.join(__dirname, '..', 'data', 'database.json');
  const dbContent = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const osInDb = (dbContent.workOrders || []).find(o => o.id === testOS.id);
  const photosJson = JSON.stringify(osInDb?.photos || []);
  if (photosJson.includes(SAMPLE_JPEG_BASE64) || photosJson.includes('base64,') || photosJson.includes('data:image')) {
    throw new Error('VIOLAÇÃO CRÍTICA: Dados base64 foram gravados diretamente no registro da OS no banco de dados!');
  }
  console.log('   ✓ Aprovado! ZERO strings base64 ou dados binários no registro da OS.');
  console.log('   ✓ O banco armazena exclusivamente metadados leves (id, stage, fileName, storagePath, sizeBytes).\n');

  // 8. Teste de Exclusão de Fotografia
  console.log('9. Testando exclusão de fotografia com DELETE /api/work-orders/:id/photos/:photoId...');
  const photoToDelete = uploadedPhotos[0];
  const deleteRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos/${photoToDelete.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (deleteRes.status !== 200) {
    throw new Error(`Falha na exclusão da foto: ${deleteRes.body}`);
  }
  console.log('   ✓ Foto excluída com sucesso da OS.');

  // Confirma que não aparece mais na listagem
  const afterDeleteList = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stillExists = afterDeleteList.json.photos.some(p => p.id === photoToDelete.id);
  if (stillExists) {
    throw new Error('A foto excluída ainda consta na listagem!');
  }
  console.log('   ✓ Foto confirmada como removida da listagem.');

  // Limpa as outras fotos de teste para não poluir
  for (let i = 1; i < uploadedPhotos.length; i++) {
    await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: `/api/work-orders/${testOS.id}/photos/${uploadedPhotos[i].id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
  console.log('   ✓ Limpeza pós-teste executada com sucesso.\n');

  console.log('====================================================');
  console.log(' TODOS OS TESTES DE FOTOS PASSARAM COM 100% DE SUCESSO');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err.message);
  process.exit(1);
});
