const { getBrowserExecutable, generateReceiptPdf } = require('../server/pdfService');
const { getDatabase } = require('../server/db');

console.log('Browser:', getBrowserExecutable());

const db = getDatabase();
const sale = (db.sales || [])[0];
console.log('First sale:', sale?.number, 'receiptToken:', sale?.receiptToken);

if (sale && sale.receiptToken) {
  console.log('Testing generateReceiptPdf...');
  generateReceiptPdf(sale.receiptToken, 4567)
    .then((pdfPath) => {
      console.log('PDF generated at:', pdfPath);
    })
    .catch((err) => {
      console.error('PDF generation error:', err);
    });
}
