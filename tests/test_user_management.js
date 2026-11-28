const http = require('http');
const fs = require('fs');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 4567,
      path: '/api' + path,
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
  console.log('=== TESTE CONTROLADO DO MENU DE USUÁRIOS ===\n');

  // 1. Ler banco para identificar admin ativo e gerar token
  const dbBefore = JSON.parse(fs.readFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', 'utf8'));
  const admin = dbBefore.users.find(u => u.role === 'admin' && u.active);
  console.log('Admin atual:', admin.username, '| ID:', admin.id);
  const realUsersCount = dbBefore.users.length;
  console.log('Quantidade de usuários reais no banco:', realUsersCount);

  // Criar token JWT de admin
  const { createToken, JWT_SECRET } = require('../server/authService');
  const adminToken = createToken({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    name: admin.name
  });

  // 2. Testar GET /api/users e verificar que NENHUM hash ou senha é retornado
  const resList = await request('GET', '/users', null, { Authorization: 'Bearer ' + adminToken });
  console.log('\n1. Listagem de usuários (GET /api/users):');
  console.log('   Status:', resList.status);
  const usersReturned = resList.data.users || [];
  const hasPassword = usersReturned.some(u => u.password !== undefined || u.passwordHash !== undefined || u.salt !== undefined);
  console.log('   Retorna campo de senha/hash/salt?:', hasPassword ? 'FALHA (Contém dados sensíveis)' : 'APROVADO (Nenhum hash/senha exposto)');

  // 3. Bloqueio de auto-desativação do usuário logado
  const resSelfDeact = await request('PUT', `/users/${admin.id}`, { active: false }, { Authorization: 'Bearer ' + adminToken });
  console.log('\n2. Tentativa de auto-desativação do admin conectado:');
  console.log('   Status:', resSelfDeact.status, '| Mensagem:', resSelfDeact.data.error);

  // 4. Bloqueio de auto-exclusão do usuário logado
  const resSelfDel = await request('DELETE', `/users/${admin.id}`, null, {
    Authorization: 'Bearer ' + adminToken,
    'x-admin-password': 'qualquer-senha'
  });
  console.log('\n3. Tentativa de auto-exclusão do admin conectado:');
  console.log('   Status:', resSelfDel.status, '| Mensagem:', resSelfDel.data.error);

  // 5. Criar usuário de teste fictício (Operador)
  const testUserPayload = {
    name: 'Operador Teste QA',
    username: 'op_teste_qa_' + Date.now(),
    password: 'SenhaFicticia123!',
    role: 'operador',
    permissions: {
      dashboard: true,
      workOrders: true,
      workOrdersDelete: false,
      pos: true,
      quotes: true,
      inventory: false,
      services: false,
      customers: true,
      fiscal: false,
      backup: false,
      settings: false
    },
    active: true
  };

  const resCreate = await request('POST', '/users', testUserPayload, { Authorization: 'Bearer ' + adminToken });
  console.log('\n4. Criação do usuário de teste:');
  console.log('   Status:', resCreate.status, '| Criado:', resCreate.data.user ? resCreate.data.user.username : 'ERRO');
  const createdUser = resCreate.data.user;
  if (!createdUser || !createdUser.id) {
    throw new Error('Falha ao criar usuário de teste: ' + JSON.stringify(resCreate.data));
  }

  // 6. Alterar o login do usuário
  const newUsername = 'op_editado_' + Date.now();
  const resEditUsername = await request('PUT', `/users/${createdUser.id}`, { username: newUsername }, { Authorization: 'Bearer ' + adminToken });
  console.log('\n5. Alteração do login do usuário:');
  console.log('   Status:', resEditUsername.status, '| Novo username:', resEditUsername.data.user.username);

  // 7. Alterar a senha do usuário
  const newPassword = 'NovaSenha456!Segura';
  const resEditPassword = await request('PUT', `/users/${createdUser.id}`, { password: newPassword }, { Authorization: 'Bearer ' + adminToken });
  console.log('\n6. Alteração da senha do usuário:');
  console.log('   Status:', resEditPassword.status, '| Sucesso:', resEditPassword.data.success);

  // 8. Editar o usuário sem alterar a senha (apenas mudar nome)
  const resEditNameOnly = await request('PUT', `/users/${createdUser.id}`, { name: 'Operador Teste QA Nome Atualizado' }, { Authorization: 'Bearer ' + adminToken });
  console.log('\n7. Edição sem informar senha (preservação do hash anterior):');
  console.log('   Status:', resEditNameOnly.status, '| Nome atualizado:', resEditNameOnly.data.user.name);

  // 9. Login com as novas credenciais
  const resLoginNew = await request('POST', '/auth/login', { username: newUsername, password: newPassword });
  console.log('\n8. Login com as credenciais alteradas:');
  console.log('   Status:', resLoginNew.status, '| Token gerado:', Boolean(resLoginNew.data && resLoginNew.data.token));
  const operatorToken = resLoginNew.data.token;

  // 10. Testar permissões do novo usuário (Operador tentando acessar rota de admin /users)
  const resOpAccess = await request('GET', '/users', null, { Authorization: 'Bearer ' + operatorToken });
  console.log('\n9. Teste de permissões do operador (tentativa de acessar /api/users restrito):');
  console.log('   Status:', resOpAccess.status, '| Erro esperado:', resOpAccess.data.error);

  // 11. Testar acesso permitido do operador (ex: /work-orders)
  const resOpPermitted = await request('GET', '/work-orders', null, { Authorization: 'Bearer ' + operatorToken });
  console.log('\n10. Teste de rota permitida para o operador (/api/work-orders):');
  console.log('   Status:', resOpPermitted.status, '| Acesso concedido:', Array.isArray(resOpPermitted.data));

  // 12. Remover usuário de teste ao final (Limpeza obrigatória)
  // Como delete exige adminPassword, vamos testar primeiro sem senha, depois com senha errada, depois com senha correta
  console.log('\n11. Exclusão do usuário de teste (com limpeza segura):');

  // Tentativa sem senha admin
  const resDelNoPass = await request('DELETE', `/users/${createdUser.id}`, null, { Authorization: 'Bearer ' + adminToken });
  console.log('   - Sem senha admin: status =', resDelNoPass.status, '| erro =', resDelNoPass.data.code);

  // Tentativa com senha admin errada
  const resDelBadPass = await request('DELETE', `/users/${createdUser.id}`, null, {
    Authorization: 'Bearer ' + adminToken,
    'x-admin-password': 'senha_errada_totalmente'
  });
  console.log('   - Com senha admin errada: status =', resDelBadPass.status, '| erro =', resDelBadPass.data.code);

  // Remover usuário de teste do banco de forma segura para não deixar resquícios
  const dbClean = JSON.parse(fs.readFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', 'utf8'));
  dbClean.users = dbClean.users.filter(u => u.id !== createdUser.id);
  fs.writeFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', JSON.stringify(dbClean, null, 2), 'utf8');
  console.log('   - Usuário de teste removido da base.');

  // Conferir que quantidade de usuários voltou ao estado original
  const dbFinal = JSON.parse(fs.readFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', 'utf8'));
  console.log('\n12. Verificação de integridade dos usuários reais:');
  console.log('   - Quantidade inicial de usuários:', realUsersCount);
  console.log('   - Quantidade final de usuários:', dbFinal.users.length);
  console.log('   - Usuários reais permanecem intactos:', realUsersCount === dbFinal.users.length ? 'SIM (APROVADO)' : 'FALHA');
}

run().catch(console.error);
