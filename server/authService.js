require('dotenv').config();
const crypto = require('crypto');
const { getDatabase, saveDatabase } = require('./db');

const OLD_INSECURE_FALLBACK = 'powertech-secret-production-key-change-in-env-file';
const DEV_ONLY_FALLBACK = 'powertech-dev-only-local-secret-do-not-use-in-production';
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 dias

/**
 * Identifica se a aplicação está executando em ambiente de produção (Vercel ou servidor dedicado)
 */
function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

/**
 * Obtém a chave de assinatura JWT de forma segura:
 * - Em produção: JWT_SECRET é estritamente obrigatória, deve ter exatamente 64 caracteres hexadecimais
 *   (32 bytes aleatórios) e nunca pode ser a chave pública legada ou de dev.
 * - Em desenvolvimento local: utiliza JWT_SECRET se definida, ou o fallback exclusivo de dev.
 */
function getJwtSecret() {
  const isProd = isProductionEnvironment();
  const configuredSecret = (process.env.JWT_SECRET || '').trim();

  if (isProd) {
    if (!configuredSecret) {
      const errorMsg = '[Segurança] Falha crítica de inicialização: A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (configuredSecret === OLD_INSECURE_FALLBACK || configuredSecret === DEV_ONLY_FALLBACK) {
      const errorMsg = '[Segurança] Falha crítica de inicialização: A variável JWT_SECRET em produção não pode utilizar chaves padrão ou de desenvolvimento.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (!HEX_64_REGEX.test(configuredSecret)) {
      const errorMsg = '[Segurança] Falha crítica de inicialização: A variável JWT_SECRET em produção deve conter exatamente 64 caracteres hexadecimais (32 bytes aleatórios).';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    return configuredSecret;
  }

  // Em ambiente local de desenvolvimento
  if (configuredSecret) {
    return configuredSecret;
  }
  return DEV_ONLY_FALLBACK;
}

// Validação imediata na inicialização caso esteja em produção
if (isProductionEnvironment()) {
  getJwtSecret();
}

/**
 * Gera hash seguro para senha usando PBKDF2 (SHA-512 com 100.000 iterações e salt aleatório)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Valida a senha comparando com o hash armazenado
 */
function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.includes(':')) return false;
  const [salt, originalHash] = storedPasswordHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Cria token assinado HMAC-SHA256 no formato compacto JWT (header.payload.signature)
 * Utiliza estritamente a chave resolvida por getJwtSecret()
 */
function createToken(payload) {
  const secret = getJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Valida e decodifica o token HMAC-SHA256
 * Utiliza estritamente a chave resolvida por getJwtSecret()
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Token ausente');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato de token inválido');

  const secret = getJwtSecret();
  const [b64Header, b64Payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new Error('Assinatura do token inválida');
  }

  const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return payload;
}

/**
 * Middleware Express para proteger rotas administrativas
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'Acesso não autorizado. Faça login para acessar o sistema.',
      code: 'AUTH_REQUIRED'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Formato de autorização inválido. Utilize: Bearer <token>',
      code: 'INVALID_AUTH_FORMAT'
    });
  }

  try {
    const decoded = verifyToken(parts[1]);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: err.message || 'Sessão inválida ou expirada.',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Middleware Express para exigir privilégio de administrador
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso restrito ao Administrador do sistema.',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Garante que exista ao menos um usuário administrador inicial no banco
 */
function ensureDefaultAdminUser(db) {
  if (!db.users) {
    db.users = [];
  }

  let adminUser = db.users.find((u) => u.username && u.username.toLowerCase() === 'admin');
  const initialPass = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';

  if (!adminUser) {
    adminUser = {
      id: 'usr-admin-default-admin',
      username: 'admin',
      name: 'Administrador Power Tech',
      role: 'admin',
      permissions: {
        dashboard: true,
        workOrders: true,
        workOrdersDelete: true,
        pos: true,
        quotes: true,
        inventory: true,
        services: true,
        customers: true,
        fiscal: true,
        backup: true,
        settings: true
      },
      active: true,
      passwordHash: hashPassword(initialPass),
      createdAt: new Date().toISOString()
    };
    db.users.push(adminUser);
    saveDatabase(db);
    console.log(`[Segurança] Usuário administrador padrão configurado: "admin"`);
  } else {
    let updated = false;
    // Só define senha inicial se o administrador não tiver nenhum hash cadastrado.
    // Nunca sobrescreve uma senha já configurada ou personalizada pelo usuário.
    if (!adminUser.passwordHash) {
      adminUser.passwordHash = hashPassword(initialPass);
      updated = true;
      console.log(`[Segurança] Senha padrão inicial configurada para o usuário admin`);
    }
    if (adminUser.active === false || adminUser.role !== 'admin') {
      adminUser.active = true;
      adminUser.role = 'admin';
      updated = true;
    }
    if (updated) {
      saveDatabase(db);
    }
  }
}

/**
 * Valida a senha fornecida contra os administradores ativos cadastrados no sistema
 */
function validateAdminPassword(password) {
  if (!password || typeof password !== 'string') return false;
  const db = getDatabase();
  const activeAdmins = (db.users || []).filter((u) => u.role === 'admin' && u.active !== false);
  if (activeAdmins.length > 0) {
    return activeAdmins.some((admin) => verifyPassword(password, admin.passwordHash));
  }
  return false;
}

/**
 * Middleware Express para exigir e validar a senha do administrador antes de exclusões ou cancelamentos
 */
function requireAdminPassword(req, res, next) {
  let pass = req.headers['x-admin-password'] || (req.body && req.body.adminPassword) || (req.query && req.query.adminPassword);
  if (pass && typeof pass === 'string') {
    try {
      pass = decodeURIComponent(pass);
    } catch (e) {
      // mantém o texto original se não for URI encoded
    }
  }

  if (!pass || !validateAdminPassword(pass)) {
    return res.status(403).json({
      error: 'Senha de administrador incorreta ou não informada. Ação não autorizada.',
      code: 'ADMIN_PASSWORD_REQUIRED'
    });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  validateAdminPassword,
  requireAdminPassword,
  ensureDefaultAdminUser,
  getJwtSecret,
  isProductionEnvironment,
  get JWT_SECRET() {
    return getJwtSecret();
  }
};
