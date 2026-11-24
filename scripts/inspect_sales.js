const { getDatabase } = require('../server/db');
const db = getDatabase();
console.log('Total sales:', (db.sales || []).length);
(db.sales || []).slice(-10).forEach(s => {
  console.log(`Sale #${s.number} | phone: "${s.customerPhone}" | customer: "${s.customerName}" | token: ${s.receiptToken?.slice(0, 8)}`);
});
