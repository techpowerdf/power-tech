const db = require('../data/database.json');

const sampleOS = (db.workOrders || []).find(o => Boolean(o.trackingToken));
const adminUser = (db.users || []).find(u => u.role === 'admin') || db.users[0];

async function run() {
  console.log('Testando POST /api/whatsapp/send-work-order-pdf...');

  // 1. Gera token JWT com authService
  const { createToken } = require('../server/authService');
  const token = createToken(adminUser);

  const res = await fetch('http://127.0.0.1:4567/api/whatsapp/send-work-order-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      workOrderId: sampleOS.id,
      phone: '61999998888',
      text: 'Olá! Agradecemos a preferência. Segue em anexo a sua OS.',
      autoSend: false
    })
  });

  const data = await res.json();
  console.log('Status HTTP:', res.status);
  console.log('Resposta:', data);

  if (res.status === 200 && data.success && data.mode === 'desktop_pdf_attached') {
    console.log('\nDISPARO DE PDF DA OS VIA WHATSAPP TESTADO COM SUCESSO! ✓');
    process.exit(0);
  } else {
    console.error('Falha no teste de envio de PDF da OS');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
