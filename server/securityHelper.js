const crypto = require('crypto');
const { saveDatabase } = require('./db');

/**
 * Gera um token criptograficamente seguro e aleatório (32 caracteres hexadecimais = 128 bits de entropia)
 */
function generateSecureToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Mascara CPF para exibição pública segura (ex: 123.456.789-00 -> ***.***.789-**)
 */
function maskCpf(rawCpf) {
  if (!rawCpf) return undefined;
  const digits = String(rawCpf).replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.***.${digits.slice(6, 9)}-**`;
  }
  if (digits.length === 14) {
    return `**.***.${digits.slice(5, 8)}/****-**`;
  }
  return `***${digits.slice(-4)}`;
}

/**
 * Migra dados existentes adicionando trackingToken e receiptToken sem alterar nenhum número ou dado original
 */
function ensureTokensForExistingRecords(db) {
  let modified = false;

  if (Array.isArray(db.workOrders)) {
    db.workOrders.forEach((os) => {
      if (!os.trackingToken) {
        os.trackingToken = generateSecureToken();
        modified = true;
      }
    });
  }

  if (Array.isArray(db.sales)) {
    db.sales.forEach((sale) => {
      if (!sale.receiptToken) {
        sale.receiptToken = generateSecureToken();
        modified = true;
      }
    });
  }

  if (modified) {
    saveDatabase(db);
    console.log('[Segurança] Tokens seguros de rastreamento gerados para todos os registros pré-existentes.');
  }
}

/**
 * Sanitiza a Ordem de Serviço para a visualização pública do cliente.
 * Retorna ESTRITAMENTE os dados necessários para o cliente acompanhar o serviço,
 * sem expor custos de peças, margem de lucro, documentos completos ou dados de outros clientes.
 */
function sanitizePublicWorkOrder(os, store = {}) {
  return {
    number: os.number,
    customerName: os.customerName,
    customerCpfMasked: maskCpf(os.customerCpf),
    status: os.status,
    statusDates: os.statusDates || {},
    entryDate: os.entryDate,
    estimatedDeliveryDate: os.estimatedDeliveryDate,
    completionDate: os.completionDate,
    deliveredDate: os.deliveredDate,
    brand: os.brand,
    model: os.model,
    category: os.category,
    reportedIssue: os.reportedIssue,
    technicalReport: os.technicalReport,
    visibleDefects: os.visibleDefects,
    items: (os.items || []).map((it) => ({
      id: it.id,
      type: it.type === 'peca' ? 'peca' : 'servico',
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      total: Number(it.total) || 0,
      ...(it.warrantyDays !== undefined && it.warrantyDays !== null ? { warrantyDays: Number(it.warrantyDays) } : {})
    })),
    partsTotal: Number(os.partsTotal) || 0,
    servicesTotal: Number(os.servicesTotal) || 0,
    discount: Number(os.discount) || 0,
    total: Number(os.total) || 0,
    warrantyDays: os.warrantyDays !== undefined ? Number(os.warrantyDays) : 90,
    paymentMethod: os.paymentMethod,
    paymentStatus: os.paymentStatus || 'pendente',
    trackingToken: os.trackingToken
  };
}

/**
 * Sanitiza o Comprovante de Venda para visualização pública
 */
function sanitizePublicSale(sale, store = {}) {
  return {
    number: sale.number,
    customerName: sale.customerName,
    customerCpfMasked: maskCpf(sale.customerCpf || sale.customerDocument),
    status: sale.status,
    createdAt: sale.createdAt,
    items: (sale.items || []).map((it) => ({
      id: it.id,
      productName: it.productName,
      code: it.code,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      total: Number(it.total) || 0,
      ...(it.warrantyDays !== undefined && it.warrantyDays !== null ? { warrantyDays: Number(it.warrantyDays) } : {}),
      imageUrl: it.imageUrl
    })),
    subtotal: Number(sale.subtotal) || 0,
    discount: Number(sale.discount) || 0,
    total: Number(sale.total) || 0,
    warrantyDays: sale.warrantyDays !== undefined && sale.warrantyDays !== null ? Number(sale.warrantyDays) : 90,
    paymentMethod: sale.paymentMethod,
    installments: sale.installments || 1,
    receiptToken: sale.receiptToken
  };
}

module.exports = {
  generateSecureToken,
  maskCpf,
  ensureTokensForExistingRecords,
  sanitizePublicWorkOrder,
  sanitizePublicSale
};
