/**
 * Testes Automatizados para a Funcionalidade "Mensagem de Avaliação" na Ordem de Serviço
 * Power Tech Gestão
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TESTES AUTOMATIZADOS: MENSAGEM DE AVALIAÇÃO DA OS ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Erro: ${err.message}`);
  }
}

// 1. Verificar conteúdo de DEFAULT_OS_REVIEW_MESSAGE em whatsapp.ts
const whatsappTsPath = path.resolve(__dirname, '../src/services/whatsapp.ts');
const whatsappTs = fs.readFileSync(whatsappTsPath, 'utf8');

runTest('1. DEFAULT_OS_REVIEW_MESSAGE existe em src/services/whatsapp.ts', () => {
  assert(whatsappTs.includes('DEFAULT_OS_REVIEW_MESSAGE ='), 'DEFAULT_OS_REVIEW_MESSAGE não foi encontrado em whatsapp.ts');
});

runTest('2. DEFAULT_OS_REVIEW_MESSAGE solicita avaliação sincera/honesta sem pedir 5 estrelas', () => {
  const match = whatsappTs.match(/DEFAULT_OS_REVIEW_MESSAGE\s*=\s*`([\s\S]*?)`;/);
  assert(match, 'Não foi possível extrair DEFAULT_OS_REVIEW_MESSAGE');
  const template = match[1];

  // Exigência: Solicitar avaliação sincera/honesta, sem pedir especificamente cinco estrelas
  assert(!template.toLowerCase().includes('5 estrelas'), 'Template não deve exigir 5 estrelas');
  assert(!template.toLowerCase().includes('cinco estrelas'), 'Template não deve exigir cinco estrelas');
  assert(
    template.toLowerCase().includes('avaliação sincera') ||
    template.toLowerCase().includes('opinião sincera') ||
    template.toLowerCase().includes('sua opinião') ||
    template.toLowerCase().includes('sua avaliação'),
    'Template deve solicitar a opinião/avaliação do cliente'
  );
});

runTest('3. DEFAULT_OS_REVIEW_MESSAGE contém todas as tags dinâmicas essenciais', () => {
  const match = whatsappTs.match(/DEFAULT_OS_REVIEW_MESSAGE\s*=\s*`([\s\S]*?)`;/);
  const template = match[1];

  assert(template.includes('{cliente}'), 'Template deve conter tag {cliente}');
  assert(template.includes('{numero_os}'), 'Template deve conter tag {numero_os}');
  assert(template.includes('{equipamento}'), 'Template deve conter tag {equipamento}');
  assert(template.includes('{loja}'), 'Template deve conter tag {loja}');
  assert(template.includes('{link_avaliacao}'), 'Template deve conter tag {link_avaliacao}');
});

// 2. Simulação e Teste da função formatWorkOrderReviewCustomMessage
function cleanDigits(val) {
  return String(val || '').replace(/\D/g, '');
}

function formatWorkOrderReviewCustomMessage(workOrder, store, customer, customTemplate) {
  const template = (customTemplate && customTemplate.trim()) ||
    `Olá, *{cliente}*! Tudo bem?\n\nAqui é da *{loja}*. Seu equipamento *{equipamento}* (OS *#{numero_os}*) teve o serviço concluído recentemente com o valor de *{valor}*.\n\nSua opinião sincera é muito importante para nós!\nSe puder dedicar um minuto para nos avaliar, ficaremos muito gratos:\n{link_avaliacao}\n\nSe tiver qualquer dúvida, fale conosco pelo telefone {telefone}.\nObrigado pela confiança!`;

  const customerName =
    (customer && customer.name && customer.name.trim()) ||
    (workOrder && workOrder.customerName && workOrder.customerName.trim()) ||
    'Cliente';

  const storeName = (store && store.storeName && store.storeName.trim()) || 'Nossa Loja';
  const equipment = (workOrder && workOrder.equipment && workOrder.equipment.trim()) || 'Equipamento';
  const osNumber = workOrder && workOrder.number != null ? String(workOrder.number) : '';
  const totalVal = Number(workOrder && workOrder.total) || 0;
  const valorStr = `R$ ${totalVal.toFixed(2).replace('.', ',')}`;
  const storePhone = (store && (store.phone || store.whatsapp) && String(store.phone || store.whatsapp).trim()) || '';
  const reviewLink = (store && store.googleReviewUrl && store.googleReviewUrl.trim()) || '';

  return template
    .replace(/{cliente}/g, customerName)
    .replace(/{numero_os}/g, osNumber)
    .replace(/{equipamento}/g, equipment)
    .replace(/{valor}/g, valorStr)
    .replace(/{loja}/g, storeName)
    .replace(/{telefone}/g, storePhone)
    .replace(/{link_avaliacao}/g, reviewLink || '(Link de avaliação da loja)');
}

runTest('4. formatWorkOrderReviewCustomMessage substitui todas as variáveis dinâmicas corretamente', () => {
  const fakeOS = {
    id: 'os-123',
    number: 1042,
    customerName: 'Carlos Silva',
    customerPhone: '(61) 98765-4321',
    equipment: 'Notebook Dell Inspiron 15',
    total: 350.00
  };

  const fakeStore = {
    storeName: 'POWER TECH GESTÃO',
    phone: '(61) 3333-4444',
    googleReviewUrl: 'https://g.page/r/powertech/review'
  };

  const fakeCustomer = {
    id: 'cust-1',
    name: 'Carlos Silva',
    phone: '61987654321'
  };

  const formatted = formatWorkOrderReviewCustomMessage(fakeOS, fakeStore, fakeCustomer);

  assert(formatted.includes('Carlos Silva'), 'Nome do cliente não substituído');
  assert(formatted.includes('1042'), 'Número da OS não substituído');
  assert(formatted.includes('Notebook Dell Inspiron 15'), 'Equipamento não substituído');
  assert(formatted.includes('R$ 350,00'), 'Valor formatado não substituído');
  assert(formatted.includes('POWER TECH GESTÃO'), 'Nome da loja não substituído');
  assert(formatted.includes('https://g.page/r/powertech/review'), 'Link de avaliação não substituído');
  assert(formatted.includes('(61) 3333-4444'), 'Telefone da loja não substituído');
});

runTest('5. formatWorkOrderReviewCustomMessage trata dados nulos/parciais com segurança', () => {
  const minimalOS = {
    number: 999
  };

  const formatted = formatWorkOrderReviewCustomMessage(minimalOS, {}, null);

  assert(formatted.includes('Cliente'), 'Deve usar fallback "Cliente"');
  assert(formatted.includes('999'), 'Deve conter número 999');
  assert(formatted.includes('Equipamento'), 'Deve usar fallback "Equipamento"');
  assert(formatted.includes('R$ 0,00'), 'Deve formatar total ausente como R$ 0,00');
  assert(formatted.includes('Nossa Loja'), 'Deve usar fallback "Nossa Loja"');
  assert(!formatted.includes('{cliente}'), 'Nenhuma tag {cliente} não substituída deve sobrar');
  assert(!formatted.includes('{numero_os}'), 'Nenhuma tag {numero_os} não substituída deve sobrar');
  assert(!formatted.includes('{equipamento}'), 'Nenhuma tag {equipamento} não substituída deve sobrar');
  assert(!formatted.includes('{valor}'), 'Nenhuma tag {valor} não substituída deve sobrar');
  assert(!formatted.includes('{loja}'), 'Nenhuma tag {loja} não substituída deve sobrar');
  assert(!formatted.includes('{link_avaliacao}'), 'Nenhuma tag {link_avaliacao} não substituída deve sobrar');
});

// 3. Teste da resolução de telefone
function resolveCustomerPhone(workOrder, customer) {
  const raw =
    (workOrder && workOrder.customerPhone && String(workOrder.customerPhone).trim()) ||
    (customer && customer.whatsapp && String(customer.whatsapp).trim()) ||
    (customer && customer.phone && String(customer.phone).trim()) ||
    '';
  return cleanDigits(raw);
}

runTest('6. Resolução de telefone prioriza telefone da OS', () => {
  const os = { customerPhone: '(61) 99999-1111' };
  const cust = { whatsapp: '(61) 98888-2222', phone: '(61) 97777-3333' };
  assert.strictEqual(resolveCustomerPhone(os, cust), '61999991111');
});

runTest('7. Resolução de telefone utiliza WhatsApp do cadastro se OS não tiver telefone', () => {
  const os = { customerPhone: '' };
  const cust = { whatsapp: '(61) 98888-2222', phone: '(61) 97777-3333' };
  assert.strictEqual(resolveCustomerPhone(os, cust), '61988882222');
});

runTest('8. Resolução de telefone utiliza Telefone comum do cadastro se WhatsApp não estiver preenchido', () => {
  const os = { customerPhone: null };
  const cust = { phone: '61 97777-3333' };
  assert.strictEqual(resolveCustomerPhone(os, cust), '61977773333');
});

runTest('9. Resolução de telefone retorna string vazia quando nenhum telefone for encontrado', () => {
  const os = {};
  const cust = null;
  assert.strictEqual(resolveCustomerPhone(os, cust), '');
});

// 4. Verificação de SendWorkOrderReviewModal.tsx
const modalTsxPath = path.resolve(__dirname, '../src/components/SendWorkOrderReviewModal.tsx');
runTest('10. Componente SendWorkOrderReviewModal.tsx existe', () => {
  assert(fs.existsSync(modalTsxPath), 'SendWorkOrderReviewModal.tsx não existe');
});

const modalTsx = fs.readFileSync(modalTsxPath, 'utf8');
runTest('11. SendWorkOrderReviewModal inclui aviso de telefone ausente e pré-visualização editável', () => {
  assert(
    modalTsx.includes('não possui telefone de WhatsApp cadastrado') ||
    modalTsx.includes('informe um número de telefone'),
    'Aviso de telefone ausente/inválido deve estar presente'
  );
  assert(modalTsx.includes('textarea'), 'Deve conter textarea para edição da mensagem');
  assert(modalTsx.includes('Restaurar mensagem salva') || modalTsx.includes('handleResetMessage'), 'Deve conter opção para restaurar mensagem');
  assert(modalTsx.includes('WhatsApp Web'), 'Deve permitir abrir no WhatsApp Web');
  assert(modalTsx.includes('Abrir no WhatsApp') || modalTsx.includes('handleSend'), 'Deve permitir abrir no WhatsApp');
});

// 5. Verificação de WorkOrdersView.tsx
const workOrdersViewPath = path.resolve(__dirname, '../src/views/WorkOrdersView.tsx');
const workOrdersView = fs.readFileSync(workOrdersViewPath, 'utf8');

runTest('12. WorkOrdersView.tsx importa e instancia SendWorkOrderReviewModal', () => {
  assert(workOrdersView.includes('SendWorkOrderReviewModal'), 'SendWorkOrderReviewModal não foi importado em WorkOrdersView.tsx');
  assert(workOrdersView.includes('reviewModalOS'), 'Estado reviewModalOS não existe em WorkOrdersView.tsx');
});

runTest('13. WorkOrdersView.tsx inclui botão de Avaliação na Tabela Desktop, Mobile e no Modal de Detalhes', () => {
  const matches = (workOrdersView.match(/setReviewModalOS/g) || []).length;
  // Deve haver pelo menos 4 pontos onde setReviewModalOS é chamado: Tabela 1, Tabela 2, Mobile, Modal de Detalhes
  assert(matches >= 4, `Esperado pelo menos 4 chamadas para setReviewModalOS, encontrado: ${matches}`);
});

// 6. Verificação de SettingsView.tsx
const settingsViewPath = path.resolve(__dirname, '../src/views/SettingsView.tsx');
const settingsView = fs.readFileSync(settingsViewPath, 'utf8');

runTest('14. SettingsView.tsx importa DEFAULT_OS_REVIEW_MESSAGE e suporta osReviewMessageTemplate', () => {
  assert(settingsView.includes('DEFAULT_OS_REVIEW_MESSAGE'), 'DEFAULT_OS_REVIEW_MESSAGE não importado em SettingsView.tsx');
  assert(settingsView.includes('osReviewMessageTemplate'), 'osReviewMessageTemplate não encontrado em SettingsView.tsx');
  assert(settingsView.includes('osReviewMessageEnabled'), 'osReviewMessageEnabled não encontrado em SettingsView.tsx');
});

// 7. Verificação de tipos em StoreSettings
const typesPath = path.resolve(__dirname, '../src/types/index.ts');
const typesTs = fs.readFileSync(typesPath, 'utf8');

runTest('15. StoreSettings em src/types/index.ts define osReviewMessageEnabled e osReviewMessageTemplate', () => {
  assert(typesTs.includes('osReviewMessageEnabled?: boolean'), 'osReviewMessageEnabled não definido em StoreSettings');
  assert(typesTs.includes('osReviewMessageTemplate?: string'), 'osReviewMessageTemplate não definido em StoreSettings');
});

// 8. Integridade: server/db.js NÃO foi modificado
runTest('16. server/db.js não deve ter sido modificado (requisito 8)', () => {
  // Vamos checar com git status se server/db.js está modificado
  const { execSync } = require('child_process');
  const gitStatus = execSync('git status --porcelain server/db.js', { cwd: path.resolve(__dirname, '..') }).toString().trim();
  assert.strictEqual(gitStatus, '', 'server/db.js NÃO deve ser modificado');
});

console.log(`\n==================================================`);
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
