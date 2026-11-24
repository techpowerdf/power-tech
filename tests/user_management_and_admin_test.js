const http = require('http');

const BASE_URL = 'http://127.0.0.1:4567';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passes = 0;
let fails = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passes++;
  } else {
    console.error(`  [FAIL] ${message}`);
    fails++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('BATERIA DE TESTES: PERFIL DO ADMIN, USUÁRIOS & PERMISSÕES');
  console.log('================================================================\n');

  // 1. Login inicial do Admin
  console.log('1. AUTENTICAÇÃO DO ADMINISTRADOR');
  const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: process.env.INITIAL_ADMIN_PASSWORD || 'admin123'
  });
  assert(adminLoginRes.status === 200, 'Login do admin inicial tem sucesso');
  const adminToken = adminLoginRes.data.token;
  const adminAuthHeader = { Authorization: `Bearer ${adminToken}` };
  assert(Boolean(adminToken), 'Token do admin gerado');
  assert(adminLoginRes.data.user.role === 'admin', 'Usuário possui papel "admin"');
  assert(adminLoginRes.data.user.permissions.workOrdersDelete === true, 'Admin possui permissão de exclusão de OS');

  // 2. Edição de Credenciais do Próprio Administrador (/api/auth/profile)
  console.log('\n2. EDIÇÃO DE PERFIL / CREDENCIAIS DO ADMINISTRADOR');
  // Tentativa de alterar sem senha atual
  const updateNoPass = await makeRequest(
    'POST',
    '/api/auth/profile',
    { name: 'Admin Master', username: 'admin_novo', currentPassword: '' },
    adminAuthHeader
  );
  assert(updateNoPass.status === 400, 'Tentativa de alterar username sem senha atual é bloqueada (400)');

  // Atualização com senha atual correta
  const updateOk = await makeRequest(
    'POST',
    '/api/auth/profile',
    {
      name: 'Super Administrador',
      username: 'admin',
      currentPassword: process.env.INITIAL_ADMIN_PASSWORD || 'admin123'
    },
    adminAuthHeader
  );
  assert(updateOk.status === 200, 'Atualização de nome do administrador bem-sucedida (200)');
  assert(updateOk.data.user.name === 'Super Administrador', 'Nome do admin atualizado');

  // 3. Gestão de Usuários (Admin)
  console.log('\n3. GESTÃO DE USUÁRIOS E PERMISSÕES (ADMIN)');
  const listUsersRes = await makeRequest('GET', '/api/users', null, adminAuthHeader);
  assert(listUsersRes.status === 200, 'Admin pode listar usuários cadastrados (/api/users)');
  assert(Array.isArray(listUsersRes.data.users), 'Retorna lista de usuários');
  assert(listUsersRes.data.users.some((u) => u.username === 'admin'), 'Admin presente na lista');

  // Criação de operador com permissões restritas (apenas PDV e Clientes, sem exclusão de OS e sem Settings)
  const testOpUsername = `op_teste_${Date.now()}`;
  const createOpRes = await makeRequest(
    'POST',
    '/api/users',
    {
      name: 'Operador Teste Balcão',
      username: testOpUsername,
      password: 'senhaSegura123',
      role: 'operador',
      permissions: {
        dashboard: true,
        workOrders: true,
        workOrdersDelete: false,
        pos: true,
        quotes: false,
        inventory: false,
        services: false,
        customers: true,
        fiscal: false,
        backup: false,
        settings: false
      },
      active: true
    },
    adminAuthHeader
  );
  assert(createOpRes.status === 201, 'Admin cria novo operador com sucesso (201)');
  const createdOp = createOpRes.data.user;
  assert(createdOp.username === testOpUsername, 'Operador criado com username correto');
  assert(createdOp.permissions.workOrdersDelete === false, 'Operador com workOrdersDelete = false');
  assert(createdOp.permissions.pos === true, 'Operador com pos = true');

  // 4. Teste de Acesso e Restrições do Operador
  console.log('\n4. VALIDAÇÃO DE RESTRIÇÕES DE ACESSO DO OPERADOR');
  const opLoginRes = await makeRequest('POST', '/api/auth/login', {
    username: testOpUsername,
    password: 'senhaSegura123'
  });
  assert(opLoginRes.status === 200, 'Operador faz login com sucesso (200)');
  const opToken = opLoginRes.data.token;
  const opAuthHeader = { Authorization: `Bearer ${opToken}` };
  assert(opLoginRes.data.user.role === 'operador', 'Papel retornado é "operador"');
  assert(opLoginRes.data.user.permissions.workOrdersDelete === false, 'Permissões conferem no login');

  // Operador tentando listar ou gerenciar usuários deve receber 403 Forbidden
  const opUsersRes = await makeRequest('GET', '/api/users', null, opAuthHeader);
  assert(opUsersRes.status === 403, 'Operador é BLOQUEADO ao tentar acessar /api/users (403)');

  // Operador tentando excluir OS deve receber 403 Forbidden
  const opDeleteOSRes = await makeRequest('DELETE', '/api/work-orders/os-qualquer', null, opAuthHeader);
  assert(opDeleteOSRes.status === 403, 'Operador sem workOrdersDelete é BLOQUEADO ao tentar excluir OS (403)');

  // 5. Desativação de Usuário e Bloqueio de Acesso
  console.log('\n5. DESATIVAÇÃO E ATIVAÇÃO DE USUÁRIO');
  const deactivateRes = await makeRequest(
    'PUT',
    `/api/users/${createdOp.id}`,
    { active: false },
    adminAuthHeader
  );
  assert(deactivateRes.status === 200, 'Admin desativa o operador com sucesso');
  assert(deactivateRes.data.user.active === false, 'Status do operador agora é inativo');

  // Login com usuário desativado deve ser bloqueado
  const inactiveLoginRes = await makeRequest('POST', '/api/auth/login', {
    username: testOpUsername,
    password: 'senhaSegura123'
  });
  assert(inactiveLoginRes.status === 403, 'Login de usuário desativado é rejeitado (403)');

  // 6. Proteção contra Exclusão Indevida
  console.log('\n6. PROTEÇÃO E EXCLUSÃO DE CONTAS');
  // Admin tentando excluir a si próprio
  const deleteSelfRes = await makeRequest('DELETE', `/api/users/${adminLoginRes.data.user.id}`, null, adminAuthHeader);
  assert(deleteSelfRes.status === 400, 'Admin é impedido de excluir sua própria conta conectada (400)');

  // Exclusão do operador de teste
  const deleteOpRes = await makeRequest('DELETE', `/api/users/${createdOp.id}`, null, adminAuthHeader);
  assert(deleteOpRes.status === 200, 'Operador de teste excluído com sucesso');

  console.log('\n================================================================');
  console.log(`RESULTADO DA BATERIA:`);
  console.log(`  Sucessos: ${passes}`);
  console.log(`  Falhas:   ${fails}`);
  console.log('================================================================');

  if (fails > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro ao executar testes:', err);
  process.exit(1);
});
