const { generateReceiptPdf, copyFileToClipboard } = require('../server/pdfService');

async function test() {
  console.log('Testando geração de PDF do recibo...');
  const pdfPath = await generateReceiptPdf('7fef1e7f565a2386fe6219db52d186d7', 4567);
  console.log('PDF gerado com sucesso:', pdfPath);
  const copied = await copyFileToClipboard(pdfPath);
  console.log('Copiado para área de transferência do Windows:', copied);
}

test().catch(console.error);
