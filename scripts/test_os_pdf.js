const path = require('path');
const fs = require('fs');
const http = require('http');
const db = require('../data/database.json');
const { generateWorkOrderPdf, copyFileToClipboard, getBrowserExecutable } = require('../server/pdfService');

async function run() {
  console.log('Browser:', getBrowserExecutable());
  const firstOS = (db.workOrders || []).find(o => Boolean(o.trackingToken));
  if (!firstOS) {
    console.error('Nenhuma OS com trackingToken encontrada!');
    process.exit(1);
  }

  console.log('Testando OS:', firstOS.id, 'Número:', firstOS.number, 'Token:', firstOS.trackingToken);

  // 1. Inicia o servidor temporariamente ou testa com o servidor ativo
  console.log('Testando generateWorkOrderPdf...');
  try {
    const pdfPath = await generateWorkOrderPdf(firstOS.trackingToken, 4567);
    console.log('PDF gerado com sucesso em:', pdfPath);
    const stats = fs.statSync(pdfPath);
    console.log('Tamanho do arquivo PDF:', stats.size, 'bytes');

    const buffer = fs.readFileSync(pdfPath);
    const header = buffer.slice(0, 5).toString('utf8');
    console.log('PDF Header:', header);
    if (!header.startsWith('%PDF')) {
      throw new Error('Cabeçalho de PDF inválido!');
    }

    console.log('Testando cópia para a área de transferência do Windows...');
    const copied = await copyFileToClipboard(pdfPath);
    console.log('Copiado para área de transferência:', copied);

    console.log('\nTODOS OS TESTES DE PDF DA ORDEM DE SERVIÇO FORAM CONCLUÍDOS COM SUCESSO! ✓');
    process.exit(0);
  } catch (err) {
    console.error('Erro no teste de PDF:', err);
    process.exit(1);
  }
}

run();
