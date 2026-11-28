const http = require('http');
const fs = require('fs');

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4567,
      path: path,
      method: 'GET',
      headers
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf) });
        } catch {
          resolve({ status: res.statusCode, data: buf });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== TESTE DE ROTAS PÚBLICAS E TOKENS DE SEGURANÇA ===\n');

  // 1. Rota de acompanhamento web desativada (OS)
  const r1 = await get('/api/public/work-orders/track/token-qualquer');
  console.log('1. /api/public/work-orders/track/:token -> status:', r1.status, '| response:', r1.data);

  // 2. Rota de acompanhamento web desativada (Vendas)
  const r2 = await get('/api/public/sales/receipt/token-qualquer');
  console.log('2. /api/public/sales/receipt/:token -> status:', r2.status, '| response:', r2.data);

  // 3. Tentativa de acessar impressão por número sequencial (Enumeração OS)
  const r3 = await get('/api/public/work-orders/1065/imprimir');
  console.log('3. /api/public/work-orders/1065/imprimir -> status:', r3.status, '| body:', String(r3.data).slice(0, 80));

  // 4. Tentativa de acessar PDF por número sequencial (Enumeração OS)
  const r4 = await get('/api/public/work-orders/1065/pdf');
  console.log('4. /api/public/work-orders/1065/pdf -> status:', r4.status, '| body:', String(r4.data).slice(0, 80));

  // 5. Tentativa de rastreamento híbrido por número sequencial sem autenticação
  const r5 = await get('/api/work-orders/track/1065');
  console.log('5. /api/work-orders/track/1065 (sem auth) -> status:', r5.status, '| response:', r5.data);

  // 6. Tentativa de rastreamento híbrido de venda por número sequencial sem autenticação
  const r6 = await get('/api/sales/track/101');
  console.log('6. /api/sales/track/101 (sem auth) -> status:', r6.status, '| response:', r6.data);

  // 7. Obter token criptográfico real de uma OS para testar integridade e sanitização
  const db = JSON.parse(fs.readFileSync('C:/Users/Power/.gemini/antigravity/scratch/infotech-gestao/data/database.json', 'utf8'));
  const sampleOS = (db.workOrders || [])[0];
  if (sampleOS && sampleOS.trackingToken) {
    console.log('\nOS de teste:', sampleOS.number, '| Token:', sampleOS.trackingToken);
    console.log('Comprimento do token:', sampleOS.trackingToken.length, 'caracteres hexadecimais (128 bits)');

    // Rastreamento legítimo com o token criptográfico
    const r7 = await get('/api/work-orders/track/' + sampleOS.trackingToken);
    console.log('7. Rastreamento com token legítimo -> status:', r7.status);
    if (r7.status === 200 && r7.data && r7.data.workOrder) {
      console.log('   Dados sanitizados retornados:');
      console.log('   - Número:', r7.data.workOrder.number);
      console.log('   - Cliente:', r7.data.workOrder.customerName);
      console.log('   - CPF Mascarado:', r7.data.workOrder.customerCpfMasked);
      console.log('   - Exibe custo das peças (costPrice):', r7.data.workOrder.items.some(i => i.costPrice !== undefined));
    }
  }

  // 8. Teste de adulteração de token (alterar 1 caractere no token)
  const tamperedToken = sampleOS.trackingToken.slice(0, -1) + (sampleOS.trackingToken.endsWith('a') ? 'b' : 'a');
  const r8 = await get('/api/work-orders/track/' + tamperedToken);
  console.log('\n8. Token adulterado (' + tamperedToken + ') -> status:', r8.status, '| response:', r8.data);
}

run().catch(console.error);
