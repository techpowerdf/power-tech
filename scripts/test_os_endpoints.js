const http = require('http');
const db = require('../data/database.json');

const sampleOS = (db.workOrders || []).find(o => Boolean(o.trackingToken));
if (!sampleOS) {
  console.error('OS não encontrada');
  process.exit(1);
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:4567${path}`, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Testando endpoint de impressão HTML:');
  const htmlRes = await get(`/api/public/work-orders/${sampleOS.trackingToken}/imprimir`);
  console.log('Status:', htmlRes.statusCode);
  const htmlText = htmlRes.body.toString('utf8');
  console.log('Contém número da OS:', htmlText.includes(`OS #${sampleOS.number}`));
  console.log('Contém cliente:', htmlText.includes(sampleOS.customerName));
  if (htmlRes.statusCode !== 200 || !htmlText.includes(`OS #${sampleOS.number}`)) {
    throw new Error('Falha no endpoint de impressão HTML');
  }

  console.log('\n2. Testando download do arquivo binário PDF:');
  const pdfRes = await get(`/api/public/work-orders/${sampleOS.trackingToken}/pdf`);
  console.log('Status:', pdfRes.statusCode);
  console.log('Content-Type:', pdfRes.headers['content-type']);
  console.log('Content-Disposition:', pdfRes.headers['content-disposition']);
  console.log('Bytes recebidos:', pdfRes.body.length);
  console.log('PDF Magic Header:', pdfRes.body.slice(0, 5).toString('utf8'));
  if (pdfRes.statusCode !== 200 || !pdfRes.body.slice(0, 4).toString('utf8').startsWith('%PDF')) {
    throw new Error('Falha no endpoint de download de PDF');
  }

  console.log('\n3. Testando proteção anti-IDOR (bloqueio de número sequencial):');
  const idorRes = await get(`/api/public/work-orders/${sampleOS.number}/pdf`);
  console.log('Status IDOR (esperado 403):', idorRes.statusCode);
  if (idorRes.statusCode !== 403) {
    throw new Error('Falha no teste de proteção anti-IDOR');
  }

  console.log('\nTODOS OS ENDPOINTS DE ORDEM DE SERVIÇO EM PDF FORAM VALIDADOS COM SUCESSO! ✓');
}

run().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
