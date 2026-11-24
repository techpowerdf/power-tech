const { saveDatabase } = require('./db');

function cleanDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function normalizeName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

const GENERIC_NAMES = new Set([
  'CONSUMIDOR FINAL',
  'CONSUMIDOR',
  'CLIENTE BALCAO',
  'CLIENTE BALCÃO',
  'BALCAO',
  'BALCÃO',
  'AVULSO',
  'CLIENTE AVULSO',
  'NAO INFORMADO',
  'NÃO INFORMADO',
  ''
]);

function isGenericName(name) {
  return GENERIC_NAMES.has(normalizeName(name));
}

/**
 * Localiza um cliente existente no banco por documento, telefone ou nome normalizado
 */
function findMatchingCustomer(customers, { name, document, phone, whatsapp }) {
  if (!Array.isArray(customers)) return null;

  const cleanDoc = cleanDigits(document);
  const cleanP = cleanDigits(phone);
  const cleanW = cleanDigits(whatsapp);
  const normName = normalizeName(name);

  // 1. Busca por documento (CPF ou CNPJ) com prioridade máxima
  if (cleanDoc && cleanDoc.length >= 11) {
    const byDoc = customers.find(c => cleanDigits(c.document) === cleanDoc);
    if (byDoc) return byDoc;
  }

  // 2. Busca por telefone / whatsapp (mínimo 8 dígitos)
  const phoneToTest = [cleanP, cleanW].filter(p => p && p.length >= 8);
  for (const p of phoneToTest) {
    const byPhone = customers.find(c => {
      const cP = cleanDigits(c.phone);
      const cW = cleanDigits(c.whatsapp);
      return (cP && (cP === p || cP.endsWith(p) || p.endsWith(cP))) ||
             (cW && (cW === p || cW.endsWith(p) || p.endsWith(cW)));
    });
    if (byPhone) return byPhone;
  }

  // 3. Busca por nome exato normalizado (apenas se não for nome genérico de balcão)
  if (normName && !isGenericName(normName)) {
    const byName = customers.find(c => normalizeName(c.name) === normName);
    if (byName) return byName;
  }

  return null;
}

/**
 * Encontra ou cadastra automaticamente um cliente a partir de uma OS ou Venda
 */
function findOrCreateCustomer(db, data, sourceLabel = 'Ordem de Serviço') {
  if (!db.customers) db.customers = [];

  const rawName = String(data.customerName || data.name || '').trim();
  if (isGenericName(rawName)) {
    return null;
  }

  // 1. Se já forneceu um customerId válido que existe no banco
  if (data.customerId) {
    const existing = db.customers.find(c => c.id === data.customerId);
    if (existing) {
      // Atualiza campos vazios com os dados informados agora
      let updated = false;
      if (!existing.phone && (data.customerPhone || data.phone)) {
        existing.phone = data.customerPhone || data.phone;
        updated = true;
      }
      if (!existing.whatsapp && (data.customerPhone || data.whatsapp)) {
        existing.whatsapp = data.customerPhone || data.whatsapp;
        updated = true;
      }
      if (!existing.document && (data.customerCpf || data.document)) {
        existing.document = data.customerCpf || data.document;
        updated = true;
      }
      if (!existing.street && (data.customerStreet || data.street || data.customerAddress)) {
        existing.street = data.customerStreet || data.street || data.customerAddress;
        updated = true;
      }
      return existing;
    }
  }

  // 2. Tenta localizar por documento, telefone ou nome
  const matched = findMatchingCustomer(db.customers, {
    name: rawName,
    document: data.customerCpf || data.document,
    phone: data.customerPhone || data.phone,
    whatsapp: data.customerPhone || data.whatsapp
  });

  if (matched) {
    // Atualiza dados faltantes no cliente existente
    if (!matched.phone && (data.customerPhone || data.phone)) {
      matched.phone = data.customerPhone || data.phone;
    }
    if (!matched.whatsapp && (data.customerPhone || data.whatsapp)) {
      matched.whatsapp = data.customerPhone || data.whatsapp;
    }
    if (!matched.document && (data.customerCpf || data.document)) {
      matched.document = data.customerCpf || data.document;
    }
    return matched;
  }

  // 3. Cadastra novo cliente automaticamente
  const newCust = {
    id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: rawName.toUpperCase(),
    tradeName: String(data.customerTradeName || data.tradeName || '').trim().toUpperCase() || undefined,
    document: String(data.customerCpf || data.document || '').trim().toUpperCase(),
    stateRegistration: String(data.customerStateRegistration || data.stateRegistration || '').trim().toUpperCase() || undefined,
    status: String(data.customerStatus || data.status || 'ATIVA').trim().toUpperCase(),
    openingDate: String(data.customerOpeningDate || data.openingDate || '').trim().toUpperCase() || undefined,
    cnae: String(data.customerCnae || data.cnae || '').trim().toUpperCase() || undefined,
    legalNature: String(data.customerLegalNature || data.legalNature || '').trim().toUpperCase() || undefined,
    phone: String(data.customerPhone || data.phone || '').trim(),
    whatsapp: String(data.customerPhone || data.whatsapp || data.phone || '').trim(),
    email: String(data.customerEmail || data.email || '').trim().toLowerCase(),
    street: String(data.customerStreet || data.street || data.customerAddress || '').trim().toUpperCase(),
    number: String(data.customerNumber || '').trim().toUpperCase(),
    complement: String(data.customerComplement || data.complement || '').trim().toUpperCase(),
    neighborhood: String(data.customerNeighborhood || data.neighborhood || '').trim().toUpperCase(),
    city: String(data.customerCity || data.city || 'BRASÍLIA').trim().toUpperCase(),
    state: String(data.customerState || data.state || 'DF').trim().toUpperCase(),
    cep: String(data.customerCep || data.cep || '').trim().toUpperCase(),
    notes: String(data.notes || `Cliente registrado automaticamente via ${sourceLabel}`).trim().toUpperCase(),
    createdAt: data.entryDate || data.createdAt || new Date().toISOString()
  };

  db.customers.push(newCust);
  return newCust;
}

/**
 * Garante que todas as OS e Vendas existentes estejam vinculadas aos clientes corretos
 * e que todos os clientes estejam cadastrados e deduplicados.
 */
function syncCustomersAndHistory(db) {
  let modified = false;
  if (!db.customers) db.customers = [];
  if (!db.workOrders) db.workOrders = [];
  if (!db.sales) db.sales = [];

  // Deduplicação de clientes idênticos (mesmo telefone e nome ou mesmo documento)
  const uniqueCustomers = [];
  const idMap = new Map(); // oldId -> newId

  for (const c of db.customers) {
    const existing = findMatchingCustomer(uniqueCustomers, {
      name: c.name,
      document: c.document,
      phone: c.phone,
      whatsapp: c.whatsapp
    });

    if (existing) {
      idMap.set(c.id, existing.id);
      modified = true;
    } else {
      uniqueCustomers.push(c);
      idMap.set(c.id, c.id);
    }
  }

  if (uniqueCustomers.length !== db.customers.length) {
    db.customers = uniqueCustomers;
    modified = true;
  }

  // 1. Sincroniza e vincula Ordens de Serviço
  for (const os of db.workOrders) {
    const rawName = String(os.customerName || '').trim();
    if (isGenericName(rawName)) continue;

    let targetCust = null;
    if (os.customerId && idMap.has(os.customerId)) {
      os.customerId = idMap.get(os.customerId);
      targetCust = db.customers.find(c => c.id === os.customerId);
    }

    if (!targetCust) {
      targetCust = findMatchingCustomer(db.customers, {
        name: rawName,
        document: os.customerCpf,
        phone: os.customerPhone
      });
    }

    if (!targetCust) {
      targetCust = findOrCreateCustomer(db, os, `OS #${os.number}`);
      modified = true;
    }

    if (targetCust && os.customerId !== targetCust.id) {
      os.customerId = targetCust.id;
      modified = true;
    }
  }

  // 2. Sincroniza e vincula Vendas
  for (const sale of db.sales) {
    const rawName = String(sale.customerName || '').trim();
    if (isGenericName(rawName)) continue;

    let targetCust = null;
    if (sale.customerId && idMap.has(sale.customerId)) {
      sale.customerId = idMap.get(sale.customerId);
      targetCust = db.customers.find(c => c.id === sale.customerId);
    }

    if (!targetCust) {
      targetCust = findMatchingCustomer(db.customers, {
        name: rawName,
        document: sale.customerCpf,
        phone: sale.customerPhone
      });
    }

    if (!targetCust) {
      targetCust = findOrCreateCustomer(db, sale, `Venda #${sale.number}`);
      modified = true;
    }

    if (targetCust && sale.customerId !== targetCust.id) {
      sale.customerId = targetCust.id;
      modified = true;
    }
  }

  if (modified) {
    saveDatabase(db);
    console.log(`[Histórico de Clientes] Clientes e histórico sincronizados com sucesso. Total de clientes: ${db.customers.length}`);
  }
}

/**
 * Retorna o histórico consolidado de um cliente específico (Ordens de Serviço, Vendas e Métricas)
 */
function getCustomerHistory(db, customerId) {
  const customer = (db.customers || []).find(c => c.id === customerId);
  if (!customer) return null;

  const cleanDoc = cleanDigits(customer.document);
  const cleanPhone = cleanDigits(customer.phone);
  const cleanWhatsapp = cleanDigits(customer.whatsapp);
  const normName = normalizeName(customer.name);

  // Função auxiliar de correspondência com o cliente
  const matchesCustomer = (record) => {
    if (record.customerId && record.customerId === customer.id) return true;

    if (cleanDoc && cleanDoc.length >= 11 && cleanDigits(record.customerCpf) === cleanDoc) {
      return true;
    }

    const rPhone = cleanDigits(record.customerPhone);
    if (rPhone && rPhone.length >= 8) {
      if (cleanPhone && (cleanPhone === rPhone || cleanPhone.endsWith(rPhone) || rPhone.endsWith(cleanPhone))) return true;
      if (cleanWhatsapp && (cleanWhatsapp === rPhone || cleanWhatsapp.endsWith(rPhone) || rPhone.endsWith(cleanWhatsapp))) return true;
    }

    const rName = normalizeName(record.customerName);
    if (rName && !isGenericName(rName) && rName === normName) {
      return true;
    }

    return false;
  };

  const workOrders = (db.workOrders || [])
    .filter(matchesCustomer)
    .sort((a, b) => new Date(b.entryDate || b.createdAt || 0).getTime() - new Date(a.entryDate || a.createdAt || 0).getTime());

  const sales = (db.sales || [])
    .filter(matchesCustomer)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Métricas financeiras e operacionais
  const activeOSs = workOrders.filter(o => o.status !== 'cancelada');
  const activeSales = sales.filter(s => s.status !== 'cancelada');

  const totalSpentWorkOrders = activeOSs.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalSpentSales = activeSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalSpent = totalSpentWorkOrders + totalSpentSales;

  // Lista de equipamentos atendidos
  const equipmentSet = new Set();
  workOrders.forEach(o => {
    const parts = [o.brand, o.model].filter(Boolean);
    const equip = parts.join(' ') || (o.equipmentType ? o.equipmentType.toUpperCase() : '');
    if (equip) equipmentSet.add(equip.trim());
  });

  // Data mais recente
  const dates = [
    ...workOrders.map(o => o.entryDate || o.createdAt),
    ...sales.map(s => s.createdAt)
  ].filter(Boolean);
  dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const lastInteraction = dates[0] || customer.createdAt || null;

  return {
    customer,
    workOrders,
    sales,
    metrics: {
      totalWorkOrders: workOrders.length,
      totalSales: sales.length,
      totalSpentWorkOrders,
      totalSpentSales,
      totalSpent,
      equipmentList: Array.from(equipmentSet),
      lastInteraction
    }
  };
}

module.exports = {
  cleanDigits,
  normalizeName,
  isGenericName,
  findMatchingCustomer,
  findOrCreateCustomer,
  syncCustomersAndHistory,
  getCustomerHistory
};
