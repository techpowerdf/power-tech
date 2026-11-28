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
  console.log('=== TESTE DO MODAL DE SENHA ADMINISTRATIVA ===\n');

  const db = JSON.parse(fs.readFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', 'utf8'));
  const realUser = db.users.find(u => u.active);
  console.log('Usuário real utilizado no teste de sessão:', realUser.username, '| ID:', realUser.id);

  const { createToken } = require('../server/authService');
  const token = createToken({
    id: realUser.id,
    username: realUser.username,
    role: realUser.role,
    name: realUser.name
  });

  // 1. Errar a senha administrativa
  const resWrong = await request('POST', '/auth/verify-admin-password', { password: 'senha_completamente_incorreta' }, {
    Authorization: 'Bearer ' + token
  });
  console.log('\n1. Verificação com senha incorreta:');
  console.log('   Status:', resWrong.status);
  console.log('   Resposta:', resWrong.data);
  console.log('   Mensagem de erro clara:', resWrong.data.error === 'Senha de administrador incorreta.');

  // 2. Verificar se o token do usuário continua 100% válido após errar a senha
  const resSessionCheck = await request('GET', '/auth/me', null, {
    Authorization: 'Bearer ' + token
  });
  console.log('\n2. Verificação da sessão do usuário após errar a senha:');
  console.log('   Status:', resSessionCheck.status);
  console.log('   Usuário retornado:', resSessionCheck.data?.user?.username);
  console.log('   Sessão permanece ativa:', resSessionCheck.status === 200 && resSessionCheck.data.user.username === realUser.username);

  // 3. Testar envio sem senha
  const resEmpty = await request('POST', '/auth/verify-admin-password', { password: '' }, {
    Authorization: 'Bearer ' + token
  });
  console.log('\n3. Verificação com campo vazio:');
  console.log('   Status:', resEmpty.status, '| Erro:', resEmpty.data.error);
}

run().catch(console.error);
