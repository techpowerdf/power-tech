const db = require('../data/database.json');
const sampleOS = db.workOrders[0];
const storeSettings = db.storeSettings;

// Simula a lógica de getWorkOrderPdfUrl e formatWorkOrderWhatsAppMessage
const token = sampleOS.trackingToken;
const base = (storeSettings.publicTrackingUrl || 'https://powertech.com').replace(/\/+$/, '');
const pdfUrl = `${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;

console.log('--- TESTE DA MENSAGEM DO WHATSAPP COM LINK DO PDF ---');
const clientName = (sampleOS.customerName || 'Cliente').trim();
const equipment = [sampleOS.brand, sampleOS.model].filter(Boolean).join(' ') || sampleOS.equipmentType;

let msg = `*POWER TECH - ASSISTÊNCIA TÉCNICA*\n`;
msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
msg += `Olá, *${clientName}*! 👋\n\n`;
msg += `Agradecemos imensamente pela preferência e pela confiança em nossos serviços!\n\n`;
msg += `📋 *ORDEM DE SERVIÇO #${sampleOS.number}* (${equipment})\n\n`;
msg += `📄 *ACESSE A SUA ORDEM DE SERVIÇO EM PDF:*\n`;
msg += `👇 *Toque no link abaixo para abrir o documento oficial:*\n\n`;
msg += `${pdfUrl}\n\n`;
msg += `Qualquer dúvida ou caso necessite de mais informações, estamos à sua inteira disposição!\n\n`;
msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
msg += `📍 *Nossa Loja:* ${storeSettings.street || 'Taguatinga Sul'}\n`;
msg += `📞 *Atendimento:* ${storeSettings.phone || storeSettings.whatsapp}\n`;
msg += `_Power Tech - Qualidade e transparência para você!_ 🚀`;

console.log(msg);

console.log('\n--- VERIFICAÇÃO DO LINK ---');
console.log('PDF URL gerada:', pdfUrl);
console.log('Validação de protocolo:', pdfUrl.startsWith('https://'));
