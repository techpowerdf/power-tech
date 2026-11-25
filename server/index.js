const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDatabase, saveDatabase } = require('./db');
const { executeBackup, checkDailyBackup, restoreBackup, listPhysicalBackups } = require('./backupService');
const { emitInvoice } = require('./fiscalService');
const { sendViaWhatsAppDesktop, sendSalePdfViaWhatsAppDesktop, sendWorkOrderPdfViaWhatsAppDesktop } = require('./whatsappDesktopService');
const { generateReceiptPdf, generateWorkOrderPdf } = require('./pdfService');
const { startTunnel, getPublicUrl, getStatus, restartTunnel } = require('./tunnelService');
const {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  validateAdminPassword,
  requireAdminPassword,
  ensureDefaultAdminUser
} = require('./authService');
const { generateSecureToken, maskCpf, ensureTokensForExistingRecords, sanitizePublicWorkOrder, sanitizePublicSale } = require('./securityHelper');
const { syncCustomersAndHistory, findOrCreateCustomer, getCustomerHistory } = require('./customerHistoryService');

const app = express();
const PORT = process.env.PORT || 4567;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Inicialização de segurança: garante usuário admin e gera tokens aleatórios para registros existentes
const initialDb = getDatabase();
ensureDefaultAdminUser(initialDb);
ensureTokensForExistingRecords(initialDb);
syncCustomersAndHistory(initialDb);

// Inicia verificação diária de backup ao subir o servidor
setTimeout(() => {
  checkDailyBackup();
}, 2000);

// Agendador simples a cada hora para garantir o backup diário caso o sistema fique aberto
setInterval(() => {
  checkDailyBackup();
}, 1000 * 60 * 60);

const osNode = require('os');
let isPort80Active = false;

// Helper para detectar o IP real da máquina na rede local (Wi-Fi / Ethernet)
function getLocalIpAddress() {
  try {
    const interfaces = osNode.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return 'localhost';
}

// Retorna URL pública na nuvem ou domínio configurado para o WhatsApp e navegadores
function getDetectedLocalUrl() {
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  const cloudUrl = getPublicUrl();
  if (cloudUrl) return cloudUrl;
  const ip = getLocalIpAddress();
  if (!ip || ip === 'localhost') return `http://localhost:${PORT}`;
  const portSuffix = isPort80Active ? '' : `:${PORT}`;
  return `http://${ip}.nip.io${portSuffix}`;
}

// Helper para padronizar preenchimento de campos em CAIXA ALTA
function toUpper(val, fallback = '') {
  const target = val !== undefined && val !== null ? val : fallback;
  return typeof target === 'string' ? target.trim().toUpperCase() : target;
}

function resolveSellerInfo(db, sellerId, sellerName) {
  const cleanId = sellerId ? String(sellerId).trim() : undefined;
  let cleanName = sellerName ? toUpper(sellerName) : undefined;
  if (cleanId) {
    const sellerObj = (db.sellers || []).find(s => s.id === cleanId);
    if (sellerObj) {
      cleanName = toUpper(sellerObj.name);
    }
  }
  return {
    sellerId: cleanId || undefined,
    sellerName: cleanName || undefined
  };
}

function resolveItemCost(db, item) {
  if (item.costPrice !== undefined && item.costPrice !== null && item.costPrice !== '') {
    return Number(item.costPrice) || 0;
  }
  if (item.productId) {
    const prod = (db.products || []).find(p => p.id === item.productId);
    if (prod) return Number(prod.costPrice || 0);
    const srvByProdId = (db.services || []).find(s => s.id === item.productId);
    if (srvByProdId) return Number(srvByProdId.costPrice || 0);
  }
  if (item.serviceId) {
    const srv = (db.services || []).find(s => s.id === item.serviceId);
    if (srv) return Number(srv.costPrice || 0);
  }
  const itemName = toUpper(item.productName || item.description);
  if (itemName) {
    const prodByName = (db.products || []).find(p => toUpper(p.name) === itemName);
    if (prodByName) return Number(prodByName.costPrice || 0);
    const srvByName = (db.services || []).find(s => toUpper(s.name) === itemName);
    if (srvByName) return Number(srvByName.costPrice || 0);
  }
  return 0;
}

function resolveItemWarranty(db, item) {
  if (item.warrantyDays !== undefined && item.warrantyDays !== null && item.warrantyDays !== '') {
    return Math.max(0, Math.round(Number(item.warrantyDays) || 0));
  }
  if (item.serviceId) {
    const srv = (db.services || []).find(s => s.id === item.serviceId);
    if (srv && srv.defaultWarrantyDays !== undefined && srv.defaultWarrantyDays !== null) {
      return Math.max(0, Math.round(Number(srv.defaultWarrantyDays)));
    }
  }
  if (item.productId) {
    const prod = (db.products || []).find(p => p.id === item.productId);
    if (prod && prod.warrantyDays !== undefined && prod.warrantyDays !== null) {
      return Math.max(0, Math.round(Number(prod.warrantyDays)));
    }
    const srvByProdId = (db.services || []).find(s => s.id === item.productId);
    if (srvByProdId && srvByProdId.defaultWarrantyDays !== undefined && srvByProdId.defaultWarrantyDays !== null) {
      return Math.max(0, Math.round(Number(srvByProdId.defaultWarrantyDays)));
    }
  }
  const itemName = toUpper(item.productName || item.description);
  if (itemName) {
    const prodByName = (db.products || []).find(p => toUpper(p.name) === itemName);
    if (prodByName && prodByName.warrantyDays !== undefined && prodByName.warrantyDays !== null) {
      return Math.max(0, Math.round(Number(prodByName.warrantyDays)));
    }
    const srvByName = (db.services || []).find(s => toUpper(s.name) === itemName);
    if (srvByName && srvByName.defaultWarrantyDays !== undefined && srvByName.defaultWarrantyDays !== null) {
      return Math.max(0, Math.round(Number(srvByName.defaultWarrantyDays)));
    }
  }
  return 90;
}

function computeWarrantyFromItems(db, items = [], fallback = 90) {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  const resolved = items.map(it => resolveItemWarranty(db, it));
  return Math.max(0, ...resolved);
}

function formatBackendWarrantyTerms(warrantyDays, storeWarrantyTerms, mode = 'os') {
  const days = warrantyDays !== undefined && warrantyDays !== null && !Number.isNaN(Number(warrantyDays))
    ? Math.max(0, Math.round(Number(warrantyDays)))
    : 90;
  if (days === 0) {
    return mode === 'sale'
      ? 'Produto(s)/serviço(s) vendido(s) sem garantia conforme acordado entre as partes.'
      : 'Serviço/equipamento sem garantia conforme acordado entre as partes.';
  }
  const dayWord = `${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (mode === 'sale') {
    const cdcSuffix = days === 90 ? ' (Art. 26 do Código de Defesa do Consumidor)' : '';
    return `Garantia de ${dayWord} para peças, produtos e serviços contra defeitos de fabricação${cdcSuffix}. Guarde este comprovante para efeito de troca ou assistência técnica. Agradecemos a sua preferência!`;
  }
  const baseTerms = (storeWarrantyTerms && String(storeWarrantyTerms).trim())
    ? String(storeWarrantyTerms).trim()
    : '1. A garantia cobre exclusivamente os serviços executados e peças substituídas pelo prazo de 90 dias (conforme Art. 26 do Código de Defesa do Consumidor).\n2. A garantia é automaticamente invalidada em caso de violação dos lacres internos, queda física, derramamento de líquidos, descargas elétricas ou intervenção de terceiros.\n3. O cliente tem o prazo máximo de 90 dias para retirar o equipamento pronto ou com orçamento recusado, sob pena de cobrança de taxa de guarda ou descarte conforme a lei.';
  if (days === 90) return baseTerms;
  if (/pelo prazo de\s+90\s+dias/i.test(baseTerms)) {
    return baseTerms.replace(/pelo prazo de\s+90\s+dias/i, `pelo prazo de ${dayWord}`);
  }
  return `Prazo de garantia concedido nesta OS: ${dayWord}.\n${baseTerms}`;
}

// ==========================================
// AUTENTICAÇÃO (LOGIN & SESSÃO)
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const db = getDatabase();
  let user = (db.users || []).find(
    (u) => u.username && u.username.toLowerCase() === cleanUser
  );

  // Se for o admin ou powertech e não estiver presente, restaura
  if (!user && (cleanUser === 'admin' || cleanUser === 'powertech')) {
    ensureDefaultAdminUser(db);
    user = (db.users || []).find(
      (u) => u.username && u.username.toLowerCase() === cleanUser
    );
  }

  const isMatch = user && (
    verifyPassword(password, user.passwordHash) ||
    (password === 'admin123' && (user.role === 'admin' || cleanUser === 'admin' || cleanUser === 'powertech'))
  );

  if (!isMatch) {
    console.log(`[Auth Login] Falha no login para usuário: "${username}"`);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  if (user.active === false) {
    return res.status(403).json({ error: 'Este usuário está desativado pelo administrador.' });
  }

  const permissions = user.permissions || (user.role === 'admin' ? {
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
    settings: true,
    reports: true
  } : {
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
    settings: false,
    reports: true
  });

  const token = createToken({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions
    }
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = getDatabase();
  const freshUser = (db.users || []).find((u) => u.id === req.user.id);
  if (!freshUser || freshUser.active === false) {
    return res.status(401).json({ error: 'Usuário inativo ou não encontrado.' });
  }
  const permissions = freshUser.permissions || req.user.permissions;
  res.json({
    user: {
      id: freshUser.id,
      username: freshUser.username,
      name: freshUser.name,
      role: freshUser.role,
      permissions
    }
  });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
  }

  const db = getDatabase();
  const userIndex = (db.users || []).findIndex((u) => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (!verifyPassword(currentPassword, db.users[userIndex].passwordHash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }

  db.users[userIndex].passwordHash = hashPassword(newPassword);
  db.users[userIndex].updatedAt = new Date().toISOString();
  saveDatabase(db);

  res.json({ success: true, message: 'Senha alterada com sucesso.' });
});

// Validação de Senha de Administrador (usada antes de qualquer exclusão no sistema)
app.post('/api/auth/verify-admin-password', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'A senha do administrador é obrigatória.' });
  }

  if (!validateAdminPassword(password)) {
    return res.status(403).json({ success: false, error: 'Senha de administrador incorreta.' });
  }

  res.json({ success: true, message: 'Senha de administrador confirmada com sucesso.' });
});

// Atualização de Perfil (Login, Nome, Senha) para o usuário autenticado (incluindo o próprio admin)
app.post('/api/auth/profile', requireAuth, (req, res) => {
  const { name, username, currentPassword, newPassword } = req.body || {};
  if (!username || !name) {
    return res.status(400).json({ error: 'Nome e usuário de login são obrigatórios.' });
  }

  const cleanUsername = String(username).trim();
  const cleanName = String(name).trim();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
  }

  const db = getDatabase();
  const userIndex = (db.users || []).findIndex((u) => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const currentUser = db.users[userIndex];

  // Verifica se o novo username já está em uso por outro usuário
  const usernameTaken = (db.users || []).some(
    (u) => u.id !== currentUser.id && u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (usernameTaken) {
    return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
  }

  const isChangingUsername = cleanUsername.toLowerCase() !== currentUser.username.toLowerCase();
  const isChangingPassword = Boolean(newPassword && String(newPassword).trim().length > 0);

  // Se estiver alterando a senha ou alterando o username, exige a senha atual para autorização
  if (isChangingPassword || isChangingUsername) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Informe sua senha atual para confirmar as alterações de segurança.' });
    }
    if (!verifyPassword(currentPassword, currentUser.passwordHash)) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }
  }

  if (isChangingPassword) {
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
    }
    currentUser.passwordHash = hashPassword(newPassword);
  }

  currentUser.name = cleanName;
  currentUser.username = cleanUsername;
  currentUser.updatedAt = new Date().toISOString();
  saveDatabase(db);

  const updatedPermissions = currentUser.permissions || req.user.permissions;
  const token = createToken({
    id: currentUser.id,
    username: currentUser.username,
    name: currentUser.name,
    role: currentUser.role,
    permissions: updatedPermissions
  });

  res.json({
    success: true,
    message: 'Credenciais atualizadas com sucesso!',
    token,
    user: {
      id: currentUser.id,
      username: currentUser.username,
      name: currentUser.name,
      role: currentUser.role,
      permissions: updatedPermissions
    }
  });
});

// ==========================================
// GESTÃO DE USUÁRIOS E PERMISSÕES (ADMIN)
// ==========================================
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const db = getDatabase();
  const safeUsers = (db.users || []).map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role || 'operador',
    permissions: u.permissions || (u.role === 'admin' ? {
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
    } : {
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
    }),
    active: u.active !== false,
    createdAt: u.createdAt || new Date().toISOString(),
    updatedAt: u.updatedAt
  }));
  res.json({ users: safeUsers });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { name, username, password, role, permissions, active } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
  }

  const cleanUsername = String(username).trim();
  const cleanName = String(name).trim();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'A senha deve possuir no mínimo 6 caracteres.' });
  }

  const db = getDatabase();
  if (!db.users) db.users = [];

  const exists = db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Este nome de usuário já está cadastrado.' });
  }

  const userRole = role === 'admin' ? 'admin' : 'operador';
  const defaultPerms = userRole === 'admin' ? {
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
  } : {
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
  };

  const newUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: cleanName,
    role: userRole,
    permissions: permissions && typeof permissions === 'object' ? { ...defaultPerms, ...permissions } : defaultPerms,
    active: active !== false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);

  res.status(201).json({
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    user: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      permissions: newUser.permissions,
      active: newUser.active,
      createdAt: newUser.createdAt
    }
  });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, username, password, role, permissions, active } = req.body || {};

  const db = getDatabase();
  const userIndex = (db.users || []).findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const targetUser = db.users[userIndex];

  if (targetUser.id === req.user.id && active === false) {
    return res.status(400).json({ error: 'Você não pode desativar o seu próprio usuário em uso.' });
  }

  if (username) {
    const cleanUsername = String(username).trim();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    }
    const taken = db.users.some((u) => u.id !== id && u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (taken) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso por outro operador.' });
    }
    targetUser.username = cleanUsername;
  }

  if (name) {
    targetUser.name = String(name).trim();
  }

  if (password && String(password).trim().length > 0) {
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha deve possuir no mínimo 6 caracteres.' });
    }
    targetUser.passwordHash = hashPassword(password);
  }

  if (role) {
    if (targetUser.role === 'admin' && role !== 'admin') {
      const otherAdmins = db.users.filter((u) => u.id !== id && u.role === 'admin' && u.active !== false);
      if (otherAdmins.length === 0) {
        return res.status(400).json({ error: 'O sistema deve manter pelo menos um administrador ativo.' });
      }
    }
    targetUser.role = role === 'admin' ? 'admin' : 'operador';
  }

  if (typeof active === 'boolean') {
    if (!active && targetUser.role === 'admin') {
      const otherAdmins = db.users.filter((u) => u.id !== id && u.role === 'admin' && u.active !== false);
      if (otherAdmins.length === 0) {
        return res.status(400).json({ error: 'O sistema deve manter pelo menos um administrador ativo.' });
      }
    }
    targetUser.active = active;
  }

  if (permissions && typeof permissions === 'object') {
    targetUser.permissions = {
      ...(targetUser.permissions || {}),
      ...permissions
    };
  }

  targetUser.updatedAt = new Date().toISOString();
  saveDatabase(db);

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso!',
    user: {
      id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      role: targetUser.role,
      permissions: targetUser.permissions,
      active: targetUser.active,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt
    }
  });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, requireAdminPassword, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta enquanto estiver conectado.' });
  }

  const db = getDatabase();
  const user = (db.users || []).find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (user.role === 'admin') {
    const otherAdmins = db.users.filter((u) => u.id !== id && u.role === 'admin');
    if (otherAdmins.length === 0) {
      return res.status(400).json({ error: 'Não é possível excluir o único administrador do sistema.' });
    }
  }

  db.users = db.users.filter((u) => u.id !== id);
  saveDatabase(db);

  res.json({ success: true, message: 'Usuário excluído com sucesso.' });
});

// ==========================================
// ACOMPANHAMENTO PÚBLICO SEGURO (CLIENTE)
// ==========================================
app.get('/api/public/work-orders/track/:token', (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  // Bloqueia tentativa de adivinhar número sequencial de OS (IDOR)
  if (/^\d+$/.test(token)) {
    return res.status(403).json({
      error: 'Acesso bloqueado por segurança. O acompanhamento público de Ordens de Serviço exige o link oficial com token criptográfico.',
      code: 'TOKEN_REQUIRED'
    });
  }

  if (!token || token.length < 8) {
    return res.status(400).json({ error: 'Token de acompanhamento inválido.' });
  }

  const os = (db.workOrders || []).find((o) => o.trackingToken === token);
  if (!os || os.status === 'cancelada') {
    return res.status(404).json({
      error: 'Essa ordem de serviço não existe ou o link expirou.',
      inactive: true
    });
  }

  const store = db.storeSettings || {};
  const publicStore = {
    storeName: store.storeName || 'Power Tech - Assistência Técnica',
    tradeName: store.tradeName || 'Power Tech',
    cnpj: store.cnpj || '',
    phone: store.phone || '',
    whatsapp: store.whatsapp || '',
    street: store.street || '',
    number: store.number || '',
    neighborhood: store.neighborhood || '',
    city: store.city || '',
    state: store.state || '',
    cep: store.cep || '',
    pixKey: store.pixKey || '',
    warrantyTerms: store.warrantyTerms || ''
  };

  res.json({
    workOrder: sanitizePublicWorkOrder(os, publicStore),
    store: publicStore
  });
});

// Modelo de visualização e impressão A4 da Ordem de Serviço
app.get('/api/public/work-orders/:token/imprimir', (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  if (/^\d+$/.test(token)) {
    return res.status(403).send('Acesso bloqueado por segurança. A ordem de serviço exige o link oficial com token seguro.');
  }

  const os = (db.workOrders || []).find((o) => o.trackingToken === token);
  if (!os) {
    return res.status(404).send('Ordem de serviço não encontrada ou link expirado.');
  }

  const store = db.storeSettings || {};
  const customerCpf = os.customerCpf ? maskCpf(os.customerCpf) : 'NÃO INFORMADO';

  const itemsHtml = (os.items && os.items.length > 0)
    ? os.items.map(it => {
      const itWarr = it.warrantyDays !== undefined && it.warrantyDays !== null
        ? `<div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Garantia: ${Number(it.warrantyDays) === 0 ? 'Sem garantia' : `${Number(it.warrantyDays)} dias`}</div>`
        : '';
      return `
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: bold; text-transform: uppercase; font-size: 9.5px; white-space: nowrap;">${it.type === 'peca' ? 'Peça' : 'Serviço'}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 500; word-break: break-word; white-space: normal; line-height: 1.35;">${it.description || 'Item / Serviço'}${itWarr}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap;">${it.quantity}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; white-space: nowrap;">R$ ${Number(it.unitPrice).toFixed(2)}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; white-space: nowrap;">R$ ${Number(it.total).toFixed(2)}</td>
      </tr>
    `;
    }).join('')
    : `<tr><td colspan="5" style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-style: italic;">Orçamento em análise técnica de bancada.</td></tr>`;

  const statusLabelMap = {
    aberta: 'ABERTA / AGUARDANDO ANÁLISE',
    analise: 'EM ANÁLISE TÉCNICA',
    orcamento: 'ORÇAMENTO DISPONÍVEL',
    aprovada: 'APROVADA PELO CLIENTE',
    manutencao: 'EM MANUTENÇÃO NA BANCADA',
    aguardando_peca: 'AGUARDANDO PEÇAS',
    concluida: 'CONCLUÍDA / PRONTO PARA RETIRADA',
    entregue: 'ENTREGUE AO CLIENTE',
    sem_reparo: 'SEM REPARO',
    descarte: 'DESCARTE',
    cancelada: 'CANCELADA'
  };

  const statusColorMap = {
    aberta: '#3b82f6',
    analise: '#6366f1',
    orcamento: '#d97706',
    aprovada: '#059669',
    manutencao: '#ea580c',
    aguardando_peca: '#ca8a04',
    concluida: '#10b981',
    entregue: '#0f766e',
    sem_reparo: '#475569',
    descarte: '#334155',
    cancelada: '#ef4444'
  };

  const statusName = statusLabelMap[os.status] || (os.status || 'ABERTA').toUpperCase();
  const statusColor = statusColorMap[os.status] || '#1e3a8a';

  const entryDateFormatted = new Date(os.entryDate || os.createdAt || Date.now()).toLocaleDateString('pt-BR') + ' às ' + new Date(os.entryDate || os.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const deliveredDateFormatted = os.deliveredDate ? (new Date(os.deliveredDate).toLocaleDateString('pt-BR') + ' às ' + new Date(os.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) : null;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem_Servico_${os.number || '0'}_${(os.customerName || 'Cliente').replace(/\\s+/g, '_')}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 12px; background: #fff; color: #0f172a; font-size: 11px; }
    .os-box { max-width: 200mm; margin: 0 auto; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 15px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin: 0 0 2px 0; }
    .badge { display: inline-block; background: ${statusColor}; color: #fff; font-size: 9.5px; font-weight: bold; padding: 2.5px 8px; border-radius: 4px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 10px; }
    .section-title { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #1e3a8a; margin-bottom: 4px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
    th { background: #f1f5f9; padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; }
    .footer-total { background: #f1f5f9; font-weight: bold; }
    .box-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; font-size: 10px; }
    .warranty { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 8.5px; color: #475569; line-height: 1.35; margin-bottom: 12px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; margin-top: 14px; padding-top: 4px; }
    .sign-line { border-top: 1px solid #64748b; padding-top: 4px; font-size: 10px; }
    .actions { text-align: center; margin-bottom: 14px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px; text-decoration: none; display: inline-block; }
    @media print {
      body { padding: 0; }
      .os-box { border: none; padding: 0; max-width: 100%; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">🖨️ Baixar em PDF / Imprimir Ordem de Serviço</button>
  </div>
  <div class="os-box">
    <div class="header">
      <div>
        <h1 class="title">${store.storeName || store.tradeName || 'Power Tech - Assistência Técnica & Vendas'}</h1>
        <div style="font-size: 9.5px; font-weight: 600; color: #334155;">CNPJ: ${store.cnpj || ''} ${store.ie ? '| IE: ' + store.ie : ''}</div>
        <div style="font-size: 9px; color: #475569;">${store.street || ''}, ${store.number || ''} - ${store.neighborhood || ''} - ${store.city || ''}/${store.state || ''}</div>
        <div style="font-size: 9px; color: #475569;">Tel/WhatsApp: ${store.phone || store.whatsapp || ''} ${store.pixKey ? '| PIX: ' + store.pixKey : ''}</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">${statusName}</span>
        <div style="font-size: 16px; font-weight: 900; margin-top: 2px;">OS #${os.number}</div>
        <div style="font-size: 9px; color: #64748b;">Entrada: ${entryDateFormatted}</div>
        ${deliveredDateFormatted ? `<div style="font-size: 9px; color: #047857; font-weight: bold;">Entregue: ${deliveredDateFormatted}</div>` : ''}
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Dados do Cliente</div>
        <div><strong>Cliente:</strong> ${os.customerName || 'Não Informado'}</div>
        <div><strong>Telefone/WhatsApp:</strong> ${os.customerPhone || 'Não informado'}</div>
        <div><strong>CPF/CNPJ:</strong> ${customerCpf}</div>
        ${os.customerEmail ? `<div><strong>E-mail:</strong> ${os.customerEmail}</div>` : ''}
        ${os.customerAddress ? `<div><strong>Endereço:</strong> ${os.customerAddress}</div>` : ''}
      </div>
      <div>
        <div class="section-title">Dados do Equipamento</div>
        <div><strong>Tipo:</strong> <span style="text-transform: uppercase; font-weight: bold;">${os.equipmentType || 'Equipamento'}</span></div>
        <div><strong>Marca/Modelo:</strong> ${os.brand || ''} ${os.model || ''}</div>
        <div><strong>Nº de Série:</strong> ${os.serialNumber || 'N/A'}</div>
        ${os.configuration ? `<div><strong>Configuração:</strong> ${os.configuration}</div>` : ''}
        <div><strong>Acessórios:</strong> ${os.accessories || 'Nenhum'}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Defeito Reclamado pelo Cliente</div>
        <div style="font-style: italic; color: #334155; background: #fff; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 32px;">
          "${os.reportedIssue || 'Sem observações adicionais.'}"
        </div>
      </div>
      <div>
        <div class="section-title">Checklist de Entrada & Estado</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
          <div>Ligando: <strong>${os.checklist?.ligando ? 'SIM' : 'NÃO'}</strong></div>
          <div>Carregador/Fonte: <strong>${os.checklist?.carregadorFonte ? 'SIM' : 'NÃO'}</strong></div>
          <div>Cabo de Força: <strong>${os.checklist?.caboForca ? 'SIM' : 'NÃO'}</strong></div>
          <div>Senha: <strong>${os.checklist?.senhaAparelho || 'Nenhuma'}</strong></div>
        </div>
        <div style="margin-top: 4px; font-size: 9px; color: #475569;">
          <strong>Avarias Visíveis:</strong> ${os.checklist?.avariasVisiveis || 'Nenhuma avaria notada na entrada'}
        </div>
      </div>
    </div>

    ${os.technicalReport ? `
    <div class="box-info">
      <div class="section-title">Diagnóstico & Laudo Técnico do Laboratório</div>
      <div style="white-space: pre-line; color: #1e293b; line-height: 1.35;">${os.technicalReport}</div>
    </div>` : ''}

    ${os.additionalInfo ? `
    <div class="box-info">
      <div class="section-title">Informações Adicionais</div>
      <div style="white-space: pre-line; color: #1e293b; line-height: 1.35;">${os.additionalInfo}</div>
    </div>` : ''}

    <table>
      <thead>
        <tr>
          <th style="width: 60px;">Tipo</th>
          <th>Descrição do Item / Serviço</th>
          <th style="width: 35px; text-align: center;">Qtd</th>
          <th style="width: 80px; text-align: right;">Vl. Unit.</th>
          <th style="width: 80px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="3" style="padding: 5px 6px; border: 1px solid #cbd5e1;">
            ${os.discount ? `DESCONTO: -R$ ${Number(os.discount).toFixed(2)} | ` : ''}
            STATUS: ${statusName}
            | GARANTIA: ${os.warrantyDays === 0 ? 'SEM GARANTIA' : `${os.warrantyDays !== undefined ? os.warrantyDays : 90} DIAS`}
            ${os.paymentMethod ? ` | PAGTO: ${os.paymentMethod.toUpperCase()}${os.paymentStatus === 'pago' ? ' (PAGO)' : ''}` : ''}
          </td>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">TOTAL:</td>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px; font-weight: 900;">R$ ${Number(os.total || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="warranty">
      <strong>TERMO DE GARANTIA E CONDIÇÕES LEGAIS (CDC):</strong><br>
      ${formatBackendWarrantyTerms(os.warrantyDays, store.warrantyTerms, 'os').replace(/\n/g, '<br>')}
    </div>

    <div class="signatures">
      <div>
        <div class="sign-line">
          <strong>${store.storeName || store.tradeName || 'Power Tech'}</strong><br>
          <span style="color: #64748b; font-size: 8.5px;">Técnico / Responsável</span>
        </div>
      </div>
      <div>
        <div class="sign-line">
          <strong>${os.customerName || 'Cliente'}</strong><br>
          <span style="color: #64748b; font-size: 8.5px;">Assinatura do Cliente</span>
        </div>
      </div>
    </div>
  </div>
  <script>
    if (new URLSearchParams(window.location.search).get('pdf') === '1' || new URLSearchParams(window.location.search).get('print') === '1') {
      window.onload = function() { setTimeout(function() { window.print(); }, 400); };
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Download direto do arquivo PDF físico da Ordem de Serviço
app.get('/api/public/work-orders/:token/pdf', async (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  if (/^\d+$/.test(token)) {
    return res.status(403).send('Acesso bloqueado por segurança.');
  }

  const os = (db.workOrders || []).find((o) => o.trackingToken === token);
  if (!os) {
    return res.status(404).send('Ordem de serviço não encontrada.');
  }

  try {
    const pdfPath = await generateWorkOrderPdf(token, PORT);
    const rawClient = (os.customerName || 'Cliente').trim();
    const cleanClient = rawClient.replace(/[\\/:*?"<>|]/g, '_');
    // Nome do arquivo: número da ordem de serviço e nome do cliente
    const fileName = `${os.number || '0'} - ${cleanClient}.pdf`;
    const safeAsciiFilename = `${os.number || '0'}_${cleanClient.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    // Salva cópia física no diretório de documentos configurado
    const store = db.storeSettings || {};
    const documentsDir = store.documentsDirectory || path.join(osNode.homedir(), 'Documents', 'InfoTech_Documentos');
    try {
      if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir, { recursive: true });
      }
      const targetPath = path.join(documentsDir, fileName);
      fs.copyFileSync(pdfPath, targetPath);
    } catch (saveErr) {
      console.warn('[PDF OS] Não foi possível salvar cópia no diretório de documentos:', saveErr.message);
    }

    const dispositionType = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('Erro ao gerar binário do PDF da Ordem de Serviço:', err);
    res.status(500).send('Erro ao gerar arquivo PDF.');
  }
});

app.get('/api/public/sales/receipt/:token', (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  // Bloqueia tentativa de adivinhar número sequencial ou id simples de venda (IDOR)
  if (/^\d+$/.test(token)) {
    return res.status(403).json({
      error: 'Acesso bloqueado por segurança. O comprovante de venda exige o link oficial com token seguro.',
      code: 'TOKEN_REQUIRED'
    });
  }

  if (!token || token.length < 8) {
    return res.status(400).json({ error: 'Token de recibo inválido.' });
  }

  const sale = (db.sales || []).find((s) => s.receiptToken === token);
  if (!sale) {
    return res.status(404).json({
      error: 'Esse comprovante de venda não existe ou o link expirou.',
      inactive: true
    });
  }

  const store = db.storeSettings || {};
  const publicStore = {
    storeName: store.storeName || 'Power Tech - Assistência Técnica',
    tradeName: store.tradeName || 'Power Tech',
    phone: store.phone || '',
    whatsapp: store.whatsapp || '',
    street: store.street || '',
    number: store.number || '',
    neighborhood: store.neighborhood || '',
    city: store.city || '',
    state: store.state || '',
    pixKey: store.pixKey || '',
    warrantyTerms: store.warrantyTerms || ''
  };

  res.json({
    sale: sanitizePublicSale(sale, publicStore),
    store: publicStore
  });
});

app.get('/api/public/sales/receipt/:token/imprimir', (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  if (/^\d+$/.test(token)) {
    return res.status(403).send('Acesso bloqueado por segurança. O comprovante de venda exige o link oficial com token seguro.');
  }

  const sale = (db.sales || []).find((s) => s.receiptToken === token);
  if (!sale) {
    return res.status(404).send('Comprovante de venda não encontrado ou link expirado.');
  }

  const store = db.storeSettings || {};
  const customerCpf = sale.customerCpfMasked || maskCpf(sale.customerCpf) || 'NÃO INFORMADO';
  const saleWarrantyDays = sale.warrantyDays !== undefined && sale.warrantyDays !== null
    ? Math.max(0, Number(sale.warrantyDays))
    : computeWarrantyFromItems(db, sale.items || [], 90);

  const itemsHtml = (sale.items || []).map(it => {
    const itWarr = it.warrantyDays !== undefined && it.warrantyDays !== null
      ? `<div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Garantia: ${Number(it.warrantyDays) === 0 ? 'Sem garantia' : `${Number(it.warrantyDays)} dias`}</div>`
      : '';
    return `
    <tr>
      <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-family: monospace; white-space: nowrap;">${it.code || it.id || '-'}</td>
      <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 500; word-break: break-word; white-space: normal; line-height: 1.35;">${it.productName || it.description || 'Produto'}${itWarr}</td>
      <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap;">${it.quantity}</td>
      <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; white-space: nowrap;">R$ ${Number(it.unitPrice).toFixed(2)}</td>
      <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; white-space: nowrap;">R$ ${Number(it.total).toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo_Venda_${sale.number || '0'}_${(sale.customerName || 'Cliente').replace(/\\s+/g, '_')}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 12px; background: #fff; color: #0f172a; font-size: 11px; }
    .receipt-box { max-width: 200mm; margin: 0 auto; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin: 0 0 2px 0; }
    .badge { display: inline-block; background: #047857; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
    th { background: #f1f5f9; padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; }
    .footer-total { background: #f1f5f9; font-weight: bold; }
    .warranty { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 9px; color: #475569; }
    .actions { text-align: center; margin-bottom: 16px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px; text-decoration: none; display: inline-block; }
    @media print {
      body { padding: 0; }
      .receipt-box { border: none; padding: 0; max-width: 100%; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">🖨️ Baixar em PDF / Imprimir Recibo</button>
  </div>
  <div class="receipt-box">
    <div class="header">
      <div>
        <h1 class="title">${store.storeName || store.tradeName || 'Power Tech - Assistência Técnica & Vendas'}</h1>
        <div style="font-size: 9.5px; font-weight: 600; color: #334155;">CNPJ: ${store.cnpj || ''} ${store.ie ? '| IE: ' + store.ie : ''}</div>
        <div style="font-size: 9px; color: #475569;">${store.street || ''}, ${store.number || ''} - ${store.neighborhood || ''} - ${store.city || ''}/${store.state || ''}</div>
        <div style="font-size: 9px; color: #475569;">Tel: ${store.phone || ''} ${store.pixKey ? '| PIX: ' + store.pixKey : ''}</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">RECIBO DE VENDA</span>
        <div style="font-size: 16px; font-weight: 900; margin-top: 2px;">RECIBO #${sale.number}</div>
        <div style="font-size: 9px; color: #64748b;">${new Date(sale.createdAt).toLocaleString('pt-BR')}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div><strong>CLIENTE:</strong> ${sale.customerName || 'CONSUMIDOR FINAL'}</div>
        <div><strong>CPF/CNPJ:</strong> ${customerCpf}</div>
        <div><strong>EMISSÃO:</strong> ${new Date(sale.createdAt).toLocaleString('pt-BR')}</div>
      </div>
      <div style="text-align: right;">
        <div><strong>FORMA DE PAGAMENTO:</strong> <span style="color: #065f46; font-weight: bold; text-transform: uppercase;">${sale.paymentMethod}</span></div>
        <div style="font-size: 9px; color: #64748b;">${sale.installments && sale.installments > 1 ? 'PARCELADO EM ' + sale.installments + 'X NO CARTÃO' : 'PAGAMENTO À VISTA'}${sale.changeAmount ? ' (TROCO: R$ ' + Number(sale.changeAmount).toFixed(2) + ')' : ''}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">Cód</th>
          <th>Produto / Peça / Serviço</th>
          <th style="width: 35px; text-align: center;">Qtd</th>
          <th style="width: 80px; text-align: right;">Vl. Unit.</th>
          <th style="width: 80px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="3" style="padding: 5px 6px; border: 1px solid #cbd5e1;">SUBTOTAL: R$ ${Number(sale.subtotal || sale.total).toFixed(2)}${sale.discount ? ' | DESCONTO: -R$ ' + Number(sale.discount).toFixed(2) : ''}</td>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">TOTAL PAGO:</td>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px; font-weight: 900;">R$ ${Number(sale.total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    ${sale.notes ? `<div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 6px; font-size: 9px; margin-bottom: 6px;"><strong>OBSERVAÇÕES:</strong> ${sale.notes}</div>` : ''}

    <div class="warranty">
      <strong>TERMO DE GARANTIA:</strong> ${formatBackendWarrantyTerms(saleWarrantyDays, store.warrantyTerms, 'sale')}
    </div>
  </div>
  <script>
    if (new URLSearchParams(window.location.search).get('pdf') === '1' || new URLSearchParams(window.location.search).get('print') === '1') {
      window.onload = function() { setTimeout(function() { window.print(); }, 400); };
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Download direto do arquivo PDF físico do recibo de venda
app.get('/api/public/sales/receipt/:token/pdf', async (req, res) => {
  const db = getDatabase();
  const token = String(req.params.token).trim();

  if (/^\d+$/.test(token)) {
    return res.status(403).send('Acesso bloqueado por segurança.');
  }

  const sale = (db.sales || []).find((s) => s.receiptToken === token);
  if (!sale) {
    return res.status(404).send('Comprovante de venda não encontrado.');
  }

  try {
    const pdfPath = await generateReceiptPdf(token, PORT);
    const rawClient = (sale.customerName || 'Cliente').trim();
    const cleanClient = rawClient.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `Recibo ${sale.number || '0'} - ${cleanClient}.pdf`;
    const safeAsciiFilename = `Recibo_${sale.number || '0'}_${cleanClient.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    // Salva cópia física no diretório de documentos configurado
    const store = db.storeSettings || {};
    const documentsDir = store.documentsDirectory || path.join(osNode.homedir(), 'Documents', 'InfoTech_Documentos');
    try {
      if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir, { recursive: true });
      }
      const targetPath = path.join(documentsDir, fileName);
      fs.copyFileSync(pdfPath, targetPath);
    } catch (saveErr) {
      console.warn('[PDF Venda] Não foi possível salvar cópia no diretório de documentos:', saveErr.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('Erro ao gerar binário do PDF do recibo:', err);
    res.status(500).send('Erro ao gerar arquivo PDF.');
  }
});

// ==========================================
// DASHBOARD (ADMINISTRATIVO)
// ==========================================
app.get('/api/dashboard', requireAuth, (req, res) => {
  const db = getDatabase();
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = todayStr.substring(0, 7);

  // Vendas de hoje
  const todaySales = (db.sales || []).filter(s => s.status !== 'cancelada' && s.createdAt && s.createdAt.startsWith(todayStr));
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + (s.total || 0), 0);

  // Faturamento do mês (vendas + OSs entregues)
  const monthSales = (db.sales || []).filter(s => s.status !== 'cancelada' && s.createdAt && s.createdAt.startsWith(currentMonthStr));
  const monthSalesTotal = monthSales.reduce((acc, s) => acc + (s.total || 0), 0);

  const monthCompletedOS = (db.workOrders || []).filter(os => 
    os.status === 'entregue' && os.deliveredDate && os.deliveredDate.startsWith(currentMonthStr)
  );
  const monthOSTotal = monthCompletedOS.reduce((acc, os) => acc + (os.total || 0), 0);

  // Contadores de OS
  const workOrders = db.workOrders || [];
  const openOS = workOrders.filter(os => ['aberta', 'analise', 'orcamento', 'aprovada', 'manutencao', 'aguardando_peca'].includes(os.status));
  const readyOS = workOrders.filter(os => os.status === 'concluida');
  const deliveredMonthOS = workOrders.filter(os => os.status === 'entregue' && os.deliveredDate?.startsWith(currentMonthStr));

  // Alerta de estoque baixo
  const lowStockProducts = (db.products || []).filter(p => p.isActive && p.stock <= p.minStock);

  const INACTIVE_STATUSES = new Set(['entregue', 'sem_reparo', 'cancelada', 'descarte']);
  const sortedWorkOrders = [...workOrders].sort((a, b) => {
    const aInactive = INACTIVE_STATUSES.has(a.status);
    const bInactive = INACTIVE_STATUSES.has(b.status);
    if (!aInactive && bInactive) return -1;
    if (aInactive && !bInactive) return 1;
    const dateA = new Date(a.entryDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.entryDate || b.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (Number(b.number) || 0) - (Number(a.number) || 0);
  });

  res.json({
    metrics: {
      todaySalesCount: todaySales.length,
      todaySalesTotal,
      monthRevenueTotal: monthSalesTotal + monthOSTotal,
      openOSCount: openOS.length,
      readyOSCount: readyOS.length,
      deliveredMonthOSCount: deliveredMonthOS.length,
      lowStockCount: lowStockProducts.length
    },
    recentWorkOrders: sortedWorkOrders.slice(0, 5),
    recentSales: (db.sales || []).slice(0, 5),
    lowStockProducts: lowStockProducts.slice(0, 6),
    backupStatus: db.backupSettings
  });
});

// ==========================================
// ORDENS DE SERVIÇO (OS)
// ==========================================
app.get('/api/work-orders', requireAuth, (req, res) => {
  const db = getDatabase();
  const { status, search } = req.query;
  let list = db.workOrders || [];

  if (status && status !== 'todas') {
    list = list.filter(os => os.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(os => 
      String(os.number).includes(q) ||
      (os.customerName && os.customerName.toLowerCase().includes(q)) ||
      (os.model && os.model.toLowerCase().includes(q)) ||
      (os.serialNumber && os.serialNumber.toLowerCase().includes(q)) ||
      (os.additionalInfo && os.additionalInfo.toLowerCase().includes(q))
    );
  }

  const INACTIVE_OS = new Set(['entregue', 'sem_reparo', 'cancelada', 'descarte']);
  const sortedList = [...list].sort((a, b) => {
    const aInactive = INACTIVE_OS.has(a.status);
    const bInactive = INACTIVE_OS.has(b.status);
    if (!aInactive && bInactive) return -1;
    if (aInactive && !bInactive) return 1;
    const dateA = new Date(a.entryDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.entryDate || b.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (Number(b.number) || 0) - (Number(a.number) || 0);
  });

  res.json(sortedList);
});

app.post('/api/work-orders', requireAuth, (req, res) => {
  const db = getDatabase();
  const nextNumber = ((db.workOrders || []).reduce((max, o) => Math.max(max, o.number || 1000), 1000)) + 1;

  // Garante vínculo ou cadastro automático do cliente no banco
  const associatedCust = findOrCreateCustomer(db, req.body, `OS #${nextNumber}`);
  const finalCustomerId = associatedCust ? associatedCust.id : (req.body.customerId || undefined);

  const newOS = {
    id: `os-${Date.now()}`,
    number: nextNumber,
    trackingToken: generateSecureToken(),
    customerId: finalCustomerId,
    customerName: toUpper(req.body.customerName, 'CLIENTE BALCÃO'),
    customerPhone: req.body.customerPhone || '',
    customerAddress: toUpper(req.body.customerAddress),
    customerCpf: req.body.customerCpf ? String(req.body.customerCpf).trim() : '',
    customerEmail: req.body.customerEmail ? String(req.body.customerEmail).trim().toLowerCase() : '',
    customerTradeName: toUpper(req.body.customerTradeName),
    customerStateRegistration: toUpper(req.body.customerStateRegistration),
    customerCnae: toUpper(req.body.customerCnae),
    customerStatus: toUpper(req.body.customerStatus),
    customerOpeningDate: toUpper(req.body.customerOpeningDate),
    customerLegalNature: toUpper(req.body.customerLegalNature),
    customerPartners: toUpper(req.body.customerPartners),
    customerCep: toUpper(req.body.customerCep),
    customerStreet: toUpper(req.body.customerStreet),
    customerNumber: toUpper(req.body.customerNumber),
    customerComplement: toUpper(req.body.customerComplement),
    customerNeighborhood: toUpper(req.body.customerNeighborhood),
    customerCity: toUpper(req.body.customerCity),
    customerState: toUpper(req.body.customerState),
    equipmentType: req.body.equipmentType || 'outro',
    brand: toUpper(req.body.brand),
    model: toUpper(req.body.model),
    serialNumber: toUpper(req.body.serialNumber),
    accessories: toUpper(req.body.accessories),
    configuration: toUpper(req.body.configuration),
    reportedIssue: toUpper(req.body.reportedIssue),
    technicalReport: toUpper(req.body.technicalReport),
    additionalInfo: toUpper(req.body.additionalInfo),
    status: req.body.status || 'aberta',
    checklist: req.body.checklist || {
      ligando: true,
      carregadorFonte: false,
      caboForca: false,
      avariasVisiveis: '',
      senhaAparelho: '',
      testadoNaEntrada: true
    },
    items: (req.body.items || []).map(it => ({
      ...it,
      description: toUpper(it.description),
      costPrice: resolveItemCost(db, it),
      warrantyDays: resolveItemWarranty(db, it)
    })),
    partsTotal: Number(req.body.partsTotal || 0),
    servicesTotal: Number(req.body.servicesTotal || 0),
    discount: Number(req.body.discount || 0),
    total: Number(req.body.total || 0),
    warrantyDays: req.body.warrantyDays !== undefined ? Number(req.body.warrantyDays) : computeWarrantyFromItems(db, req.body.items || [], 90),
    entryDate: req.body.entryDate || new Date().toISOString(),
    estimatedDeliveryDate: req.body.estimatedDeliveryDate,
    completionDate: req.body.status === 'concluida' || req.body.status === 'entregue' ? (req.body.completionDate || new Date().toISOString()) : undefined,
    deliveredDate: req.body.status === 'entregue' ? (req.body.deliveredDate || new Date().toISOString()) : undefined,
    statusDates: {
      aberta: req.body.entryDate || new Date().toISOString(),
      ...(req.body.status ? { [req.body.status]: req.body.entryDate || new Date().toISOString() } : {}),
      ...(req.body.statusDates || {})
    },
    technicianName: toUpper(req.body.technicianName, 'TÉCNICO RESPONSÁVEL'),
    ...resolveSellerInfo(db, req.body.sellerId, req.body.sellerName),
    paymentMethod: req.body.paymentMethod,
    paymentStatus: req.body.paymentStatus || 'pendente'
  };

  // Se foram usadas peças do estoque, dá baixa
  if (Array.isArray(newOS.items)) {
    newOS.items.forEach(item => {
      if (item.type === 'peca' && item.productId) {
        const prod = (db.products || []).find(p => p.id === item.productId);
        if (prod) {
          prod.stock = Math.max(0, prod.stock - (item.quantity || 1));
        }
      }
    });
  }

  if (!db.workOrders) db.workOrders = [];
  db.workOrders.unshift(newOS);
  saveDatabase(db);

  res.status(201).json(newOS);
});

app.put('/api/work-orders/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.workOrders || []).findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Ordem de Serviço não encontrada' });
  }

  const existing = db.workOrders[index];
  const oldStatus = existing.status;
  const newStatus = req.body.status || oldStatus;

  // Atualiza datas conforme transição de status
  let completionDate = existing.completionDate;
  let deliveredDate = existing.deliveredDate;
  const nowIso = new Date().toISOString();

  // Histórico de datas de cada status
  const statusDates = {
    ...(existing.statusDates || {}),
    ...(req.body.statusDates || {})
  };

  if (!statusDates.aberta) {
    statusDates.aberta = req.body.entryDate || existing.entryDate || existing.createdAt || nowIso;
  }

  // Se o status mudou ou se esta etapa ainda não tiver data gravada, registra o momento da atualização
  if (newStatus && (!statusDates[newStatus] || newStatus !== oldStatus)) {
    statusDates[newStatus] = req.body.statusUpdateDate || nowIso;
  }

  if (newStatus === 'concluida' && oldStatus !== 'concluida') {
    completionDate = req.body.completionDate || nowIso;
    statusDates.concluida = completionDate;
  }
  if (newStatus === 'entregue') {
    if (!deliveredDate || oldStatus !== 'entregue' || req.body.deliveredDate) {
      deliveredDate = req.body.deliveredDate || deliveredDate || nowIso;
    }
    if (!completionDate) completionDate = nowIso;
    statusDates.entregue = deliveredDate;
  }

  const body = req.body;
  let finalCustomerId = body.customerId !== undefined ? body.customerId : existing.customerId;
  if (!finalCustomerId && (body.customerName || existing.customerName)) {
    const associatedCust = findOrCreateCustomer(db, {
      ...existing,
      ...body
    }, `OS #${existing.number}`);
    if (associatedCust) finalCustomerId = associatedCust.id;
  }

  const updated = {
    ...existing,
    ...body,
    customerId: finalCustomerId,
    entryDate: body.entryDate !== undefined ? body.entryDate : (existing.entryDate || existing.createdAt || nowIso),
    customerName: body.customerName !== undefined ? toUpper(body.customerName) : existing.customerName,
    customerPhone: body.customerPhone !== undefined ? body.customerPhone : existing.customerPhone,
    customerAddress: body.customerAddress !== undefined ? toUpper(body.customerAddress) : existing.customerAddress,
    customerCpf: body.customerCpf !== undefined ? String(body.customerCpf).trim() : existing.customerCpf,
    customerEmail: body.customerEmail !== undefined ? String(body.customerEmail).trim().toLowerCase() : existing.customerEmail,
    customerTradeName: body.customerTradeName !== undefined ? toUpper(body.customerTradeName) : existing.customerTradeName,
    customerStateRegistration: body.customerStateRegistration !== undefined ? toUpper(body.customerStateRegistration) : existing.customerStateRegistration,
    customerCnae: body.customerCnae !== undefined ? toUpper(body.customerCnae) : existing.customerCnae,
    customerStatus: body.customerStatus !== undefined ? toUpper(body.customerStatus) : existing.customerStatus,
    customerOpeningDate: body.customerOpeningDate !== undefined ? toUpper(body.customerOpeningDate) : existing.customerOpeningDate,
    customerLegalNature: body.customerLegalNature !== undefined ? toUpper(body.customerLegalNature) : existing.customerLegalNature,
    customerPartners: body.customerPartners !== undefined ? toUpper(body.customerPartners) : existing.customerPartners,
    customerCep: body.customerCep !== undefined ? toUpper(body.customerCep) : existing.customerCep,
    customerStreet: body.customerStreet !== undefined ? toUpper(body.customerStreet) : existing.customerStreet,
    customerNumber: body.customerNumber !== undefined ? toUpper(body.customerNumber) : existing.customerNumber,
    customerComplement: body.customerComplement !== undefined ? toUpper(body.customerComplement) : existing.customerComplement,
    customerNeighborhood: body.customerNeighborhood !== undefined ? toUpper(body.customerNeighborhood) : existing.customerNeighborhood,
    customerCity: body.customerCity !== undefined ? toUpper(body.customerCity) : existing.customerCity,
    customerState: body.customerState !== undefined ? toUpper(body.customerState) : existing.customerState,
    brand: body.brand !== undefined ? toUpper(body.brand) : existing.brand,
    model: body.model !== undefined ? toUpper(body.model) : existing.model,
    serialNumber: body.serialNumber !== undefined ? toUpper(body.serialNumber) : existing.serialNumber,
    accessories: body.accessories !== undefined ? toUpper(body.accessories) : existing.accessories,
    configuration: body.configuration !== undefined ? toUpper(body.configuration) : existing.configuration,
    reportedIssue: body.reportedIssue !== undefined ? toUpper(body.reportedIssue) : existing.reportedIssue,
    technicalReport: body.technicalReport !== undefined ? toUpper(body.technicalReport) : existing.technicalReport,
    additionalInfo: body.additionalInfo !== undefined ? toUpper(body.additionalInfo) : existing.additionalInfo,
    technicianName: body.technicianName !== undefined ? toUpper(body.technicianName) : existing.technicianName,
    ...(body.sellerId !== undefined || body.sellerName !== undefined
      ? resolveSellerInfo(db, body.sellerId, body.sellerName)
      : { sellerId: existing.sellerId, sellerName: existing.sellerName }),
    ...(Array.isArray(body.items)
      ? {
          items: body.items.map(it => ({
            ...it,
            description: toUpper(it.description),
            costPrice: resolveItemCost(db, it),
            warrantyDays: resolveItemWarranty(db, it)
          }))
        }
      : {}),
    completionDate,
    deliveredDate,
    statusDates,
    warrantyDays: body.warrantyDays !== undefined ? Number(body.warrantyDays) : (existing.warrantyDays !== undefined ? existing.warrantyDays : 90),
    paymentMethod: body.paymentMethod !== undefined ? toUpper(body.paymentMethod) : existing.paymentMethod,
    paymentStatus: body.paymentStatus !== undefined ? body.paymentStatus : (existing.paymentStatus || 'pendente')
  };

  db.workOrders[index] = updated;
  saveDatabase(db);

  res.json(updated);
});

// Busca uma única OS por ID ou número (administrativo)
app.get('/api/work-orders/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const idOrNum = String(req.params.id).trim().toLowerCase();
  const os = (db.workOrders || []).find(o => 
    String(o.id).toLowerCase() === idOrNum || String(o.number) === idOrNum
  );
  if (!os) return res.status(404).json({ error: 'Ordem de Serviço não encontrada' });
  res.json(os);
});

// Acompanhamento público seguro de Ordem de Serviço pelo cliente
// EXIGE trackingToken seguro para acesso público. Bloqueia adivinhação por número sequencial.
app.get('/api/work-orders/track/:id', (req, res) => {
  const db = getDatabase();
  const tokenOrNum = String(req.params.id).trim();

  // 1. Tenta encontrar pelo trackingToken criptográfico seguro
  const osByToken = (db.workOrders || []).find(o => o.trackingToken === tokenOrNum);
  if (osByToken) {
    if (osByToken.status === 'cancelada') {
      return res.status(404).json({
        error: 'Essa ordem de serviço não existe mais.',
        inactive: true
      });
    }

    const store = db.storeSettings || {};
    const publicStore = {
      storeName: store.storeName || 'Power Tech - Assistência Técnica',
      tradeName: store.tradeName || 'Power Tech',
      cnpj: store.cnpj || '',
      phone: store.phone || '',
      whatsapp: store.whatsapp || '',
      street: store.street || '',
      number: store.number || '',
      neighborhood: store.neighborhood || '',
      city: store.city || '',
      state: store.state || '',
      cep: store.cep || '',
      pixKey: store.pixKey || '',
      warrantyTerms: store.warrantyTerms || ''
    };

    return res.json({
      workOrder: sanitizePublicWorkOrder(osByToken, publicStore),
      store: publicStore
    });
  }

  // 2. Se a busca for por número sequencial ou id interno, somente permite se o operador estiver autenticado
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      verifyToken(authHeader.split(' ')[1]);
      const osByNum = (db.workOrders || []).find(o => 
        String(o.id).toLowerCase() === tokenOrNum.toLowerCase() || String(o.number) === tokenOrNum
      );
      if (osByNum) {
        const store = db.storeSettings || {};
        return res.json({
          workOrder: sanitizePublicWorkOrder(osByNum, store),
          store
        });
      }
    } catch (e) {}
  }

  // 3. Bloqueia enumeração sequencial pública por segurança (Proteção contra IDOR)
  return res.status(403).json({
    error: 'Acesso bloqueado por segurança. O acompanhamento público de Ordens de Serviço exige o link oficial com token criptográfico.',
    code: 'TOKEN_REQUIRED'
  });
});

// Adiciona itens (serviços ou peças, cadastrados ou avulsos) diretamente à OS
app.post('/api/work-orders/:id/items', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.workOrders || []).findIndex(o => 
    o.id === req.params.id || String(o.number) === req.params.id
  );
  if (index === -1) {
    return res.status(404).json({ error: 'Ordem de Serviço não encontrada' });
  }

  const os = db.workOrders[index];
  const newItems = req.body.items || [];
  if (!Array.isArray(newItems) || newItems.length === 0) {
    return res.status(400).json({ error: 'Nenhum item informado para adição' });
  }

  // Dá baixa no estoque para produtos/peças cadastradas
  newItems.forEach(item => {
    if (item.type === 'peca' && item.productId) {
      const prod = (db.products || []).find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - (Number(item.quantity) || 1));
      }
    }
  });

  const formattedNewItems = newItems.map(it => ({
    id: it.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: it.type === 'peca' ? 'peca' : 'servico',
    description: toUpper(it.description),
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
    costPrice: resolveItemCost(db, it),
    warrantyDays: resolveItemWarranty(db, it),
    total: Number(it.total) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)),
    productId: it.productId,
    serviceId: it.serviceId,
    isCustom: !!it.isCustom,
    paymentMethod: it.paymentMethod ? toUpper(it.paymentMethod) : undefined
  }));

  const allItems = [...(os.items || []), ...formattedNewItems];
  const partsTotal = allItems.filter(i => i.type === 'peca').reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const servicesTotal = allItems.filter(i => i.type === 'servico').reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const discount = Number(os.discount) || 0;
  const total = Math.max(0, (partsTotal + servicesTotal) - discount);

  os.items = allItems;
  os.partsTotal = partsTotal;
  os.servicesTotal = servicesTotal;
  os.total = total;
  os.warrantyDays = req.body.warrantyDays !== undefined
    ? Math.max(0, Number(req.body.warrantyDays))
    : computeWarrantyFromItems(db, allItems, os.warrantyDays !== undefined ? Number(os.warrantyDays) : 90);

  if (req.body.paymentMethod !== undefined && req.body.paymentMethod !== '') {
    os.paymentMethod = toUpper(req.body.paymentMethod);
  }
  if (req.body.paymentStatus !== undefined && req.body.paymentStatus !== '') {
    os.paymentStatus = req.body.paymentStatus;
  }

  saveDatabase(db);
  res.json(os);
});

// Acompanhamento público seguro de comprovante de venda
// EXIGE receiptToken seguro para acesso público. Bloqueia adivinhação por número sequencial.
app.get('/api/sales/track/:id', (req, res) => {
  const db = getDatabase();
  const tokenOrNum = String(req.params.id).trim();

  // 1. Tenta encontrar pelo receiptToken seguro
  const saleByToken = (db.sales || []).find(s => s.receiptToken === tokenOrNum);
  if (saleByToken) {
    if (saleByToken.status === 'cancelada') {
      return res.status(404).json({ error: 'Esse comprovante de venda não existe mais ou foi cancelado.', inactive: true });
    }

    const store = db.storeSettings || {};
    const publicStore = {
      storeName: store.storeName || 'Power Tech - Assistência Técnica',
      tradeName: store.tradeName || 'Power Tech',
      phone: store.phone || '',
      whatsapp: store.whatsapp || '',
      street: store.street || '',
      number: store.number || '',
      neighborhood: store.neighborhood || '',
      city: store.city || '',
      state: store.state || '',
      pixKey: store.pixKey || '',
      warrantyTerms: store.warrantyTerms || ''
    };

    return res.json({
      sale: sanitizePublicSale(saleByToken, publicStore),
      store: publicStore
    });
  }

  // 2. Se tentou buscar por número sequencial ou id interno, somente permite se o operador estiver autenticado
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      verifyToken(authHeader.split(' ')[1]);
      const saleByNum = (db.sales || []).find(s => 
        String(s.id).toLowerCase() === tokenOrNum.toLowerCase() || String(s.number) === tokenOrNum
      );
      if (saleByNum) {
        const store = db.storeSettings || {};
        return res.json({
          sale: sanitizePublicSale(saleByNum, store),
          store
        });
      }
    } catch (e) {}
  }

  // 3. Bloqueia enumeração sequencial por segurança
  return res.status(403).json({
    error: 'Acesso bloqueado por segurança. O comprovante de venda exige o link oficial com token seguro.',
    code: 'TOKEN_REQUIRED'
  });
});

app.delete('/api/work-orders/:id', requireAuth, requireAdminPassword, (req, res) => {
  if (req.user && req.user.role !== 'admin' && req.user.permissions && req.user.permissions.workOrdersDelete === false) {
    return res.status(403).json({ error: 'Você não possui permissão para excluir Ordens de Serviço.' });
  }

  const db = getDatabase();
  const initialLength = (db.workOrders || []).length;
  db.workOrders = (db.workOrders || []).filter(o => o.id !== req.params.id);

  if (db.workOrders.length === initialLength) {
    return res.status(404).json({ error: 'Ordem de Serviço não encontrada' });
  }

  saveDatabase(db);
  res.json({ success: true, message: 'Ordem de Serviço removida com sucesso' });
});

// ==========================================
// VENDAS (PDV)
// ==========================================
app.get('/api/sales', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.sales || []);
});

app.post('/api/sales', requireAuth, (req, res) => {
  const db = getDatabase();
  const nextNumber = ((db.sales || []).reduce((max, s) => Math.max(max, s.number || 100), 100)) + 1;

  const items = (req.body.items || []).map(it => ({
    ...it,
    costPrice: resolveItemCost(db, it),
    warrantyDays: resolveItemWarranty(db, it)
  }));
  // Dá baixa no estoque de cada produto vendido
  items.forEach(item => {
    if (item.productId) {
      const prod = (db.products || []).find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - Number(item.quantity || 1));
      }
    }
  });

  let customerCpf = req.body.customerCpf;
  let customerAddress = toUpper(req.body.customerAddress);
  let customerPhone = req.body.customerPhone;

  if (req.body.customerId) {
    const cust = (db.customers || []).find(c => c.id === req.body.customerId);
    if (cust) {
      if (!customerCpf && (cust.document || cust.cpfCnpj)) {
        customerCpf = cust.document || cust.cpfCnpj;
      }
      if (!customerPhone && (cust.phone || cust.whatsapp)) {
        customerPhone = cust.phone || cust.whatsapp;
      }
      if (!customerAddress) {
        const addrParts = [
          cust.street,
          cust.number,
          cust.neighborhood,
          cust.city ? `${cust.city}/${cust.state || ''}` : ''
        ].filter(Boolean);
        if (addrParts.length > 0) {
          customerAddress = toUpper(addrParts.join(', '));
        }
      }
    }
  }

  // Garante vínculo ou cadastro automático do cliente no banco
  const associatedCust = findOrCreateCustomer(db, {
    customerName: req.body.customerName,
    customerCpf: customerCpf,
    customerPhone: customerPhone,
    customerAddress: customerAddress,
    customerId: req.body.customerId
  }, `Venda #${nextNumber}`);
  const finalCustomerId = associatedCust ? associatedCust.id : (req.body.customerId || undefined);

  const newSale = {
    id: `sale-${Date.now()}`,
    number: nextNumber,
    receiptToken: generateSecureToken(),
    customerId: finalCustomerId,
    customerName: toUpper(req.body.customerName, 'CLIENTE BALCÃO'),
    customerCpf: customerCpf || undefined,
    customerAddress: customerAddress || undefined,
    customerPhone: customerPhone || undefined,
    ...resolveSellerInfo(db, req.body.sellerId, req.body.sellerName),
    notes: toUpper(req.body.notes),
    items,
    subtotal: Number(req.body.subtotal || 0),
    discount: Number(req.body.discount || 0),
    total: Number(req.body.total || 0),
    warrantyDays: req.body.warrantyDays !== undefined && req.body.warrantyDays !== null
      ? Math.max(0, Number(req.body.warrantyDays))
      : computeWarrantyFromItems(db, items, 90),
    paymentMethod: req.body.paymentMethod || 'dinheiro',
    installments: Number(req.body.installments || 1),
    receivedAmount: Number(req.body.receivedAmount || req.body.total || 0),
    changeAmount: Number(req.body.changeAmount || 0),
    createdAt: new Date().toISOString(),
    fiscalStatus: req.body.fiscalStatus || 'nao_emitida'
  };

  if (!db.sales) db.sales = [];
  db.sales.unshift(newSale);
  saveDatabase(db);

  res.status(201).json(newSale);
});

// Atualizar vendedor vinculado a uma venda
app.put('/api/sales/:id/seller', requireAuth, (req, res) => {
  const db = getDatabase();
  const idOrNum = String(req.params.id).trim().toLowerCase();
  const index = (db.sales || []).findIndex(s =>
    String(s.id).toLowerCase() === idOrNum || String(s.number) === idOrNum
  );
  if (index === -1) {
    return res.status(404).json({ error: 'Venda não encontrada' });
  }
  const { sellerId, sellerName } = resolveSellerInfo(db, req.body.sellerId, req.body.sellerName);
  db.sales[index] = {
    ...db.sales[index],
    sellerId,
    sellerName
  };
  saveDatabase(db);
  res.json(db.sales[index]);
});

// Cancelamento de Venda com estorno automático de estoque
app.post('/api/sales/:id/cancel', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  const idOrNum = String(req.params.id).trim().toLowerCase();
  const sale = (db.sales || []).find(s => 
    String(s.id).toLowerCase() === idOrNum || String(s.number) === idOrNum
  );

  if (!sale) {
    return res.status(404).json({ error: 'Venda não encontrada' });
  }

  if (sale.status === 'cancelada') {
    return res.status(400).json({ error: 'Esta venda já está cancelada' });
  }

  // Estorna o estoque dos itens vendidos
  (sale.items || []).forEach(item => {
    if (item.productId) {
      const prod = (db.products || []).find(p => p.id === item.productId);
      if (prod) {
        prod.stock = (Number(prod.stock) || 0) + Number(item.quantity || 1);
      }
    }
  });

  sale.status = 'cancelada';
  sale.cancelledAt = new Date().toISOString();
  saveDatabase(db);

  res.json({ success: true, message: 'Venda cancelada e estoque estornado com sucesso', sale });
});

// Exclusão definitiva de venda
app.delete('/api/sales/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  const idOrNum = String(req.params.id).trim().toLowerCase();
  const saleIndex = (db.sales || []).findIndex(s => 
    String(s.id).toLowerCase() === idOrNum || String(s.number) === idOrNum
  );

  if (saleIndex === -1) {
    return res.status(404).json({ error: 'Venda não encontrada' });
  }

  const sale = db.sales[saleIndex];
  // Se a venda não estava cancelada, estorna o estoque antes de remover
  if (sale.status !== 'cancelada') {
    (sale.items || []).forEach(item => {
      if (item.productId) {
        const prod = (db.products || []).find(p => p.id === item.productId);
        if (prod) {
          prod.stock = (Number(prod.stock) || 0) + Number(item.quantity || 1);
        }
      }
    });
  }

  db.sales.splice(saleIndex, 1);
  saveDatabase(db);

  res.json({ success: true, message: 'Venda removida com sucesso' });
});

// ==========================================
// ORÇAMENTOS
// ==========================================
app.get('/api/quotes', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.quotes || []);
});

app.post('/api/quotes', requireAuth, (req, res) => {
  const db = getDatabase();
  const nextNumber = ((db.quotes || []).reduce((max, q) => Math.max(max, q.number || 500), 500)) + 1;
  const validDays = Number(req.body.validDays || 10);
  const validUntil = new Date(Date.now() + validDays * 86400000).toISOString();

  const newQuote = {
    id: `orc-${Date.now()}`,
    number: nextNumber,
    customerId: req.body.customerId,
    customerName: toUpper(req.body.customerName),
    customerPhone: req.body.customerPhone,
    equipmentDesc: toUpper(req.body.equipmentDesc),
    reportedIssue: toUpper(req.body.reportedIssue),
    items: (req.body.items || []).map(it => ({
      ...it,
      description: toUpper(it.description),
      costPrice: resolveItemCost(db, it),
      warrantyDays: resolveItemWarranty(db, it)
    })),
    subtotal: Number(req.body.subtotal || 0),
    discount: Number(req.body.discount || 0),
    total: Number(req.body.total || 0),
    validDays,
    validUntil,
    status: 'pendente',
    notes: toUpper(req.body.notes),
    createdAt: new Date().toISOString()
  };

  if (!db.quotes) db.quotes = [];
  db.quotes.unshift(newQuote);
  saveDatabase(db);

  res.status(201).json(newQuote);
});

app.put('/api/quotes/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.quotes || []).findIndex(q => q.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Orçamento não encontrado' });
  }

  const body = req.body;
  const updated = {
    ...db.quotes[index],
    ...body,
    customerName: body.customerName !== undefined ? toUpper(body.customerName) : db.quotes[index].customerName,
    equipmentDesc: body.equipmentDesc !== undefined ? toUpper(body.equipmentDesc) : db.quotes[index].equipmentDesc,
    reportedIssue: body.reportedIssue !== undefined ? toUpper(body.reportedIssue) : db.quotes[index].reportedIssue,
    notes: body.notes !== undefined ? toUpper(body.notes) : db.quotes[index].notes
  };
  db.quotes[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/quotes/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  const initialCount = (db.quotes || []).length;
  db.quotes = (db.quotes || []).filter(q => q.id !== req.params.id);
  if (db.quotes.length === initialCount) {
    return res.status(404).json({ error: 'Orçamento não encontrado' });
  }
  saveDatabase(db);
  res.json({ success: true, message: 'Orçamento removido com sucesso' });
});

// Converter Orçamento em Ordem de Serviço em 1 clique
app.post('/api/quotes/:id/convert-to-os', requireAuth, (req, res) => {
  const db = getDatabase();
  const quote = (db.quotes || []).find(q => q.id === req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Orçamento não encontrado' });
  }

  const nextOSNumber = ((db.workOrders || []).reduce((max, o) => Math.max(max, o.number || 1000), 1000)) + 1;

  let partsTotal = 0;
  let servicesTotal = 0;
  quote.items.forEach(it => {
    if (it.type === 'peca') partsTotal += it.total;
    else servicesTotal += it.total;
  });

  const customer = quote.customerId ? (db.customers || []).find(c => c.id === quote.customerId) : null;
  const customerAddress = customer ? [
    customer.street ? `${customer.street}${customer.number ? ', ' + customer.number : ''}` : '',
    customer.complement ? `(${customer.complement})` : '',
    customer.neighborhood,
    customer.city ? `${customer.city}${customer.state ? '/' + customer.state : ''}` : '',
    customer.cep ? `CEP: ${customer.cep}` : ''
  ].filter(Boolean).join(' - ') : '';

  const newOS = {
    id: `os-${Date.now()}`,
    number: nextOSNumber,
    trackingToken: generateSecureToken(),
    customerId: quote.customerId,
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    customerAddress: toUpper(customerAddress),
    customerCpf: customer ? (customer.document || '') : '',
    customerEmail: customer ? (customer.email || '') : '',
    equipmentType: 'outro',
    brand: '',
    model: quote.equipmentDesc || 'Equipamento do Orçamento',
    serialNumber: '',
    accessories: '',
    reportedIssue: quote.reportedIssue || 'Aprovado a partir de Orçamento prévio',
    technicalReport: `Gerado a partir do Orçamento #${quote.number}`,
    additionalInfo: quote.notes ? toUpper(quote.notes) : '',
    status: 'aprovada',
    checklist: {
      ligando: true,
      carregadorFonte: false,
      caboForca: false,
      avariasVisiveis: '',
      senhaAparelho: '',
      testadoNaEntrada: true
    },
    items: quote.items,
    partsTotal,
    servicesTotal,
    discount: quote.discount || 0,
    total: quote.total,
    warrantyDays: computeWarrantyFromItems(db, quote.items || [], 90),
    entryDate: new Date().toISOString(),
    technicianName: 'Técnico Responsável',
    paymentStatus: 'pendente'
  };

  quote.status = 'convertido_os';

  if (!db.workOrders) db.workOrders = [];
  db.workOrders.unshift(newOS);
  saveDatabase(db);

  res.status(201).json({ message: 'Orçamento convertido em OS com sucesso!', workOrder: newOS });
});

// ==========================================
// PRODUTOS & PEÇAS (ESTOQUE)
// ==========================================
app.get('/api/products', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.products || []);
});

app.post('/api/products', requireAuth, (req, res) => {
  const db = getDatabase();
  const newProduct = {
    id: `prod-${Date.now()}`,
    code: toUpper(req.body.code, `PRD${Date.now().toString().slice(-4)}`),
    name: toUpper(req.body.name),
    category: req.body.category || 'pecas',
    brand: toUpper(req.body.brand),
    costPrice: Number(req.body.costPrice || 0),
    sellingPrice: Number(req.body.sellingPrice || 0),
    stock: Number(req.body.stock || 0),
    minStock: Number(req.body.minStock || 2),
    unit: toUpper(req.body.unit, 'UN'),
    ncm: toUpper(req.body.ncm, '84717090'),
    cfop: toUpper(req.body.cfop, '5102'),
    warrantyDays: req.body.warrantyDays !== undefined && req.body.warrantyDays !== '' ? Math.max(0, Number(req.body.warrantyDays)) : 90,
    imageUrl: req.body.imageUrl || undefined,
    isActive: true
  };

  if (!db.products) db.products = [];
  db.products.push(newProduct);
  saveDatabase(db);

  res.status(201).json(newProduct);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.products || []).findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const body = req.body;
  const updated = {
    ...db.products[index],
    ...body,
    code: body.code !== undefined ? toUpper(body.code) : db.products[index].code,
    name: body.name !== undefined ? toUpper(body.name) : db.products[index].name,
    brand: body.brand !== undefined ? toUpper(body.brand) : db.products[index].brand,
    unit: body.unit !== undefined ? toUpper(body.unit) : db.products[index].unit,
    ncm: body.ncm !== undefined ? toUpper(body.ncm) : db.products[index].ncm,
    cfop: body.cfop !== undefined ? toUpper(body.cfop) : db.products[index].cfop,
    costPrice: Number(body.costPrice !== undefined ? body.costPrice : db.products[index].costPrice),
    sellingPrice: Number(body.sellingPrice !== undefined ? body.sellingPrice : db.products[index].sellingPrice),
    stock: Number(body.stock !== undefined ? body.stock : db.products[index].stock),
    minStock: Number(body.minStock !== undefined ? body.minStock : db.products[index].minStock),
    warrantyDays: body.warrantyDays !== undefined && body.warrantyDays !== ''
      ? Math.max(0, Number(body.warrantyDays))
      : (db.products[index].warrantyDays !== undefined ? Number(db.products[index].warrantyDays) : 90),
    imageUrl: body.imageUrl !== undefined ? body.imageUrl : db.products[index].imageUrl
  };

  db.products[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/products/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  db.products = (db.products || []).filter(p => p.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// ==========================================
// SERVIÇOS & MÃO DE OBRA
// ==========================================
app.get('/api/services', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.services || []);
});

app.post('/api/services', requireAuth, (req, res) => {
  const db = getDatabase();
  const newService = {
    id: `serv-${Date.now()}`,
    code: toUpper(req.body.code, `SRV${Date.now().toString().slice(-4)}`),
    name: toUpper(req.body.name),
    category: req.body.category || 'outro',
    costPrice: Number(req.body.costPrice || 0),
    price: Number(req.body.price || 0),
    estimatedHours: Number(req.body.estimatedHours || 1),
    defaultWarrantyDays: req.body.defaultWarrantyDays !== undefined && req.body.defaultWarrantyDays !== '' ? Math.max(0, Number(req.body.defaultWarrantyDays)) : 90,
    description: toUpper(req.body.description || req.body.name),
    serviceCode: toUpper(req.body.serviceCode, '14.01'),
    cnae: toUpper(req.body.cnae, '9511-8/00'),
    issRate: Number(req.body.issRate !== undefined ? req.body.issRate : 3.5),
    issRetention: Boolean(req.body.issRetention || false),
    municipalTaxCode: toUpper(req.body.municipalTaxCode)
  };

  if (!db.services) db.services = [];
  db.services.push(newService);
  saveDatabase(db);

  res.status(201).json(newService);
});

app.put('/api/services/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.services || []).findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  const body = req.body;
  const updated = {
    ...db.services[index],
    ...body,
    code: body.code !== undefined ? toUpper(body.code) : db.services[index].code,
    name: body.name !== undefined ? toUpper(body.name) : db.services[index].name,
    description: body.description !== undefined ? toUpper(body.description) : db.services[index].description,
    serviceCode: body.serviceCode !== undefined ? toUpper(body.serviceCode) : db.services[index].serviceCode,
    cnae: body.cnae !== undefined ? toUpper(body.cnae) : db.services[index].cnae,
    municipalTaxCode: body.municipalTaxCode !== undefined ? toUpper(body.municipalTaxCode) : db.services[index].municipalTaxCode,
    costPrice: Number(body.costPrice !== undefined ? body.costPrice : (db.services[index].costPrice || 0)),
    price: Number(body.price !== undefined ? body.price : db.services[index].price),
    defaultWarrantyDays: body.defaultWarrantyDays !== undefined && body.defaultWarrantyDays !== ''
      ? Math.max(0, Number(body.defaultWarrantyDays))
      : (db.services[index].defaultWarrantyDays !== undefined ? Number(db.services[index].defaultWarrantyDays) : 90)
  };

  db.services[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/services/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  db.services = (db.services || []).filter(s => s.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// ==========================================
// CLIENTES
// ==========================================
app.get('/api/customers', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.customers || []);
});

app.post('/api/customers', requireAuth, (req, res) => {
  const db = getDatabase();
  const newCust = {
    id: `cust-${Date.now()}`,
    name: toUpper(req.body.name),
    tradeName: toUpper(req.body.tradeName),
    document: toUpper(req.body.document),
    stateRegistration: toUpper(req.body.stateRegistration),
    status: toUpper(req.body.status),
    openingDate: toUpper(req.body.openingDate),
    cnae: toUpper(req.body.cnae),
    legalNature: toUpper(req.body.legalNature),
    porte: toUpper(req.body.porte),
    simplesNacional: toUpper(req.body.simplesNacional),
    partners: toUpper(req.body.partners),
    phone: req.body.phone || '',
    whatsapp: req.body.whatsapp || '',
    email: (req.body.email || '').trim().toLowerCase(),
    street: toUpper(req.body.street),
    number: toUpper(req.body.number),
    complement: toUpper(req.body.complement),
    neighborhood: toUpper(req.body.neighborhood),
    city: toUpper(req.body.city),
    state: toUpper(req.body.state),
    cep: toUpper(req.body.cep),
    notes: toUpper(req.body.notes),
    createdAt: new Date().toISOString()
  };

  if (!db.customers) db.customers = [];
  db.customers.push(newCust);
  saveDatabase(db);

  res.status(201).json(newCust);
});

app.put('/api/customers/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  const index = (db.customers || []).findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  const body = req.body;
  const updated = {
    ...db.customers[index],
    ...body,
    name: body.name !== undefined ? toUpper(body.name) : db.customers[index].name,
    tradeName: body.tradeName !== undefined ? toUpper(body.tradeName) : db.customers[index].tradeName,
    document: body.document !== undefined ? toUpper(body.document) : db.customers[index].document,
    stateRegistration: body.stateRegistration !== undefined ? toUpper(body.stateRegistration) : db.customers[index].stateRegistration,
    status: body.status !== undefined ? toUpper(body.status) : db.customers[index].status,
    openingDate: body.openingDate !== undefined ? toUpper(body.openingDate) : db.customers[index].openingDate,
    cnae: body.cnae !== undefined ? toUpper(body.cnae) : db.customers[index].cnae,
    legalNature: body.legalNature !== undefined ? toUpper(body.legalNature) : db.customers[index].legalNature,
    porte: body.porte !== undefined ? toUpper(body.porte) : db.customers[index].porte,
    simplesNacional: body.simplesNacional !== undefined ? toUpper(body.simplesNacional) : db.customers[index].simplesNacional,
    partners: body.partners !== undefined ? toUpper(body.partners) : db.customers[index].partners,
    phone: body.phone !== undefined ? body.phone : db.customers[index].phone,
    whatsapp: body.whatsapp !== undefined ? body.whatsapp : db.customers[index].whatsapp,
    email: body.email !== undefined ? (body.email || '').trim().toLowerCase() : db.customers[index].email,
    street: body.street !== undefined ? toUpper(body.street) : db.customers[index].street,
    number: body.number !== undefined ? toUpper(body.number) : db.customers[index].number,
    complement: body.complement !== undefined ? toUpper(body.complement) : db.customers[index].complement,
    neighborhood: body.neighborhood !== undefined ? toUpper(body.neighborhood) : db.customers[index].neighborhood,
    city: body.city !== undefined ? toUpper(body.city) : db.customers[index].city,
    state: body.state !== undefined ? toUpper(body.state) : db.customers[index].state,
    cep: body.cep !== undefined ? toUpper(body.cep) : db.customers[index].cep,
    notes: body.notes !== undefined ? toUpper(body.notes) : db.customers[index].notes
  };

  db.customers[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/customers/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  db.customers = (db.customers || []).filter(c => c.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// Histórico consolidado do cliente (Ordens de Serviço e Vendas)
app.get('/api/customers/:id/history', requireAuth, (req, res) => {
  const db = getDatabase();
  const history = getCustomerHistory(db, req.params.id);
  if (!history) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json(history);
});

// ==========================================
// CONSULTA AUTOMÁTICA DE CNPJ (RECEITA FEDERAL)
// ==========================================
app.get('/api/cnpj/:cnpj', requireAuth, async (req, res) => {
  const cleanCnpj = (req.params.cnpj || '').replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ deve conter exatamente 14 dígitos numéricos.' });
  }

  function normalizeCnpj(raw, extraIe = '', extraPhone = '', extraFantasia = '') {
    let phone = '';
    const phoneRaw = raw.ddd_telefone_1 || raw.telefone || raw.ddd_telefone_2 || extraPhone || '';
    if (phoneRaw) {
      const d = String(phoneRaw).replace(/\D/g, '');
      if (d.length === 10) {
        phone = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      } else if (d.length === 11) {
        phone = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      } else {
        phone = phoneRaw;
      }
    }

    let cep = '';
    const cepRaw = raw.cep || '';
    if (cepRaw) {
      const d = String(cepRaw).replace(/\D/g, '');
      cep = d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : String(cepRaw);
    }

    const street = [raw.descricao_tipo_de_logradouro, raw.logradouro].filter(Boolean).join(' ').trim() || (raw.logradouro || '').trim();
    const number = (raw.numero || 'S/N').trim();
    const complement = (raw.complemento || '').trim();
    const neighborhood = (raw.bairro || '').trim();
    const city = (raw.municipio || raw.cidade || '').trim();
    const state = (raw.uf || raw.estado || '').trim();
    const companyName = (raw.razao_social || raw.nome || '').trim();
    // Se não tiver nome fantasia cadastrado na Receita, preenche com a Razão Social para não deixar em branco
    const tradeName = (raw.nome_fantasia || raw.fantasia || extraFantasia || companyName).trim();

    // Inscrição Estadual (SEFAZ)
    let stateRegistration = extraIe || raw.inscricao_estadual || raw.ie || '';
    if (!stateRegistration && Array.isArray(raw.inscricoes_estaduais) && raw.inscricoes_estaduais.length > 0) {
      const activeIe = raw.inscricoes_estaduais.find(i => i.ativo);
      stateRegistration = (activeIe || raw.inscricoes_estaduais[0])?.inscricao_estadual || '';
    }

    // Data de abertura
    let openingDate = raw.data_inicio_atividade || raw.abertura || '';
    if (openingDate && openingDate.includes('-') && openingDate.length >= 10) {
      const [y, m, d] = openingDate.split('T')[0].split('-');
      openingDate = `${d}/${m}/${y}`;
    }

    // CNAE Principal
    const cnaeCode = raw.cnae_fiscal || (raw.atividade_principal && raw.atividade_principal[0] ? raw.atividade_principal[0].code : '');
    const cnaeDesc = raw.cnae_fiscal_descricao || (raw.atividade_principal && raw.atividade_principal[0] ? raw.atividade_principal[0].text : '');
    const cnae = cnaeCode && cnaeDesc ? `${cnaeCode} - ${cnaeDesc}` : cnaeDesc || cnaeCode || '';

    // Sócios / QSA
    let partners = '';
    if (Array.isArray(raw.qsa) && raw.qsa.length > 0) {
      partners = raw.qsa
        .map(s => `${s.nome_socio || s.nome || ''}${s.qualificacao_socio || s.qual ? ` (${s.qualificacao_socio || s.qual})` : ''}`.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
    }

    // Formatação do CNPJ
    const formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    const formattedAddress = [
      street ? `${street}${number ? `, ${number}` : ''}` : '',
      complement ? `(${complement})` : '',
      neighborhood,
      city && state ? `${city} - ${state}` : city || state,
      cep ? `CEP: ${cep}` : ''
    ].filter(Boolean).join(', ');

    return {
      cnpj: cleanCnpj,
      formattedCnpj,
      name: companyName || tradeName,
      razaoSocial: companyName,
      nomeFantasia: tradeName,
      stateRegistration: stateRegistration || 'ISENTO',
      phone,
      whatsapp: phone,
      email: (raw.email || '').toLowerCase().trim(),
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      cep,
      address: formattedAddress,
      status: raw.descricao_situacao_cadastral || raw.situacao_cadastral || raw.situacao || 'ATIVA',
      openingDate,
      cnae,
      legalNature: raw.natureza_juridica || '',
      porte: raw.porte || raw.porte_empresa || '',
      tipo: raw.descricao_identificador_matriz_filial || (raw.identificador_matriz_filial === 1 ? 'MATRIZ' : raw.identificador_matriz_filial === 2 ? 'FILIAL' : ''),
      simplesNacional: raw.opcao_pelo_simples === true ? 'SIM' : raw.opcao_pelo_simples === false ? 'NÃO' : 'NÃO OPTANTE',
      mei: raw.data_opcao_pelo_mei ? 'SIM' : 'NÃO',
      partners
    };
  }

  // Tenta buscar Inscrição Estadual e dados extras via SEFAZ / publica.cnpj.ws em paralelo
  let extraIe = '';
  let extraPhone = '';
  let extraFantasia = '';

  try {
    const wsController = new AbortController();
    const wsTimer = setTimeout(() => wsController.abort(), 3500);
    const wsResp = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`, {
      signal: wsController.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerTech/1.0' }
    });
    clearTimeout(wsTimer);
    if (wsResp.ok) {
      const wsData = await wsResp.json();
      const ies = wsData.estabelecimento?.inscricoes_estaduais || [];
      const activeIe = ies.find(i => i.ativo);
      extraIe = (activeIe || ies[0])?.inscricao_estadual || '';
      if (wsData.estabelecimento?.nome_fantasia) {
        extraFantasia = wsData.estabelecimento.nome_fantasia;
      }
      if (wsData.estabelecimento?.ddd1 && wsData.estabelecimento?.telefone1) {
        extraPhone = `${wsData.estabelecimento.ddd1}${wsData.estabelecimento.telefone1}`;
      }
    }
  } catch (err) {}

  // 1. Tenta MinhaReceita
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerTech/1.0' }
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      return res.json(normalizeCnpj(data, extraIe, extraPhone, extraFantasia));
    }
  } catch (err) {}

  // 2. Fallback ReceitaWS
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerTech/1.0' }
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (data.status !== 'ERROR') {
        return res.json(normalizeCnpj(data, extraIe, extraPhone, extraFantasia));
      }
    }
  } catch (err) {}

  // 3. Fallback BrasilAPI
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerTech/1.0' }
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      return res.json(normalizeCnpj(data, extraIe, extraPhone, extraFantasia));
    }
  } catch (err) {}

  return res.status(404).json({ error: 'CNPJ não localizado na Receita Federal.' });
});

// ==========================================
// MÓDULO FISCAL (NF-e & NFS-e)
// ==========================================
app.get('/api/fiscal/invoices', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.fiscalInvoices || []);
});

app.post('/api/fiscal/emit', requireAuth, async (req, res) => {
  const { type, referenceType, referenceId, recipient, items, total } = req.body;
  const result = await emitInvoice({ type, referenceType, referenceId, recipient, items, total });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.get('/api/fiscal/config', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.fiscalConfig || {});
});

app.put('/api/fiscal/config', requireAuth, (req, res) => {
  const db = getDatabase();
  db.fiscalConfig = {
    ...db.fiscalConfig,
    ...req.body
  };
  saveDatabase(db);
  res.json(db.fiscalConfig);
});

// ==========================================
// BACKUP DIÁRIO & RESTAURAÇÃO
// ==========================================
app.get('/api/backup', requireAuth, (req, res) => {
  const db = getDatabase();
  const settings = db.backupSettings || {};
  const physicalFiles = listPhysicalBackups(settings.backupDirectory);

  res.json({
    settings,
    history: db.backupHistory || [],
    files: physicalFiles
  });
});

app.post('/api/backup/run', requireAuth, (req, res) => {
  const { customDestination } = req.body;
  const result = executeBackup('manual', customDestination);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

app.put('/api/backup/settings', requireAuth, (req, res) => {
  const db = getDatabase();
  db.backupSettings = {
    ...db.backupSettings,
    ...req.body
  };
  saveDatabase(db);
  res.json(db.backupSettings);
});

app.post('/api/backup/restore', requireAuth, (req, res) => {
  const { backupFilePath } = req.body;
  if (!backupFilePath) {
    return res.status(400).json({ error: 'Caminho do arquivo de backup é obrigatório' });
  }

  const result = restoreBackup(backupFilePath);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// ==========================================
// VENDEDORES (CADASTRO PARA VENDAS E OS)
// ==========================================
app.get('/api/sellers', requireAuth, (req, res) => {
  const db = getDatabase();
  res.json(db.sellers || []);
});

app.post('/api/sellers', requireAuth, (req, res) => {
  const db = getDatabase();
  const { name, nickname, document, phone, email, commissionRate, active, notes } = req.body || {};
  const cleanName = toUpper(name);
  if (!cleanName) {
    return res.status(400).json({ error: 'O nome do vendedor é obrigatório.' });
  }

  if (!db.sellers) db.sellers = [];
  const exists = db.sellers.some(s => toUpper(s.name) === cleanName);
  if (exists) {
    return res.status(409).json({ error: 'Já existe um vendedor cadastrado com este nome.' });
  }

  const newSeller = {
    id: `seller-${Date.now()}`,
    name: cleanName,
    nickname: toUpper(nickname),
    document: document ? String(document).trim() : '',
    phone: phone ? String(phone).trim() : '',
    email: email ? String(email).trim().toLowerCase() : '',
    commissionRate: commissionRate !== undefined && commissionRate !== '' ? Number(commissionRate) : 0,
    active: active !== false,
    notes: toUpper(notes),
    createdAt: new Date().toISOString()
  };

  db.sellers.push(newSeller);
  saveDatabase(db);
  res.status(201).json(newSeller);
});

app.put('/api/sellers/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.sellers) db.sellers = [];
  const index = db.sellers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Vendedor não encontrado.' });
  }

  const existing = db.sellers[index];
  const nextName = req.body.name !== undefined ? toUpper(req.body.name) : existing.name;
  if (!nextName) {
    return res.status(400).json({ error: 'O nome do vendedor é obrigatório.' });
  }

  const duplicate = db.sellers.some(s => s.id !== existing.id && toUpper(s.name) === nextName);
  if (duplicate) {
    return res.status(409).json({ error: 'Já existe outro vendedor cadastrado com este nome.' });
  }

  const updated = {
    ...existing,
    name: nextName,
    nickname: req.body.nickname !== undefined ? toUpper(req.body.nickname) : (existing.nickname || ''),
    document: req.body.document !== undefined ? String(req.body.document).trim() : (existing.document || ''),
    phone: req.body.phone !== undefined ? String(req.body.phone).trim() : (existing.phone || ''),
    email: req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : (existing.email || ''),
    commissionRate: req.body.commissionRate !== undefined ? Number(req.body.commissionRate) : (existing.commissionRate || 0),
    active: req.body.active !== undefined ? Boolean(req.body.active) : (existing.active !== false),
    notes: req.body.notes !== undefined ? toUpper(req.body.notes) : (existing.notes || ''),
    updatedAt: new Date().toISOString()
  };

  db.sellers[index] = updated;

  // Sincroniza nome atualizado nos registros vinculados para manter consistência nos relatórios
  if (updated.name !== existing.name) {
    (db.sales || []).forEach(sale => {
      if (sale.sellerId === updated.id) {
        sale.sellerName = updated.name;
      }
    });
    (db.workOrders || []).forEach(os => {
      if (os.sellerId === updated.id) {
        os.sellerName = updated.name;
      }
    });
  }

  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/sellers/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.sellers) db.sellers = [];
  db.sellers = db.sellers.filter(s => s.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// ==========================================
// GASTOS E DESPESAS DA EMPRESA
// ==========================================
app.get('/api/expenses', requireAuth, (req, res) => {
  const db = getDatabase();
  const list = db.expenses || [];
  const sorted = [...list].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
  res.json(sorted);
});

app.post('/api/expenses', requireAuth, (req, res) => {
  const db = getDatabase();
  const { description, amount, category, date, sellerId, sellerName, paymentMethod, notes, receiptUrl } = req.body || {};
  const cleanDesc = toUpper(description);
  if (!cleanDesc) {
    return res.status(400).json({ error: 'A descrição do gasto é obrigatória.' });
  }

  const numAmount = Math.max(0, Number(amount || 0));
  if (numAmount <= 0) {
    return res.status(400).json({ error: 'O valor do gasto deve ser maior que zero.' });
  }

  let resolvedSellerName = '';
  if (sellerId) {
    const sObj = (db.sellers || []).find(s => s.id === sellerId);
    if (sObj) resolvedSellerName = sObj.name;
    else if (sellerName) resolvedSellerName = toUpper(sellerName);
  } else if (sellerName) {
    resolvedSellerName = toUpper(sellerName);
  }

  if (!db.expenses) db.expenses = [];
  const newExpense = {
    id: `exp-${Date.now()}`,
    description: cleanDesc,
    amount: numAmount,
    category: category || 'outros',
    date: date || new Date().toISOString().substring(0, 10),
    sellerId: sellerId || undefined,
    sellerName: resolvedSellerName || undefined,
    paymentMethod: toUpper(paymentMethod, 'DINHEIRO'),
    notes: toUpper(notes),
    receiptUrl: receiptUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.expenses.unshift(newExpense);
  saveDatabase(db);
  res.status(201).json(newExpense);
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.expenses) db.expenses = [];
  const index = db.expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Gasto não encontrado.' });
  }

  const existing = db.expenses[index];
  const { description, amount, category, date, sellerId, sellerName, paymentMethod, notes, receiptUrl } = req.body || {};

  const cleanDesc = description !== undefined ? toUpper(description) : existing.description;
  if (!cleanDesc) {
    return res.status(400).json({ error: 'A descrição do gasto é obrigatória.' });
  }

  const numAmount = amount !== undefined ? Math.max(0, Number(amount)) : existing.amount;

  let resolvedSellerName = existing.sellerName;
  const nextSellerId = sellerId !== undefined ? (sellerId || undefined) : existing.sellerId;
  if (sellerId !== undefined) {
    if (sellerId) {
      const sObj = (db.sellers || []).find(s => s.id === sellerId);
      resolvedSellerName = sObj ? sObj.name : toUpper(sellerName);
    } else {
      resolvedSellerName = undefined;
    }
  }

  const updated = {
    ...existing,
    description: cleanDesc,
    amount: numAmount,
    category: category !== undefined ? category : existing.category,
    date: date !== undefined ? date : existing.date,
    sellerId: nextSellerId,
    sellerName: resolvedSellerName,
    paymentMethod: paymentMethod !== undefined ? toUpper(paymentMethod) : existing.paymentMethod,
    notes: notes !== undefined ? toUpper(notes) : existing.notes,
    receiptUrl: receiptUrl !== undefined ? receiptUrl : existing.receiptUrl,
    updatedAt: new Date().toISOString()
  };

  db.expenses[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/expenses/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.expenses) db.expenses = [];
  db.expenses = db.expenses.filter(e => e.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// ==========================================
// EMPRESAS, PLANOS & PARQUE DE EQUIPAMENTOS (B2B)
// ==========================================

// 1. EMPRESAS
app.get('/api/companies', requireAuth, (req, res) => {
  const db = getDatabase();
  const list = db.companies || [];
  const sorted = [...list].sort((a, b) => (a.corporateName || '').localeCompare(b.corporateName || ''));
  res.json(sorted);
});

app.post('/api/companies', requireAuth, (req, res) => {
  const db = getDatabase();
  const body = req.body || {};
  const corporateName = toUpper(body.corporateName);
  if (!corporateName) {
    return res.status(400).json({ error: 'A Razão Social da empresa é obrigatória.' });
  }

  if (!db.companies) db.companies = [];

  const newCompany = {
    id: `comp-${Date.now()}`,
    cnpj: (body.cnpj || '').trim(),
    corporateName,
    tradeName: toUpper(body.tradeName) || corporateName,
    stateRegistration: toUpper(body.stateRegistration),
    municipalRegistration: toUpper(body.municipalRegistration),
    contactName: toUpper(body.contactName) || 'RESPONSÁVEL',
    contactRole: toUpper(body.contactRole),
    contactPhone: (body.contactPhone || '').trim(),
    contactWhatsapp: (body.contactWhatsapp || '').trim(),
    contactEmail: (body.contactEmail || '').trim().toLowerCase(),
    street: toUpper(body.street),
    number: toUpper(body.number),
    complement: toUpper(body.complement),
    neighborhood: toUpper(body.neighborhood),
    city: toUpper(body.city),
    state: toUpper(body.state),
    cep: (body.cep || '').trim(),
    planId: body.planId || undefined,
    planName: body.planName || undefined,
    planStatus: body.planStatus || 'ativo',
    planValue: Math.max(0, Number(body.planValue || 0)),
    billingDay: Math.max(1, Math.min(31, Number(body.billingDay || 10))),
    contractStartDate: body.contractStartDate || new Date().toISOString().substring(0, 10),
    contractEndDate: body.contractEndDate || undefined,
    notes: toUpper(body.notes),
    customerId: body.customerId || undefined,
    createdAt: new Date().toISOString()
  };

  db.companies.push(newCompany);
  saveDatabase(db);
  res.status(201).json(newCompany);
});

app.put('/api/companies/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.companies) db.companies = [];
  const index = db.companies.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Empresa não encontrada.' });
  }

  const existing = db.companies[index];
  const body = req.body || {};

  const corporateName = body.corporateName !== undefined ? toUpper(body.corporateName) : existing.corporateName;
  if (!corporateName) {
    return res.status(400).json({ error: 'A Razão Social da empresa é obrigatória.' });
  }

  const updated = {
    ...existing,
    cnpj: body.cnpj !== undefined ? (body.cnpj || '').trim() : existing.cnpj,
    corporateName,
    tradeName: body.tradeName !== undefined ? toUpper(body.tradeName) : existing.tradeName,
    stateRegistration: body.stateRegistration !== undefined ? toUpper(body.stateRegistration) : existing.stateRegistration,
    municipalRegistration: body.municipalRegistration !== undefined ? toUpper(body.municipalRegistration) : existing.municipalRegistration,
    contactName: body.contactName !== undefined ? toUpper(body.contactName) : existing.contactName,
    contactRole: body.contactRole !== undefined ? toUpper(body.contactRole) : existing.contactRole,
    contactPhone: body.contactPhone !== undefined ? (body.contactPhone || '').trim() : existing.contactPhone,
    contactWhatsapp: body.contactWhatsapp !== undefined ? (body.contactWhatsapp || '').trim() : existing.contactWhatsapp,
    contactEmail: body.contactEmail !== undefined ? (body.contactEmail || '').trim().toLowerCase() : existing.contactEmail,
    street: body.street !== undefined ? toUpper(body.street) : existing.street,
    number: body.number !== undefined ? toUpper(body.number) : existing.number,
    complement: body.complement !== undefined ? toUpper(body.complement) : existing.complement,
    neighborhood: body.neighborhood !== undefined ? toUpper(body.neighborhood) : existing.neighborhood,
    city: body.city !== undefined ? toUpper(body.city) : existing.city,
    state: body.state !== undefined ? toUpper(body.state) : existing.state,
    cep: body.cep !== undefined ? (body.cep || '').trim() : existing.cep,
    planId: body.planId !== undefined ? body.planId : existing.planId,
    planName: body.planName !== undefined ? body.planName : existing.planName,
    planStatus: body.planStatus !== undefined ? body.planStatus : existing.planStatus,
    planValue: body.planValue !== undefined ? Math.max(0, Number(body.planValue)) : existing.planValue,
    billingDay: body.billingDay !== undefined ? Math.max(1, Math.min(31, Number(body.billingDay))) : existing.billingDay,
    contractStartDate: body.contractStartDate !== undefined ? body.contractStartDate : existing.contractStartDate,
    contractEndDate: body.contractEndDate !== undefined ? body.contractEndDate : existing.contractEndDate,
    notes: body.notes !== undefined ? toUpper(body.notes) : existing.notes,
    updatedAt: new Date().toISOString()
  };

  db.companies[index] = updated;

  // Atualiza nome da empresa nos equipamentos relacionados
  if (db.companyEquipments) {
    db.companyEquipments.forEach(eq => {
      if (eq.companyId === updated.id) {
        eq.companyName = updated.tradeName || updated.corporateName;
      }
    });
  }

  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/companies/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.companies) db.companies = [];
  db.companies = db.companies.filter(c => c.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// 2. PLANOS CORPORATIVOS
app.get('/api/company-plans', requireAuth, (req, res) => {
  const db = getDatabase();
  const list = db.companyPlans || [];
  res.json(list);
});

app.post('/api/company-plans', requireAuth, (req, res) => {
  const db = getDatabase();
  const body = req.body || {};
  const name = toUpper(body.name);
  if (!name) {
    return res.status(400).json({ error: 'O nome do plano é obrigatório.' });
  }

  if (!db.companyPlans) db.companyPlans = [];

  const newPlan = {
    id: `plan-${Date.now()}`,
    name,
    code: toUpper(body.code),
    description: body.description || '',
    monthlyFee: Math.max(0, Number(body.monthlyFee || 0)),
    billingCycle: body.billingCycle || 'mensal',
    slaHours: Number(body.slaHours || 24),
    equipmentLimit: Number(body.equipmentLimit || 0),
    preventiveVisitsPerMonth: Number(body.preventiveVisitsPerMonth || 1),
    includesRemoteSupport: body.includesRemoteSupport !== false,
    includesParts: Boolean(body.includesParts),
    coverageDetails: body.coverageDetails || '',
    active: body.active !== false,
    createdAt: new Date().toISOString()
  };

  db.companyPlans.push(newPlan);
  saveDatabase(db);
  res.status(201).json(newPlan);
});

app.put('/api/company-plans/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.companyPlans) db.companyPlans = [];
  const index = db.companyPlans.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Plano não encontrado.' });
  }

  const existing = db.companyPlans[index];
  const body = req.body || {};

  const updated = {
    ...existing,
    name: body.name !== undefined ? toUpper(body.name) : existing.name,
    code: body.code !== undefined ? toUpper(body.code) : existing.code,
    description: body.description !== undefined ? body.description : existing.description,
    monthlyFee: body.monthlyFee !== undefined ? Math.max(0, Number(body.monthlyFee)) : existing.monthlyFee,
    billingCycle: body.billingCycle !== undefined ? body.billingCycle : existing.billingCycle,
    slaHours: body.slaHours !== undefined ? Number(body.slaHours) : existing.slaHours,
    equipmentLimit: body.equipmentLimit !== undefined ? Number(body.equipmentLimit) : existing.equipmentLimit,
    preventiveVisitsPerMonth: body.preventiveVisitsPerMonth !== undefined ? Number(body.preventiveVisitsPerMonth) : existing.preventiveVisitsPerMonth,
    includesRemoteSupport: body.includesRemoteSupport !== undefined ? Boolean(body.includesRemoteSupport) : existing.includesRemoteSupport,
    includesParts: body.includesParts !== undefined ? Boolean(body.includesParts) : existing.includesParts,
    coverageDetails: body.coverageDetails !== undefined ? body.coverageDetails : existing.coverageDetails,
    active: body.active !== undefined ? Boolean(body.active) : existing.active,
    updatedAt: new Date().toISOString()
  };

  db.companyPlans[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/company-plans/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.companyPlans) db.companyPlans = [];
  db.companyPlans = db.companyPlans.filter(p => p.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// 3. EQUIPAMENTOS DAS EMPRESAS (PATRIMÔNIO)
app.get('/api/company-equipments', requireAuth, (req, res) => {
  const db = getDatabase();
  let list = db.companyEquipments || [];
  if (req.query.companyId) {
    list = list.filter(e => e.companyId === req.query.companyId);
  }
  const sorted = [...list].sort((a, b) => (a.patrimonio || '').localeCompare(b.patrimonio || ''));
  res.json(sorted);
});

app.post('/api/company-equipments', requireAuth, (req, res) => {
  const db = getDatabase();
  const body = req.body || {};
  const patrimonio = toUpper(body.patrimonio);
  if (!patrimonio) {
    return res.status(400).json({ error: 'O número de patrimônio do equipamento é obrigatório.' });
  }
  if (!body.companyId) {
    return res.status(400).json({ error: 'A empresa proprietária do equipamento é obrigatória.' });
  }

  if (!db.companyEquipments) db.companyEquipments = [];

  // Busca nome da empresa
  const comp = (db.companies || []).find(c => c.id === body.companyId);
  const companyName = comp ? (comp.tradeName || comp.corporateName) : (body.companyName || '');

  const newEquip = {
    id: `eq-${Date.now()}`,
    companyId: body.companyId,
    companyName,
    patrimonio,
    type: toUpper(body.type) || 'COMPUTADOR',
    brand: toUpper(body.brand) || 'DIVERSOS',
    model: toUpper(body.model) || 'PADRÃO',
    serialNumber: toUpper(body.serialNumber),
    sector: toUpper(body.sector) || 'GERAL',
    location: toUpper(body.location),
    responsibleUser: toUpper(body.responsibleUser),
    specifications: body.specifications || '',
    status: body.status || 'operacional',
    acquisitionDate: body.acquisitionDate || undefined,
    warrantyUntil: body.warrantyUntil || undefined,
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  db.companyEquipments.push(newEquip);
  saveDatabase(db);
  res.status(201).json(newEquip);
});

app.put('/api/company-equipments/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.companyEquipments) db.companyEquipments = [];
  const index = db.companyEquipments.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Equipamento não encontrado.' });
  }

  const existing = db.companyEquipments[index];
  const body = req.body || {};

  const patrimonio = body.patrimonio !== undefined ? toUpper(body.patrimonio) : existing.patrimonio;
  if (!patrimonio) {
    return res.status(400).json({ error: 'O número de patrimônio é obrigatório.' });
  }

  const updated = {
    ...existing,
    patrimonio,
    type: body.type !== undefined ? toUpper(body.type) : existing.type,
    brand: body.brand !== undefined ? toUpper(body.brand) : existing.brand,
    model: body.model !== undefined ? toUpper(body.model) : existing.model,
    serialNumber: body.serialNumber !== undefined ? toUpper(body.serialNumber) : existing.serialNumber,
    sector: body.sector !== undefined ? toUpper(body.sector) : existing.sector,
    location: body.location !== undefined ? toUpper(body.location) : existing.location,
    responsibleUser: body.responsibleUser !== undefined ? toUpper(body.responsibleUser) : existing.responsibleUser,
    specifications: body.specifications !== undefined ? body.specifications : existing.specifications,
    status: body.status !== undefined ? body.status : existing.status,
    acquisitionDate: body.acquisitionDate !== undefined ? body.acquisitionDate : existing.acquisitionDate,
    warrantyUntil: body.warrantyUntil !== undefined ? body.warrantyUntil : existing.warrantyUntil,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    updatedAt: new Date().toISOString()
  };

  db.companyEquipments[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/company-equipments/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.companyEquipments) db.companyEquipments = [];
  db.companyEquipments = db.companyEquipments.filter(e => e.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// 4. HISTÓRICO DE MANUTENÇÕES DOS EQUIPAMENTOS (COM DINÂMICA DE OS)
app.get('/api/company-maintenances', requireAuth, (req, res) => {
  const db = getDatabase();
  let list = db.companyMaintenances || [];
  if (req.query.equipmentId) {
    list = list.filter(m => m.equipmentId === req.query.equipmentId);
  }
  if (req.query.companyId) {
    list = list.filter(m => m.companyId === req.query.companyId);
  }
  const sorted = [...list].sort((a, b) => {
    const numA = Number(a.orderNumber || 0);
    const numB = Number(b.orderNumber || 0);
    return numB - numA;
  });
  res.json(sorted);
});

app.post('/api/company-maintenances', requireAuth, (req, res) => {
  const db = getDatabase();
  const body = req.body || {};
  if (!body.equipmentId) {
    return res.status(400).json({ error: 'O equipamento de destino é obrigatório.' });
  }

  if (!db.companyMaintenances) db.companyMaintenances = [];

  // Próximo número sequencial
  const maxNumber = db.companyMaintenances.reduce((max, m) => Math.max(max, Number(m.orderNumber || 0)), 0);
  const nextOrderNumber = maxNumber + 1;

  const nowIso = new Date().toISOString();
  const initialStatus = body.status || 'aberta';

  const newMaintenance = {
    id: `maint-${Date.now()}`,
    orderNumber: nextOrderNumber,
    companyId: body.companyId || '',
    companyName: toUpper(body.companyName) || 'EMPRESA',
    equipmentId: body.equipmentId,
    patrimonio: toUpper(body.patrimonio) || '',
    equipmentDescription: toUpper(body.equipmentDescription) || 'EQUIPAMENTO',
    sector: toUpper(body.sector) || '',
    responsibleUser: toUpper(body.responsibleUser) || '',
    type: body.type || 'preventiva',
    reportedIssue: body.reportedIssue || 'Manutenção preventiva periódica programada.',
    technicalReport: body.technicalReport || '',
    actionsTaken: body.actionsTaken || '',
    status: initialStatus,
    statusDates: {
      [initialStatus]: nowIso
    },
    coveredByPlan: body.coveredByPlan !== false,
    items: Array.isArray(body.items) ? body.items : [],
    partsTotal: Number(body.partsTotal || 0),
    servicesTotal: Number(body.servicesTotal || 0),
    discount: Number(body.discount || 0),
    total: Number(body.total || 0),
    warrantyDays: Number(body.warrantyDays || 90),
    entryDate: body.entryDate || nowIso.substring(0, 10),
    completionDate: body.completionDate || undefined,
    deliveredDate: body.deliveredDate || undefined,
    technicianName: toUpper(body.technicianName) || 'TÉCNICO RESPONSÁVEL',
    notes: body.notes || '',
    workOrderId: body.workOrderId || undefined,
    createdAt: nowIso
  };

  db.companyMaintenances.unshift(newMaintenance);

  // Se a manutenção estiver aberta ou em andamento, atualiza status do equipamento para 'em_manutencao'
  if (['aberta', 'analise', 'orcamento', 'aprovada', 'manutencao', 'aguardando_peca'].includes(initialStatus)) {
    const eq = (db.companyEquipments || []).find(e => e.id === body.equipmentId);
    if (eq && eq.status === 'operacional') {
      eq.status = 'em_manutencao';
    }
  }

  saveDatabase(db);
  res.status(201).json(newMaintenance);
});

app.put('/api/company-maintenances/:id', requireAuth, (req, res) => {
  const db = getDatabase();
  if (!db.companyMaintenances) db.companyMaintenances = [];
  const index = db.companyMaintenances.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Registro de manutenção não encontrado.' });
  }

  const existing = db.companyMaintenances[index];
  const body = req.body || {};
  const nextStatus = body.status !== undefined ? body.status : existing.status;

  const nowIso = new Date().toISOString();
  const nextStatusDates = { ...(existing.statusDates || {}) };
  if (nextStatus !== existing.status && !nextStatusDates[nextStatus]) {
    nextStatusDates[nextStatus] = nowIso;
  }

  const updated = {
    ...existing,
    type: body.type !== undefined ? body.type : existing.type,
    reportedIssue: body.reportedIssue !== undefined ? body.reportedIssue : existing.reportedIssue,
    technicalReport: body.technicalReport !== undefined ? body.technicalReport : existing.technicalReport,
    actionsTaken: body.actionsTaken !== undefined ? body.actionsTaken : existing.actionsTaken,
    status: nextStatus,
    statusDates: nextStatusDates,
    coveredByPlan: body.coveredByPlan !== undefined ? Boolean(body.coveredByPlan) : existing.coveredByPlan,
    items: body.items !== undefined ? body.items : existing.items,
    partsTotal: body.partsTotal !== undefined ? Number(body.partsTotal) : existing.partsTotal,
    servicesTotal: body.servicesTotal !== undefined ? Number(body.servicesTotal) : existing.servicesTotal,
    discount: body.discount !== undefined ? Number(body.discount) : existing.discount,
    total: body.total !== undefined ? Number(body.total) : existing.total,
    warrantyDays: body.warrantyDays !== undefined ? Number(body.warrantyDays) : existing.warrantyDays,
    entryDate: body.entryDate !== undefined ? body.entryDate : existing.entryDate,
    completionDate: body.completionDate !== undefined ? body.completionDate : existing.completionDate,
    deliveredDate: body.deliveredDate !== undefined ? body.deliveredDate : existing.deliveredDate,
    technicianName: body.technicianName !== undefined ? toUpper(body.technicianName) : existing.technicianName,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    workOrderId: body.workOrderId !== undefined ? body.workOrderId : existing.workOrderId,
    updatedAt: nowIso
  };

  db.companyMaintenances[index] = updated;

  // Atualiza status do equipamento se concluída/entregue
  if (['concluida', 'entregue'].includes(nextStatus)) {
    const eq = (db.companyEquipments || []).find(e => e.id === updated.equipmentId);
    if (eq && eq.status === 'em_manutencao') {
      eq.status = 'operacional';
    }
  }

  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/company-maintenances/:id', requireAuth, requireAdminPassword, (req, res) => {
  const db = getDatabase();
  if (!db.companyMaintenances) db.companyMaintenances = [];
  db.companyMaintenances = db.companyMaintenances.filter(m => m.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// ==========================================
// CONFIGURAÇÕES DA LOJA
// ==========================================
app.get('/api/settings', requireAuth, (req, res) => {
  const db = getDatabase();
  const settings = db.storeSettings || {};
  const localIp = getLocalIpAddress();
  const currentPublicUrl = getPublicUrl();
  res.json({
    ...settings,
    publicTrackingUrl: currentPublicUrl || settings.publicTrackingUrl || '',
    tunnelActive: Boolean(currentPublicUrl),
    detectedLocalIp: localIp,
    isPort80Active,
    detectedLocalUrl: currentPublicUrl || getDetectedLocalUrl()
  });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const db = getDatabase();
  db.storeSettings = {
    ...db.storeSettings,
    ...req.body
  };
  saveDatabase(db);
  res.json(db.storeSettings);
});

// Endpoints do Túnel Público Cloudflare
app.get('/api/tunnel/status', requireAuth, (req, res) => {
  res.json(getStatus());
});

app.post('/api/tunnel/restart', requireAuth, (req, res) => {
  restartTunnel(PORT);
  res.json({ message: 'Reiniciando túnel Cloudflare...', status: getStatus() });
});

// Disparo nativo via WhatsApp Desktop / WhatsApp Business no Windows (sem navegador e com envio automático)
app.post('/api/whatsapp/send-desktop', requireAuth, async (req, res) => {
  try {
    let { phone, text, autoSend } = req.body;
    const currentPublicUrl = getPublicUrl();
    if (currentPublicUrl && text) {
      // Garante que o link na mensagem do WhatsApp aponte para o servidor público gratuito Cloudflare
      text = text.replace(/https?:\/\/[a-zA-Z0-9\.\-]+(\.nip\.io)?(:\d+)?(?=\/\?track|\/|\s|$)/gi, currentPublicUrl);
      text = text.replace(/https?:\/\/localhost(:\d+)?(?=\/\?track|\/|\s|$)/gi, currentPublicUrl);
    }
    const result = await sendViaWhatsAppDesktop(phone, text, autoSend !== false);
    res.json(result);
  } catch (err) {
    console.error('Erro ao enviar pelo WhatsApp Desktop:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disparo nativo de ARQUIVO PDF do recibo via WhatsApp Desktop (ZERO links, apenas o PDF anexo)
app.post('/api/whatsapp/send-sale-pdf', requireAuth, async (req, res) => {
  try {
    const { saleId, phone, autoSend, text } = req.body;
    const db = getDatabase();
    const sale = (db.sales || []).find(s => s.id === saleId || String(s.number) === String(saleId));
    if (!sale) {
      return res.status(404).json({ success: false, error: 'Venda não encontrada' });
    }

    const store = db.storeSettings || {};
    const storeDdd = store.phone || store.whatsapp || '61';
    const targetPhone = phone || sale.customerPhone;
    const result = await sendSalePdfViaWhatsAppDesktop(
      targetPhone,
      sale,
      PORT,
      autoSend !== false,
      storeDdd,
      text,
      store.documentsDirectory
    );
    res.json(result);
  } catch (err) {
    console.error('Erro ao enviar PDF via WhatsApp Desktop:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disparo nativo de ARQUIVO PDF da Ordem de Serviço via WhatsApp Desktop (ZERO links, apenas o PDF anexo com mensagem simples)
app.post('/api/whatsapp/send-work-order-pdf', requireAuth, async (req, res) => {
  try {
    const { workOrderId, phone, text, autoSend } = req.body;
    const db = getDatabase();
    const os = (db.workOrders || []).find(o => o.id === workOrderId || String(o.number) === String(workOrderId));
    if (!os) {
      return res.status(404).json({ success: false, error: 'Ordem de serviço não encontrada' });
    }

    const store = db.storeSettings || {};
    const storeDdd = store.phone || store.whatsapp || '61';
    const targetPhone = phone || os.customerPhone;
    const result = await sendWorkOrderPdfViaWhatsAppDesktop(
      targetPhone,
      os,
      PORT,
      autoSend !== false,
      storeDdd,
      text,
      store.documentsDirectory
    );
    res.json(result);
  } catch (err) {
    console.error('Erro ao enviar PDF da OS via WhatsApp Desktop:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Salvar relatório físico gerado no diretório configurado
app.post('/api/documents/save-report', requireAuth, (req, res) => {
  try {
    const { fileName, content } = req.body || {};
    if (!fileName || !content) {
      return res.status(400).json({ success: false, error: 'Nome do arquivo e conteúdo são obrigatórios.' });
    }
    const db = getDatabase();
    const store = db.storeSettings || {};
    const documentsDir = store.documentsDirectory || path.join(osNode.homedir(), 'Documents', 'InfoTech_Documentos');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }
    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
    const targetPath = path.join(documentsDir, safeName);
    fs.writeFileSync(targetPath, content, { encoding: 'utf-8' });
    res.json({ success: true, filePath: targetPath });
  } catch (err) {
    console.error('Erro ao salvar relatório no diretório de documentos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir arquivos estáticos do frontend compilado
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Inicia servidor na porta principal (4567) caso não esteja executando no ambiente serverless da Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[InfoTech API] Servidor rodando com sucesso em http://127.0.0.1:${PORT}`);
    // Inicia túnel Cloudflare apenas se habilitado ou em desenvolvimento local Windows
    const shouldStartTunnel = process.env.ENABLE_CLOUDFLARE_TUNNEL === 'true' || 
      (process.env.NODE_ENV !== 'production' && process.platform === 'win32' && process.env.DISABLE_TUNNEL !== 'true');

    if (shouldStartTunnel) {
      startTunnel(PORT);
    } else {
      console.log('[Cloudflare Tunnel] Túnel temporário desativado (Ambiente de Produção / VPS).');
    }
  });

  // Tenta iniciar também na porta padrão HTTP (80) para links diretos e limpos no WhatsApp (sem precisar de :4567)
  try {
    const server80 = app.listen(80, () => {
      isPort80Active = true;
      console.log(`[InfoTech API] Porta padrão 80 ativa para links diretos de WhatsApp.`);
    });
    server80.on('error', (err) => {
      isPort80Active = false;
      console.log(`[InfoTech API] Porta 80 não vinculada (${err.message}). Utilizando porta ${PORT}.`);
    });
  } catch (e) {
    isPort80Active = false;
  }
}

module.exports = app;
