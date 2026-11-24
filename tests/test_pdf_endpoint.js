const http = require('http');
const db = require('../data/database.json');

const firstSale = (db.sales || []).find(s => Boolean(s.receiptToken));
if (!firstSale) {
  console.error('No sale with receiptToken found in database.json');
  process.exit(1);
}

console.log('Testing sale:', firstSale.id, 'Number:', firstSale.number, 'Token:', firstSale.receiptToken);

http.get(`http://127.0.0.1:4567/api/public/sales/receipt/${firstSale.receiptToken}/pdf`, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('Content-Disposition:', res.headers['content-disposition']);
  
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('Downloaded bytes:', buf.length);
    console.log('PDF Magic Header:', buf.slice(0, 5).toString('utf8'));
    if (res.statusCode === 200 && buf.slice(0, 4).toString('utf8') === '%PDF') {
      console.log('SUCCESS: Valid PDF received and matches print model!');
      process.exit(0);
    } else {
      console.error('FAILURE: Unexpected response', buf.toString('utf8').slice(0, 300));
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});
