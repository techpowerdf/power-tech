const db = require('../data/database.json');
const sampleOS = db.workOrders[0];
const storeSettings = db.storeSettings;

// Importa e testa
const ts = require('fs').readFileSync('src/services/whatsapp.ts', 'utf8');

// Verifica se há chamadas a http ou url dentro de formatWorkOrderWhatsAppMessage
const fnIndex = ts.indexOf('export const formatWorkOrderWhatsAppMessage =');
const fnBlock = ts.substring(fnIndex, fnIndex + 1400);

console.log('--- VERIFICAÇÃO DE AUSÊNCIA DE LINKS NA MENSAGEM ---');
const hasHttp = fnBlock.includes('http://') || fnBlock.includes('https://') || fnBlock.includes('${pdfUrl}') || fnBlock.includes('${trackingUrl}');
console.log('Possui links (esperado false):', hasHttp);

const fnReadyIndex = ts.indexOf('export const formatWorkOrderReadyWhatsAppMessage =');
const fnReadyBlock = ts.substring(fnReadyIndex, fnReadyIndex + 1400);
const hasHttpReady = fnReadyBlock.includes('http://') || fnReadyBlock.includes('https://') || fnReadyBlock.includes('${pdfUrl}') || fnReadyBlock.includes('${trackingUrl}');
console.log('Possui links no pronto retirada (esperado false):', hasHttpReady);

if (!hasHttp && !hasHttpReady) {
  console.log('\nCONFIRMADO: ZERO LINKS NAS MENSAGENS DE ORDEM DE SERVIÇO! ✓');
} else {
  console.error('\nFALHA: Ainda existem links na mensagem!');
  process.exit(1);
}
