const db = require('../data/database.json');

console.log('--- WORK ORDERS ---');
(db.workOrders || []).forEach(o => {
  console.log(`OS #${o.number}: id='${o.id}', customerId='${o.customerId}', name='${o.customerName}', phone='${o.customerPhone}', cpf='${o.customerCpf}'`);
});

console.log('\n--- SALES ---');
(db.sales || []).slice(0, 15).forEach(s => {
  console.log(`Sale #${s.number}: id='${s.id}', customerId='${s.customerId}', name='${s.customerName}', phone='${s.customerPhone}', cpf='${s.customerCpf}'`);
});

console.log('\n--- SALES WITH CUSTOMER ---');
(db.sales || []).filter(s => s.customerName && s.customerName !== 'CONSUMIDOR FINAL').forEach(s => {
  console.log(`Sale #${s.number}: name='${s.customerName}', phone='${s.customerPhone}', customerId='${s.customerId}'`);
});
