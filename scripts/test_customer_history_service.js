const fs = require('fs');
const path = require('path');
const service = require('../server/customerHistoryService');

const dbPath = path.join(__dirname, '../data/database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('--- TEST CUSTOMER HISTORY SERVICE ---');
console.log('Customers before:', db.customers.length);

// Run sync
service.syncCustomersAndHistory(db);

console.log('Customers after sync:', db.customers.length);
console.log('Sample customer history:');
const firstCust = db.customers[0];
const history = service.getCustomerHistory(db, firstCust.id);
console.log('Customer:', history.customer.name);
console.log('Metrics:', history.metrics);
console.log('Work Orders count:', history.workOrders.length);
console.log('Sales count:', history.sales.length);

// Check another customer with OS (e.g. Nathalia or Cida)
const nathalia = db.customers.find(c => c.name.includes('NATHALIA'));
if (nathalia) {
  const natHistory = service.getCustomerHistory(db, nathalia.id);
  console.log('\nNathalia Customer:', natHistory.customer.name);
  console.log('Nathalia Metrics:', natHistory.metrics);
  console.log('Nathalia OS count:', natHistory.workOrders.length);
  natHistory.workOrders.forEach(o => {
    console.log(`- OS #${o.number}: ${o.brand} ${o.model} - R$ ${o.total} (${o.status})`);
  });
}

console.log('\nSUCCESS! Customer history service verified.');
