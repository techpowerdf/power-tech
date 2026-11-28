const http = require('http');
const fs = require('fs');
const path = require('path');
const dbModule = require('../server/db');
const { getDatabase, saveDatabase } = dbModule;
const { createToken, validateAdminPassword } = require('../server/authService');

const app = require('../server/index');

function makeRequest(server, method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const port = address.port;
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api' + urlPath,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf) });
        } catch {
          resolve({ status: res.statusCode, data: buf });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('SUÍTE DE TESTES: EXCLUSÃO DE OS COM IMUTABILIDADE E CONSISTÊNCIA');
  console.log('========================================================================\n');

  // Inicializa servidor de teste em porta efêmera dedicada
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  console.log(`[Test Server] Servidor de testes escutando na porta local ${port}`);

  const initialRealCount = (getDatabase().workOrders || []).length;
  console.log(`[Base Inicial] Total de OS reais carregadas: ${initialRealCount}`);

  // Token de admin válido
  const adminUser = getDatabase().users.find(u => u.role === 'admin' && u.active);
  const adminToken = createToken({
    id: adminUser.id,
    username: adminUser.username,
    role: adminUser.role,
    name: adminUser.name
  });

  // Token de operador sem permissão de exclusão de OS
  const operatorToken = createToken({
    id: 'usr-operador-sem-permissao',
    username: 'operador_no_delete',
    role: 'operador',
    name: 'Operador Sem Delete',
    permissions: {
      workOrders: true,
      workOrdersDelete: false
    }
  });

  const validAdminPassword = 'admin123';
  if (!validateAdminPassword(validAdminPassword)) {
    throw new Error('Falha ao validar senha do administrador');
  }

  const results = [];

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Senha administrativa incorreta
    // -------------------------------------------------------------------------
    console.log('--- TESTE 1: Senha administrativa incorreta ---');
    const osFicticia1 = {
      id: 'fictitious-os-uuid-1',
      number: 99901,
      customerName: 'Cliente Fictício 1',
      status: 'aberta'
    };
    getDatabase().workOrders.push(osFicticia1);

    const res1 = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticia1.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': 'senha_totalmente_incorreta'
    });
    console.log(`Status retornado: ${res1.status} | Resposta:`, res1.data);
    const osAindaExiste1 = getDatabase().workOrders.some(o => o.id === osFicticia1.id);
    const pass1 = res1.status === 403 &&
      res1.data.code === 'ADMIN_PASSWORD_REQUIRED' &&
      osAindaExiste1;
    results.push({ name: '1. Senha administrativa incorreta bloqueada (HTTP 403)', pass: pass1 });
    console.log(`Resultado: ${pass1 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 2: Usuário sem permissão (workOrdersDelete: false)
    // -------------------------------------------------------------------------
    console.log('--- TESTE 2: Usuário sem permissão de exclusão ---');
    const res2 = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticia1.id}`, {
      Authorization: `Bearer ${operatorToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res2.status} | Resposta:`, res2.data);
    const osAindaExiste2 = getDatabase().workOrders.some(o => o.id === osFicticia1.id);
    const pass2 = res2.status === 403 &&
      res2.data.error.includes('não possui permissão para excluir') &&
      osAindaExiste2;
    results.push({ name: '2. Usuário sem permissão bloqueado (HTTP 403)', pass: pass2 });
    console.log(`Resultado: ${pass2 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 3: Identificador vazio ou apenas espaços
    // -------------------------------------------------------------------------
    console.log('--- TESTE 3: Identificador vazio ou apenas espaços ---');
    const res3 = await makeRequest(testServer, 'DELETE', '/work-orders/%20%20', {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res3.status} | Resposta:`, res3.data);
    const pass3 = res3.status === 400 && res3.data.error.includes('não informado');
    results.push({ name: '3. Identificador vazio rejeitado (HTTP 400)', pass: pass3 });
    console.log(`Resultado: ${pass3 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 4: Identificador inexistente
    // -------------------------------------------------------------------------
    console.log('--- TESTE 4: Identificador inexistente ---');
    const res4 = await makeRequest(testServer, 'DELETE', '/work-orders/os-totalmente-inexistente-99999', {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res4.status} | Resposta:`, res4.data);
    const pass4 = res4.status === 404 && res4.data.error.includes('não encontrada');
    results.push({ name: '4. Identificador inexistente retorna HTTP 404', pass: pass4 });
    console.log(`Resultado: ${pass4 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 5: Exclusão por UUID / ID interno exato
    // -------------------------------------------------------------------------
    console.log('--- TESTE 5: Exclusão por UUID / ID interno exato ---');
    const countAntes5 = getDatabase().workOrders.length;
    const res5 = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticia1.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res5.status} | Resposta:`, res5.data);
    const countDepois5 = getDatabase().workOrders.length;
    const osExcluida5 = !getDatabase().workOrders.some(o => o.id === osFicticia1.id);
    const pass5 = res5.status === 200 &&
      res5.data.success === true &&
      res5.data.deletedWorkOrder &&
      res5.data.deletedWorkOrder.id === osFicticia1.id &&
      res5.data.deletedWorkOrder.number === osFicticia1.number &&
      osExcluida5 &&
      countDepois5 === countAntes5 - 1;
    results.push({ name: '5. Exclusão por UUID com resposta inequívoca (HTTP 200)', pass: pass5 });
    console.log(`Resultado: ${pass5 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 6: Exclusão por número sequencial
    // -------------------------------------------------------------------------
    console.log('--- TESTE 6: Exclusão por número sequencial ---');
    const osFicticia2 = {
      id: 'fictitious-os-uuid-2',
      number: 99902,
      customerName: 'Cliente Fictício 2',
      status: 'aberta'
    };
    getDatabase().workOrders.push(osFicticia2);

    const countAntes6 = getDatabase().workOrders.length;
    const res6 = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticia2.number}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res6.status} | Resposta:`, res6.data);
    const countDepois6 = getDatabase().workOrders.length;
    const osExcluida6 = !getDatabase().workOrders.some(o => o.id === osFicticia2.id);
    const pass6 = res6.status === 200 &&
      res6.data.success === true &&
      res6.data.deletedWorkOrder &&
      res6.data.deletedWorkOrder.id === osFicticia2.id &&
      res6.data.deletedWorkOrder.number === osFicticia2.number &&
      osExcluida6 &&
      countDepois6 === countAntes6 - 1;
    results.push({ name: '6. Exclusão por número sequencial (HTTP 200)', pass: pass6 });
    console.log(`Resultado: ${pass6 ? 'APROVADO' : 'FALHOU'}\n`);

    // -------------------------------------------------------------------------
    // TESTE 7: Dois registros fictícios com o mesmo número (Ambiguidade)
    // -------------------------------------------------------------------------
    console.log('--- TESTE 7: Dois registros fictícios com o mesmo número (Ambiguidade) ---');
    const osDupA = {
      id: 'fictitious-dup-uuid-a',
      number: 99903,
      customerName: 'Cliente Duplicado A',
      status: 'aberta'
    };
    const osDupB = {
      id: 'fictitious-dup-uuid-b',
      number: 99903,
      customerName: 'Cliente Duplicado B',
      status: 'aberta'
    };
    getDatabase().workOrders.push(osDupA, osDupB);

    const countAntes7 = getDatabase().workOrders.length;
    // Tenta excluir pelo número duplicado 99903
    const res7 = await makeRequest(testServer, 'DELETE', '/work-orders/99903', {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res7.status} | Resposta:`, res7.data);
    const countDepois7 = getDatabase().workOrders.length;
    const ambosPermanecem7 = getDatabase().workOrders.some(o => o.id === osDupA.id) && getDatabase().workOrders.some(o => o.id === osDupB.id);

    const pass7 = res7.status === 409 &&
      res7.data.code === 'AMBIGUOUS_IDENTIFIER' &&
      countDepois7 === countAntes7 &&
      ambosPermanecem7;
    results.push({ name: '7. Bloqueio com HTTP 409 em caso de registros duplicados', pass: pass7 });
    console.log(`Resultado: ${pass7 ? 'APROVADO' : 'FALHOU'}`);

    // Limpeza segura dos duplicados por ID único
    await makeRequest(testServer, 'DELETE', `/work-orders/${osDupA.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    await makeRequest(testServer, 'DELETE', `/work-orders/${osDupB.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log('[Cleanup] Registros duplicados excluídos individualmente por ID.\n');

    // -------------------------------------------------------------------------
    // TESTE 8: Colisão entre ID de uma OS e número de outra OS
    // -------------------------------------------------------------------------
    console.log('--- TESTE 8: Colisão entre ID de uma OS e número de outra OS ---');
    // OS X tem ID="99904" e Number=99905
    const osCollisionX = {
      id: '99904',
      number: 99905,
      customerName: 'OS X (ID é 99904)',
      status: 'aberta'
    };
    // OS Y tem ID="fictitious-os-y" e Number=99904
    const osCollisionY = {
      id: 'fictitious-os-y',
      number: 99904,
      customerName: 'OS Y (Número é 99904)',
      status: 'aberta'
    };
    getDatabase().workOrders.push(osCollisionX, osCollisionY);

    const countAntes8 = getDatabase().workOrders.length;
    // Excluir passando '99904'. O algoritmo DEVE priorizar o ID exato (OS X) e PRESERVAR a OS Y!
    const res8 = await makeRequest(testServer, 'DELETE', '/work-orders/99904', {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log(`Status retornado: ${res8.status} | Resposta:`, res8.data);
    const countDepois8 = getDatabase().workOrders.length;
    const osXRemovida = !getDatabase().workOrders.some(o => o.id === osCollisionX.id);
    const osYPreservada = getDatabase().workOrders.some(o => o.id === osCollisionY.id);

    const pass8 = res8.status === 200 &&
      res8.data.deletedWorkOrder &&
      res8.data.deletedWorkOrder.id === osCollisionX.id &&
      res8.data.deletedWorkOrder.number === osCollisionX.number &&
      osXRemovida &&
      osYPreservada &&
      countDepois8 === countAntes8 - 1;
    results.push({ name: '8. Prioridade estrita do ID em caso de colisão ID vs Número (HTTP 200)', pass: pass8 });
    console.log(`Resultado: ${pass8 ? 'APROVADO' : 'FALHOU'}`);

    // Limpeza segura da OS Y
    await makeRequest(testServer, 'DELETE', `/work-orders/${osCollisionY.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    console.log('[Cleanup] Registro colidente Y removido por ID.\n');

    // -------------------------------------------------------------------------
    // TESTE 9: Simulação de Falha de Persistência no saveDatabase() (Abordagem B)
    // -------------------------------------------------------------------------
    console.log('--- TESTE 9: Simulação de Falha de Persistência no saveDatabase() ---');
    const osFicticiaFail = {
      id: 'fictitious-os-fail-sim',
      number: 99908,
      customerName: 'Cliente Simulação Falha Persistência',
      status: 'aberta'
    };
    getDatabase().workOrders.push(osFicticiaFail);
    await saveDatabase(getDatabase()); // Salva normalmente para existir em memória e persistência

    const countAntesFail = getDatabase().workOrders.length;
    console.log(`[Antes da falha] Quantidade de OS: ${countAntesFail}`);

    // Ativa simulação de falha no Supabase forçando saveDatabase a rejeitar
    const origSaveDatabase = dbModule.saveDatabase;
    dbModule.saveDatabase = async () => {
      throw new Error('Falha simulada de persistência no Supabase (Transaction Pooler Connection Error)');
    };

    console.log('[Simulação Ativada] saveDatabase() forçado a falhar na persistência do Supabase.');

    const resFail = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticiaFail.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });

    // Desativa a simulação restaurando a função saveDatabase original
    dbModule.saveDatabase = origSaveDatabase;
    console.log('[Simulação Desativada] Função original do saveDatabase restaurada.');

    console.log(`Status retornado: ${resFail.status} | Resposta:`, resFail.data);

    // Verificações obrigatórias de consistência solicitadas pelo usuário:
    // 1. A requisição retorna HTTP 500 com mensagem apropriada
    const check1_retornaErro = resFail.status === 500 &&
      resFail.data &&
      resFail.data.error === 'Falha ao salvar as alterações no banco de dados. A Ordem de Serviço foi mantida íntegra.';

    // 2. A OS permanece na memória (inMemoryDb)
    const currentMemDb = getDatabase();
    const check2_permaneceMemoria = currentMemDb.workOrders.some(o => o.id === osFicticiaFail.id);

    // 3. A OS permanece no banco persistido (disco)
    const diskDb = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/database.json'), 'utf8'));
    const check3_permaneceDisco = diskDb.workOrders.some(o => o.id === osFicticiaFail.id);

    // 4. A quantidade de registros não muda
    const countDepoisFail = currentMemDb.workOrders.length;
    const check4_quantidadeNaoMuda = countAntesFail === countDepoisFail;

    // 5. Uma nova consulta (GET /work-orders) continua encontrando a OS
    const resGetAfterFail = await makeRequest(testServer, 'GET', '/work-orders', {
      Authorization: `Bearer ${adminToken}`
    });
    const check5_consultaEncontra = Array.isArray(resGetAfterFail.data) && resGetAfterFail.data.some(o => o.id === osFicticiaFail.id);

    // 6. Confirmação de recuperação da fila: executa nova gravação/exclusão após a falha
    const resCleanupFail = await makeRequest(testServer, 'DELETE', `/work-orders/${osFicticiaFail.id}`, {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': validAdminPassword
    });
    const check6_filaRecuperada = resCleanupFail.status === 200 &&
      !getDatabase().workOrders.some(o => o.id === osFicticiaFail.id);
    console.log(`[Cleanup & Fila] Nova exclusão após falha executada com sucesso: status = ${resCleanupFail.status}`);

    console.log('Resultados da verificação de rollback/imutabilidade e recuperação da fila:');
    console.log(`  - 1. Requisição retorna HTTP 500 com mensagem segura: ${check1_retornaErro ? 'OK' : 'FALHA'}`);
    console.log(`  - 2. OS permanece intacta na memória (inMemoryDb):     ${check2_permaneceMemoria ? 'OK' : 'FALHA'}`);
    console.log(`  - 3. OS permanece intacta no banco persistido (disco): ${check3_permaneceDisco ? 'OK' : 'FALHA'}`);
    console.log(`  - 4. Quantidade de registros não mudou (delta = 0):   ${check4_quantidadeNaoMuda ? 'OK' : 'FALHA'}`);
    console.log(`  - 5. Nova consulta (GET) continua encontrando a OS:    ${check5_consultaEncontra ? 'OK' : 'FALHA'}`);
    console.log(`  - 6. Fila permite novas gravações após a falha:        ${check6_filaRecuperada ? 'OK' : 'FALHA'}`);

    const pass9 = check1_retornaErro &&
      check2_permaneceMemoria &&
      check3_permaneceDisco &&
      check4_quantidadeNaoMuda &&
      check5_consultaEncontra &&
      check6_filaRecuperada;
    results.push({ name: '9. Falha de persistência no saveDatabase mantém 100% íntegro e recupera fila (Abordagem B)', pass: pass9 });
    console.log(`Resultado: ${pass9 ? 'APROVADO' : 'FALHOU'}\n`);

  } finally {
    // Limpeza final de qualquer registro fictício residual
    const memDb = getDatabase();
    memDb.workOrders = (memDb.workOrders || []).filter(o => !String(o.id).startsWith('fictitious-') && String(o.id) !== '99904');
    await saveDatabase(memDb);
    testServer.close();
  }

  // -------------------------------------------------------------------------
  // VERIFICAÇÃO FINAL DE INTEGRIDADE DOS DADOS REAIS
  // -------------------------------------------------------------------------
  const finalDb = getDatabase();
  const finalRealCount = (finalDb.workOrders || []).length;
  console.log('========================================================================');
  console.log('RELATÓRIO DE INTEGRIDADE DOS DADOS:');
  console.log('========================================================================');
  console.log(`OS reais no início: ${initialRealCount}`);
  console.log(`OS reais ao final:  ${finalRealCount}`);
  const integridadeOk = initialRealCount === finalRealCount;
  console.log(`Integridade das Ordens de Serviço: ${integridadeOk ? 'SIM (100% INTACTAS)' : 'FALHA'}\n`);

  let allPassed = true;
  results.forEach(r => {
    console.log(`- ${r.name}: ${r.pass ? 'APROVADO' : 'FALHOU'}`);
    if (!r.pass) allPassed = false;
  });

  console.log(`\nStatus Geral: ${allPassed ? 'TODOS OS TESTES APROVADOS COM SUCESSO' : 'HOUVE FALHAS'}`);
  process.exit(allPassed && integridadeOk ? 0 : 1);
}

run().catch(err => {
  console.error('Erro fatal durante a suíte de testes:', err);
  process.exit(1);
});
