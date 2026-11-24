const db = require('../data/database.json');

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

const customers = [...(db.customers || [])];
const workOrders = [...(db.workOrders || [])];
const sales = [...(db.sales || [])];

console.log('Initial customers:', customers.length);
console.log('Initial work orders:', workOrders.length);
console.log('Initial sales:', sales.length);

function findCustomer(name, phone, document) {
  const cleanPhone = cleanDigits(phone);
  const cleanDoc = cleanDigits(document);
  const normName = normalizeName(name);

  return customers.find(c => {
    if (cleanDoc && cleanDigits(c.document) && cleanDigits(c.document) === cleanDoc) {
      return true;
    }
    if (cleanPhone && cleanDigits(c.phone) && cleanDigits(c.phone) === cleanPhone) {
      return true;
    }
    if (cleanPhone && cleanDigits(c.whatsapp) && cleanDigits(c.whatsapp) === cleanPhone) {
      return true;
    }
    if (normName && normalizeName(c.name) === normName && normName !== 'CONSUMIDOR FINAL' && normName !== 'CLIENTE BALCAO') {
      return true;
    }
    return false;
  });
}

let newlyCreated = 0;
let osLinked = 0;
let salesLinked = 0;

// Link Work Orders
workOrders.forEach(o => {
  const normName = normalizeName(o.customerName);
  if (!normName || normName === 'CONSUMIDOR FINAL' || normName === 'CLIENTE BALCAO') {
    return;
  }

  let cust = o.customerId ? customers.find(c => c.id === o.customerId) : null;
  if (!cust) {
    cust = findCustomer(o.customerName, o.customerPhone, o.customerCpf);
  }

  if (!cust) {
    cust = {
      id: `cust-os-${o.number}-${Date.now()}`,
      name: String(o.customerName).trim().toUpperCase(),
      tradeName: String(o.customerTradeName || '').trim().toUpperCase(),
      document: String(o.customerCpf || '').trim().toUpperCase(),
      stateRegistration: String(o.customerStateRegistration || '').trim().toUpperCase(),
      status: String(o.customerStatus || 'ATIVA').trim().toUpperCase(),
      openingDate: String(o.customerOpeningDate || '').trim().toUpperCase(),
      cnae: String(o.customerCnae || '').trim().toUpperCase(),
      legalNature: String(o.customerLegalNature || '').trim().toUpperCase(),
      phone: o.customerPhone || '',
      whatsapp: o.customerPhone || '',
      email: String(o.customerEmail || '').trim().toLowerCase(),
      street: String(o.customerStreet || '').trim().toUpperCase(),
      number: String(o.customerNumber || '').trim().toUpperCase(),
      complement: String(o.customerComplement || '').trim().toUpperCase(),
      neighborhood: String(o.customerNeighborhood || '').trim().toUpperCase(),
      city: String(o.customerCity || 'BRASÍLIA').trim().toUpperCase(),
      state: String(o.customerState || 'DF').trim().toUpperCase(),
      cep: String(o.customerCep || '').trim().toUpperCase(),
      notes: `Cliente cadastrado automaticamente via OS #${o.number}`,
      createdAt: o.entryDate || o.createdAt || new Date().toISOString()
    };
    customers.push(cust);
    newlyCreated++;
  }

  o.customerId = cust.id;
  osLinked++;
});

// Link Sales
sales.forEach(s => {
  const normName = normalizeName(s.customerName);
  if (!normName || normName === 'CONSUMIDOR FINAL' || normName === 'CLIENTE BALCAO') {
    return;
  }

  let cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
  if (!cust) {
    cust = findCustomer(s.customerName, s.customerPhone, s.customerCpf);
  }

  if (!cust) {
    cust = {
      id: `cust-sale-${s.number}-${Date.now()}`,
      name: String(s.customerName).trim().toUpperCase(),
      document: String(s.customerCpf || '').trim().toUpperCase(),
      phone: s.customerPhone || '',
      whatsapp: s.customerPhone || '',
      street: String(s.customerAddress || '').trim().toUpperCase(),
      city: 'BRASÍLIA',
      state: 'DF',
      notes: `Cliente cadastrado automaticamente via Venda #${s.number}`,
      createdAt: s.createdAt || new Date().toISOString()
    };
    customers.push(cust);
    newlyCreated++;
  }

  s.customerId = cust.id;
  salesLinked++;
});

console.log('Newly created customers:', newlyCreated);
console.log('Total customers after sync:', customers.length);
console.log('OS linked to customers:', osLinked);
console.log('Sales linked to customers:', salesLinked);

console.log('\nCustomer list sample:');
customers.forEach(c => {
  const clientOS = workOrders.filter(o => o.customerId === c.id);
  const clientSales = sales.filter(s => s.customerId === c.id);
  console.log(`- ${c.name} (Phone: ${c.phone}): ${clientOS.length} OSs, ${clientSales.length} Vendas`);
});
