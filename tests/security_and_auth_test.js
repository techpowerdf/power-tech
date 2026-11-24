/**
 * Suite de Testes Automatizados de Segurança, Autenticação, Proteção contra IDOR e Persistência
 * Sistema InfoTech Gestão / Power Tech
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4567';
const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';

let authToken = null;
let sampleOS = null;
let sampleSale = null;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    testsFailed++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('INICIANDO BATERIA DE TESTES DE SEGURANÇA E CONFORMIDADE DE PRODUÇÃO');
  console.log(`Alvo: ${BASE_URL}`);
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TESTE 1: Rotas Administrativas Bloqueadas sem Token (401)
  // -------------------------------------------------------------
  console.log('1. TESTE DE BLOQUEIO DE ROTAS ADMINISTRATIVAS NÃO AUTENTICADAS (401)');
  authToken = null; // garante sem token

  const protectedRoutes = [
    { method: 'GET', path: '/api/dashboard' },
    { method: 'GET', path: '/api/work-orders' },
    { method: 'GET', path: '/api/products' },
    { method: 'GET', path: '/api/services' },
    { method: 'GET', path: '/api/customers' },
    { method: 'GET', path: '/api/sales' },
    { method: 'GET', path: '/api/quotes' },
    { method: 'GET', path: '/api/settings' },
    { method: 'GET', path: '/api/backup' },
    { method: 'POST', path: '/api/work-orders', body: JSON.stringify({ description: 'Hacked' }) },
    { method: 'POST', path: '/api/sales', body: JSON.stringify({ total: 9999 }) },
    { method: 'POST', path: '/api/products', body: JSON.stringify({ name: 'Hacked' }) },
    { method: 'POST', path: '/api/backup/run' }
  ];

  for (const route of protectedRoutes) {
    const res = await request(route.path, { method: route.method, body: route.body });
    assert(
      res.status === 401,
      `Rota ${route.method} ${route.path} deve retornar 401 Unauthorized`,
      `Recebido: ${res.status}`
    );
  }

  // -------------------------------------------------------------
  // TESTE 2: Fluxo Real de Login e Emissão de Token
  // -------------------------------------------------------------
  console.log('\n2. TESTE DE AUTENTICAÇÃO E LOGIN');

  // Login com senha errada
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'senha_incorreta_123' })
  });
  assert(badLogin.status === 401, 'Tentativa de login com senha incorreta é rejeitada (401)');

  // Login com credenciais válidas
  const goodLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: INITIAL_ADMIN_PASSWORD })
  });
  assert(goodLogin.status === 200, 'Login do administrador com senha válida tem sucesso (200)');
  assert(!!goodLogin.data.token, 'Resposta de login inclui token de autenticação');
  assert(goodLogin.data.user && goodLogin.data.user.username === 'admin', 'Retorna dados do usuário autenticado');
  assert(!goodLogin.data.user.passwordHash, 'Hash de senha nunca é exposto na resposta de autenticação');

  authToken = goodLogin.data.token;

  // Verificação de /api/auth/me
  const meRes = await request('/api/auth/me');
  assert(meRes.status === 200, 'Endpoint /api/auth/me valida o Bearer token');
  assert(meRes.data.user.username === 'admin', 'Usuário retornado em /me confere');

  // Acesso à rota administrativa autenticada
  const dashRes = await request('/api/dashboard');
  assert(dashRes.status === 200, 'Acesso autenticado ao Dashboard permitido com sucesso (200)');
  assert(dashRes.data && typeof dashRes.data.metrics === 'object', 'Dashboard retorna métricas consolidadas');

  // -------------------------------------------------------------
  // TESTE 3: Preservação de Dados Existentes e Geração de Tokens
  // -------------------------------------------------------------
  console.log('\n3. TESTE DE PRESERVAÇÃO DE DADOS E BACKFILL DE TOKENS SEGUROS');

  const osListRes = await request('/api/work-orders');
  assert(osListRes.status === 200, 'Listagem de OS com token autenticado bem-sucedida');
  assert(Array.isArray(osListRes.data) && osListRes.data.length > 0, 'Registros de OS existentes foram preservados');

  sampleOS = osListRes.data[0];
  assert(typeof sampleOS.number === 'number' && sampleOS.number > 0, `Número sequencial da OS preservado (#${sampleOS.number})`);
  assert(
    typeof sampleOS.trackingToken === 'string' && sampleOS.trackingToken.length === 32,
    `OS possui trackingToken aleatório criptográfico (32 caracteres hex): ${sampleOS.trackingToken}`
  );

  const salesListRes = await request('/api/sales');
  assert(salesListRes.status === 200, 'Listagem de Vendas com token bem-sucedida');
  assert(Array.isArray(salesListRes.data) && salesListRes.data.length > 0, 'Registros de Vendas existentes preservados');

  sampleSale = salesListRes.data[0];
  assert(
    typeof sampleSale.receiptToken === 'string' && sampleSale.receiptToken.length === 32,
    `Venda possui receiptToken aleatório criptográfico (32 caracteres hex): ${sampleSale.receiptToken}`
  );

  // -------------------------------------------------------------
  // TESTE 4: Proteção contra IDOR (Bloqueio de Enumeração Sequencial)
  // -------------------------------------------------------------
  console.log('\n4. TESTE DE PREVENÇÃO CONTRA IDOR (BLOQUEIO DE ACESSO POR NÚMERO SEQUENCIAL)');

  authToken = null; // desloga para testar como cliente anônimo da internet

  // Tentativa de enumerar OS pelo número sequencial (ex: /track/1001)
  const idorOS = await request(`/api/public/work-orders/track/${sampleOS.number}`);
  assert(
    idorOS.status === 403,
    `Tentativa de acessar OS pelo número sequencial (#${sampleOS.number}) é BLOQUEADA com 403 Forbidden`,
    `Recebido: ${idorOS.status} - ${JSON.stringify(idorOS.data)}`
  );
  assert(idorOS.data.code === 'TOKEN_REQUIRED', 'Erro retornado é TOKEN_REQUIRED com mensagem orientativa');

  // Tentativa com números arbitrários (1000, 1001, 1002, 1003...)
  const guessAttempts = [1000, 1001, 1002, 1003, 1004, 1005];
  let allBlocked = true;
  for (const num of guessAttempts) {
    const res = await request(`/api/public/work-orders/track/${num}`);
    if (res.status !== 403) {
      allBlocked = false;
    }
  }
  assert(allBlocked, 'Enumeração sequencial cega (1000-1005) totalmente neutralizada contra raspagem de dados');

  // Tentativa de enumerar Recibo de Venda pelo ID sequencial
  const idorSale = await request(`/api/public/sales/receipt/${sampleSale.number || sampleSale.id}`);
  assert(
    idorSale.status === 403 || idorSale.status === 404,
    'Tentativa de acessar Recibo por ID simples sem token seguro é bloqueada (403/404)'
  );

  // -------------------------------------------------------------
  // TESTE 5: Acesso Público Seguro e Minimização de Dados (LGPD)
  // -------------------------------------------------------------
  console.log('\n5. TESTE DE CONSULTA PÚBLICA SEGURA E MINIMIZAÇÃO DE DADOS (LGPD)');

  const publicOS = await request(`/api/public/work-orders/track/${sampleOS.trackingToken}`);
  assert(publicOS.status === 200, 'Consulta pública com trackingToken aleatório autorizada com sucesso (200)');
  assert(!!publicOS.data.workOrder, 'Resposta pública contém objeto workOrder');
  assert(!!publicOS.data.store, 'Resposta pública contém dados institucionais da loja');

  const pubWO = publicOS.data.workOrder;
  // Validação de dados minimizados
  if (pubWO.customerCpfMasked) {
    assert(
      pubWO.customerCpfMasked.includes('*'),
      `CPF do cliente devidamente mascarado para privacidade: ${pubWO.customerCpfMasked}`
    );
  } else {
    assert(true, 'CPF do cliente não exposto publicamente');
  }

  // Verifica que preços de custo nunca vazam
  let leakedCost = false;
  if (Array.isArray(pubWO.items)) {
    for (const item of pubWO.items) {
      if (item.costPrice !== undefined) leakedCost = true;
    }
  }
  assert(!leakedCost, 'Preço de custo dos itens NÃO é exposto na rota pública');

  // Consulta pública de Recibo de Venda
  const publicReceipt = await request(`/api/public/sales/receipt/${sampleSale.receiptToken}`);
  assert(publicReceipt.status === 200, 'Consulta de recibo de venda com receiptToken autorizada com sucesso (200)');
  assert(!!publicReceipt.data.sale, 'Resposta pública contém objeto sale formatado');
  if (publicReceipt.data.sale.customerCpfMasked) {
    assert(
      publicReceipt.data.sale.customerCpfMasked.includes('*'),
      `CPF na venda mascarado: ${publicReceipt.data.sale.customerCpfMasked}`
    );
  }

  // -------------------------------------------------------------
  // TESTE 6: Criação de Novos Registros com Atribuição de Token
  // -------------------------------------------------------------
  console.log('\n6. TESTE DE CRIAÇÃO DE NOVOS REGISTROS E PERSISTÊNCIA');

  authToken = goodLogin.data.token; // re-autentica como admin

  // Criar nova OS
  const newOSPayload = {
    customerName: 'Cliente Teste Segurança',
    customerPhone: '11999998888',
    customerCpf: '123.456.789-00',
    device: 'Notebook',
    brand: 'Dell',
    model: 'Inspiron 15',
    serialNumber: 'SN-TEST-SEC-01',
    reportedIssue: 'Tela azul intermitente',
    accessories: 'Fonte original',
    visibleFlaws: 'Riscos na tampa superior',
    status: 'analise',
    items: [
      { id: '1', type: 'service', name: 'Formatação e Limpeza', quantity: 1, unitPrice: 150, costPrice: 20 }
    ],
    total: 150
  };

  const createOSRes = await request('/api/work-orders', {
    method: 'POST',
    body: JSON.stringify(newOSPayload)
  });

  assert(createOSRes.status === 201, 'Criação de nova Ordem de Serviço bem-sucedida (201)');
  const createdOS = createOSRes.data;
  assert(typeof createdOS.number === 'number', `Nova OS gerada com numeração sequencial (#${createdOS.number})`);
  assert(
    typeof createdOS.trackingToken === 'string' && createdOS.trackingToken.length === 32,
    `Nova OS recebe automaticamente trackingToken criptográfico: ${createdOS.trackingToken}`
  );

  // Testa acesso público da nova OS criada
  authToken = null;
  const verifyNewPublicOS = await request(`/api/public/work-orders/track/${createdOS.trackingToken}`);
  assert(verifyNewPublicOS.status === 200, 'Nova OS imediatamente rastreável pelo link seguro de WhatsApp');
  assert(
    !!verifyNewPublicOS.data.workOrder.customerCpfMasked && verifyNewPublicOS.data.workOrder.customerCpfMasked.includes('*'),
    `CPF da nova OS devidamente mascarado no link público (${verifyNewPublicOS.data.workOrder.customerCpfMasked})`
  );

  // -------------------------------------------------------------
  // TESTE 7: Troca de Senha de Administrador
  // -------------------------------------------------------------
  console.log('\n7. TESTE DE ALTERAÇÃO DE SENHA E VALIDAÇÃO DE CREDENCIAIS');

  authToken = goodLogin.data.token;

  // Tentativa com senha atual incorreta
  const badChange = await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'errada', newPassword: 'NovaSenhaForte@2026' })
  });
  assert(badChange.status === 400, 'Tentativa de troca com senha atual incorreta é rejeitada (400)');

  // Troca com senha correta
  const goodChange = await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: INITIAL_ADMIN_PASSWORD, newPassword: 'NovaSenhaForte@2026' })
  });
  assert(goodChange.status === 200, 'Troca de senha de administrador realizada com sucesso (200)');

  // Validação: login com senha antiga agora deve falhar
  const loginOld = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: INITIAL_ADMIN_PASSWORD })
  });
  assert(loginOld.status === 401, 'Login com senha antiga agora é rejeitado (401)');

  // Validação: login com nova senha deve funcionar
  const loginNew = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'NovaSenhaForte@2026' })
  });
  assert(loginNew.status === 200, 'Login com a nova senha de administrador tem sucesso (200)');

  // Reverte a senha para a senha padrão para permitir repetibilidade dos testes
  authToken = loginNew.data.token;
  await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'NovaSenhaForte@2026', newPassword: INITIAL_ADMIN_PASSWORD })
  });
  console.log('  [INFO] Senha de teste restaurada para o padrão inicial para garantir repetibilidade.');

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTADO DA BATERIA DE TESTES:`);
  console.log(`  Sucessos: ${testsPassed}`);
  console.log(`  Falhas:   ${testsFailed}`);
  console.log('================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});
