/**
 * Suite de Testes Obrigatórios: Validação de Segurança e Endurecimento do JWT_SECRET
 * Cobre: 64 chars hexadecimais, chaves curtas, caracteres inválidos, chave legada,
 * chave de dev em produção, tokens com chave diferente e fluxo de login/validação normal.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('BATERIA DE TESTES CONTROLADOS: ENDURECIMENTO DO JWT_SECRET');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Teste ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Teste ${totalTests}: ${name}`);
    console.error(`       Erro: ${err.message}\n`);
  }
}

// Chaves de teste fictícias para validação
const VALID_HEX_64_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
const OTHER_VALID_HEX_64_KEY = '11223344556677889900aabbccddeeff00112233445566778899aabbccddeeff';
const OLD_LEGACY_KEY = 'powertech-secret-production-key-change-in-env-file';
const DEV_ONLY_KEY = 'powertech-dev-only-local-secret-do-not-use-in-production';
const SHORT_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 32 chars (curta)
const LONG_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6de'; // 65 chars (longa)
const INVALID_CHARS_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6z'; // contém 'z' (não-hex)

// 1. Inicialização em modo produção sem JWT_SECRET: deve falhar
runTest('Produção (NODE_ENV=production) sem JWT_SECRET deve falhar', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true, 'O processo deveria falhar');
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção'), true);
});

// 2. Inicialização em ambiente Vercel (VERCEL=1) sem JWT_SECRET: deve falhar
runTest('Ambiente Vercel (VERCEL=1) sem JWT_SECRET deve falhar', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: '', JWT_SECRET: '', VERCEL: '1' }
  });
  assert.strictEqual(result.status !== 0, true, 'O processo deveria falhar');
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção'), true);
});

// 3. Inicialização em produção com a chave antiga de fallback: deve falhar
runTest('Produção com chave legada de fallback antiga deve falhar', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: OLD_LEGACY_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true);
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('não pode utilizar chaves padrão ou de desenvolvimento'), true);
});

// 4. Inicialização em produção com a chave de desenvolvimento: deve falhar
runTest('Produção com chave exclusiva de desenvolvimento deve falhar', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: DEV_ONLY_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true);
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('não pode utilizar chaves padrão ou de desenvolvimento'), true);
});

// 5. Inicialização em produção com chave curta (< 64 chars): deve falhar
runTest('Produção com chave curta (32 chars) deve ser rejeitada', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: SHORT_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true);
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('deve conter exatamente 64 caracteres hexadecimais'), true);
});

// 6. Inicialização em produção com chave longa (> 64 chars): deve falhar
runTest('Produção com chave longa (65 chars) deve ser rejeitada', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: LONG_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true);
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('deve conter exatamente 64 caracteres hexadecimais'), true);
});

// 7. Inicialização em produção com caracteres inválidos (não-hex): deve falhar
runTest('Produção com caracteres não-hexadecimais deve ser rejeitada', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server/authService')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: INVALID_CHARS_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status !== 0, true);
  const output = result.stderr.toString() + result.stdout.toString();
  assert.strictEqual(output.includes('deve conter exatamente 64 caracteres hexadecimais'), true);
});

// 8. Inicialização em produção com chave válida de 64 caracteres hexadecimais: deve funcionar
runTest('Produção com chave válida de 64 caracteres hexadecimais deve inicializar com sucesso', () => {
  const result = spawnSync(process.execPath, ['-e', "const { getJwtSecret } = require('./server/authService'); console.log('INIT_OK');"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('INIT_OK'), true);
});

// 9. Validação e decodificação normal com chave válida de 64 hex
runTest('Token emitido e validado com chave de 64 hex válida opera normalmente', () => {
  const script = `
    const { createToken, verifyToken } = require('./server/authService');
    const token = createToken({ id: 'usr-admin-1', username: 'admin', role: 'admin' });
    const payload = verifyToken(token);
    if (payload.username === 'admin' && payload.role === 'admin' && payload.exp > payload.iat) {
      console.log('TOKEN_VALID');
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('TOKEN_VALID'), true);
});

// 10. Token assinado com a chave antiga de fallback: DEVE ser rejeitado
runTest('Token assinado com a chave antiga de fallback DEVE ser rejeitado', () => {
  const script = `
    const crypto = require('crypto');
    const { verifyToken } = require('./server/authService');

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ id: '1', username: 'admin', exp: now + 3600 })).toString('base64url');
    const oldSig = crypto.createHmac('sha256', '${OLD_LEGACY_KEY}').update(header + '.' + payload).digest('base64url');
    const forgedToken = header + '.' + payload + '.' + oldSig;

    try {
      verifyToken(forgedToken);
      console.log('FALHA: Token antigo aceito indevidamente');
      process.exit(1);
    } catch (err) {
      console.log('ANTIGO_REJEITADO: ' + err.message);
      process.exit(0);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('ANTIGO_REJEITADO'), true);
});

// 11. Token assinado com chave diferente (chave válida B): DEVE ser rejeitado pelo servidor com chave A
runTest('Token assinado com chave diferente da configurada DEVE ser rejeitado', () => {
  const script = `
    const crypto = require('crypto');
    const { verifyToken } = require('./server/authService');

    // Assina com a chave B
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ id: '1', username: 'admin', exp: now + 3600 })).toString('base64url');
    const sigB = crypto.createHmac('sha256', '${OTHER_VALID_HEX_64_KEY}').update(header + '.' + payload).digest('base64url');
    const tokenB = header + '.' + payload + '.' + sigB;

    // Servidor opera com chave A (definida no env)
    try {
      verifyToken(tokenB);
      console.log('FALHA: Token de chave diferente aceito');
      process.exit(1);
    } catch (err) {
      console.log('CHAVE_DIFERENTE_REJEITADA: ' + err.message);
      process.exit(0);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('CHAVE_DIFERENTE_REJEITADA'), true);
});

// 12. Token com assinatura adulterada: deve ser rejeitado
runTest('Token com assinatura adulterada deve ser rejeitado', () => {
  const script = `
    const { createToken, verifyToken } = require('./server/authService');
    const token = createToken({ id: 'usr-1', username: 'operador', role: 'operator' });
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 'usr-1', username: 'operador', role: 'admin' })).toString('base64url');
    const tamperedToken = parts[0] + '.' + tamperedPayload + '.' + parts[2];

    try {
      verifyToken(tamperedToken);
      process.exit(1);
    } catch (err) {
      console.log('ADULTERACAO_REJEITADA: ' + err.message);
      process.exit(0);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('ADULTERACAO_REJEITADA'), true);
});

// 13. Token expirado: deve ser rejeitado
runTest('Token expirado deve ser rejeitado com mensagem específica de sessão expirada', () => {
  const script = `
    const crypto = require('crypto');
    const { verifyToken } = require('./server/authService');

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const past = Math.floor(Date.now() / 1000) - 100;
    const payload = Buffer.from(JSON.stringify({ id: '1', username: 'admin', exp: past })).toString('base64url');
    const sig = crypto.createHmac('sha256', '${VALID_HEX_64_KEY}').update(header + '.' + payload).digest('base64url');
    const expiredToken = header + '.' + payload + '.' + sig;

    try {
      verifyToken(expiredToken);
      process.exit(1);
    } catch (err) {
      if (err.message.includes('Sessão expirada')) {
        console.log('EXPIRADO_OK');
        process.exit(0);
      }
      process.exit(2);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('EXPIRADO_OK'), true);
});

// 14. Ambiente local de desenvolvimento sem JWT_SECRET: funciona com fallback de dev
runTest('Ambiente local (NODE_ENV=development, VERCEL="") opera com fallback seguro de dev', () => {
  const script = `
    const { createToken, verifyToken, getJwtSecret } = require('./server/authService');
    const secret = getJwtSecret();
    if (!secret || secret === '${OLD_LEGACY_KEY}') {
      process.exit(1);
    }
    const token = createToken({ id: 'dev-user', username: 'dev' });
    const payload = verifyToken(token);
    if (payload.username === 'dev') {
      console.log('DEV_FALLBACK_OK');
      process.exit(0);
    }
    process.exit(2);
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', JWT_SECRET: '', VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('DEV_FALLBACK_OK'), true);
});

// 15. requireAuth e requireAdmin funcionando normalmente com chave de 64 hex
runTest('Middlewares requireAuth e requireAdmin operam normalmente com token legítimo', () => {
  const script = `
    const { createToken, requireAuth, requireAdmin } = require('./server/authService');
    const adminToken = createToken({ id: '1', username: 'admin', role: 'admin' });

    const req = { headers: { authorization: 'Bearer ' + adminToken } };
    let authPassed = false;
    let adminPassed = false;
    const res = {
      status() { return this; },
      json() { return this; }
    };

    requireAuth(req, res, () => {
      authPassed = true;
      requireAdmin(req, res, () => {
        adminPassed = true;
      });
    });

    if (authPassed && adminPassed && req.user && req.user.username === 'admin') {
      console.log('MIDDLEWARES_OK');
      process.exit(0);
    }
    process.exit(1);
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: VALID_HEX_64_KEY, VERCEL: '' }
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.toString().includes('MIDDLEWARES_OK'), true);
});

// 16. Impossibilidade de desvio por parâmetro opcional
runTest('Funções createToken e verifyToken exigem exclusivamente getJwtSecret() e não aceitam secret opcional', () => {
  const { createToken, verifyToken } = require('../server/authService');
  assert.strictEqual(createToken.length, 1, 'createToken deve aceitar exclusivamente 1 parâmetro (payload)');
  assert.strictEqual(verifyToken.length, 1, 'verifyToken deve aceitar exclusivamente 1 parâmetro (token)');
});

console.log('\n================================================================');
console.log(`RESULTADO DA BATERIA: ${passedTests} de ${totalTests} testes aprovados.`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
