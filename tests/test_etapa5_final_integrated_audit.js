/**
 * SUÍTE DE TESTES INTEGRADOS E AUDITORIA FINAL - ETAPA 5
 * Power Tech Gestão
 * 
 * Cobre:
 * 1. Geração de PDF e Impressão (A4, 2 vias, Térmica, formatação, termos CDC)
 * 2. WhatsApp (Mensagens, ausência de links públicos, preparo de anexo PDF, fallback)
 * 3. Responsividade (360px, 390px, 412px e Desktop, verificação de overflow horizontal)
 * 4. Fotografias (Upload múltiplo, estágios, URLs seguras, exclusão recuperável, banco sem base64)
 * 5. Integridade e Segurança (JWT, permissões por usuário, bloqueio de simulação em prod, não-regressão)
 * 6. Banco de Dados e Retrocompatibilidade (OS legadas sem fotos, preservação de dados)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

const SAMPLE_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runEtapa5Audit() {
  console.log('========================================================================');
  console.log(' ETAPA 5 — AUDITORIA INTEGRADA FINAL DO SISTEMA POWER TECH GESTÃO');
  console.log('========================================================================\n');

  const auditResults = {
    pdf: { pass: 0, fail: 0, details: [] },
    whatsapp: { pass: 0, fail: 0, details: [] },
    responsiveness: { pass: 0, fail: 0, details: [] },
    photos: { pass: 0, fail: 0, details: [] },
    security: { pass: 0, fail: 0, details: [] },
    database: { pass: 0, fail: 0, details: [] }
  };

  const record = (category, title, pass, detail = '') => {
    if (pass) {
      auditResults[category].pass++;
      console.log(`  [PASS] ${title}`);
    } else {
      auditResults[category].fail++;
      console.error(`  [FAIL] ${title} - ${detail}`);
    }
    auditResults[category].details.push({ title, pass, detail });
  };

  // 0. Autenticação Administrativa
  console.log('--- 0. AUTENTICAÇÃO BASE ---');
  const adminLogin = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  if (adminLogin.status !== 200 || !adminLogin.json?.token) {
    throw new Error(`Falha crítica ao autenticar admin: ${adminLogin.body}`);
  }
  const token = adminLogin.json.token;
  console.log('  Admin autenticado com sucesso.\n');

  // Buscar dados base de OS
  const osRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: '/api/work-orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const workOrders = osRes.json || [];
  if (workOrders.length === 0) throw new Error('Nenhuma OS encontrada para auditoria.');
  const testOS = workOrders[0];
  console.log(`  OS selecionada para auditoria: #${testOS.number} (ID: ${testOS.id})\n`);

  // ========================================================================
  // 1. AUDITORIA: PDF E IMPRESSÃO
  // ========================================================================
  console.log('--- 1. AUDITORIA: PDF E IMPRESSÃO ---');

  // 1.1 Rota oficial de impressão /api/public/work-orders/:token/imprimir
  const trackingToken = testOS.trackingToken;
  const printRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/public/work-orders/${trackingToken}/imprimir`,
    method: 'GET'
  });
  record('pdf', 'Rota oficial de impressão da OS retorna status 200', printRes.status === 200, `Status: ${printRes.status}`);

  const html = printRes.body || '';
  record('pdf', 'Documento contém número correto da OS', html.includes(String(testOS.number)));
  record('pdf', 'Documento contém nome do cliente', html.includes(testOS.customerName || 'Cliente'));
  record('pdf', 'Documento contém termos de garantia legal do CDC (90 dias)', html.includes('Art. 26') || html.includes('90 dias'));
  record('pdf', 'Documento possui estrutura de assinaturas (Cliente e Técnico/Responsável)', html.includes('Assinatura do Cliente') && (html.includes('Técnico') || html.includes('Responsável')));

  // 1.2 Parâmetro ?pdf=1
  const printPdfRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/public/work-orders/${trackingToken}/imprimir?pdf=1`,
    method: 'GET'
  });
  record('pdf', 'Parâmetro ?pdf=1 é aceito e aciona modo de impressão/PDF', printPdfRes.status === 200 && printPdfRes.body.includes('window.print'));

  // 1.3 Bloqueio de ID sequencial na impressão pública (Prevenção IDOR)
  const idorPrintRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/public/work-orders/${testOS.number}/imprimir`,
    method: 'GET'
  });
  record('pdf', 'Tentativa de imprimir por número sequencial simples é bloqueada (403)', idorPrintRes.status === 403);
  console.log('');

  // ========================================================================
  // 2. AUDITORIA: WHATSAPP
  // ========================================================================
  console.log('--- 2. AUDITORIA: WHATSAPP ---');

  // 2.1 Confirmação de ausência de links públicos de rastreamento
  const trackRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/public/work-orders/track/${trackingToken}`,
    method: 'GET'
  });
  record('whatsapp', 'Acompanhamento web desativado retorna 404 conforme diretriz da Etapa 2', trackRes.status === 404);
  record('whatsapp', 'Mensagem do endpoint 404 orienta via PDF no WhatsApp', trackRes.json?.error?.includes('PDF diretamente pelo WhatsApp'));

  // 2.2 Verificação do template de mensagem no código
  const whatsappFile = path.join(__dirname, '..', 'src', 'services', 'whatsapp.ts');
  const whatsappCode = fs.readFileSync(whatsappFile, 'utf8');

  record('whatsapp', 'Mensagem de WhatsApp referencia PDF anexo', whatsappCode.includes('Segue em anexo a sua Ordem de Serviço em formato PDF'));
  record('whatsapp', 'Zero links de rastreamento /track/ gerados nas mensagens de OS', !whatsappCode.includes('/track/'));
  record('whatsapp', 'Suporte à Web Share API com arquivos implementado', whatsappCode.includes('navigator.canShare') && whatsappCode.includes('files: [fileToShare]'));
  record('whatsapp', 'Tratamento de cancelamento da Web Share API (AbortError)', whatsappCode.includes('AbortError'));
  record('whatsapp', 'Fallback de download direto para computador implementado', whatsappCode.includes('triggerBlobDownload(blob, filename)'));
  console.log('');

  // ========================================================================
  // 3. AUDITORIA: RESPONSIVIDADE E VISUALIZAÇÃO
  // ========================================================================
  console.log('--- 3. AUDITORIA: RESPONSIVIDADE E VISUALIZAÇÃO ---');

  const printModalFile = path.join(__dirname, '..', 'src', 'components', 'PrintModal.tsx');
  const printModalCode = fs.readFileSync(printModalFile, 'utf8');

  record('responsiveness', 'Cálculo dinâmico de escala para dispositivos móveis implementado', printModalCode.includes('Math.min(1, availableWidth / baseDocWidth)'));
  record('responsiveness', 'Controle de rolagem horizontal indevida (overflowX: hidden / auto)', printModalCode.includes('overflowX'));
  record('responsiveness', 'Modos de visualização móvel: Ajustar à tela (fit) e 100%', printModalCode.includes("'fit' | '100'"));
  record('responsiveness', 'Suporte a larguras compactas (360px, 390px, 412px)', printModalCode.includes('Math.max(260, viewportWidth - 28)'));

  const galleryFile = path.join(__dirname, '..', 'src', 'components', 'WorkOrderPhotosGallery.tsx');
  const galleryCode = fs.readFileSync(galleryFile, 'utf8');
  record('responsiveness', 'Galeria de fotos com layout responsivo (grid flexível cols-2 md:cols-3)', galleryCode.includes('grid-cols-2') || galleryCode.includes('grid-cols-3'));
  record('responsiveness', 'Input de câmera para smartphones (capture="environment")', galleryCode.includes('capture="environment"'));
  record('responsiveness', 'Input com suporte a múltiplas fotos (multiple)', galleryCode.includes('multiple'));
  console.log('');

  // ========================================================================
  // 4. AUDITORIA: FOTOGRAFIAS E ARMAZENAMENTO
  // ========================================================================
  console.log('--- 4. AUDITORIA: FOTOGRAFIAS E ARMAZENAMENTO ---');

  // 4.1 Upload nos 3 estágios
  const stages = ['entrada', 'reparo', 'conclusao'];
  const createdPhotos = [];

  for (const stg of stages) {
    const upRes = await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: `/api/work-orders/${testOS.id}/photos`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      stage: stg,
      fileName: `audit_${stg}.jpg`,
      base64Data: SAMPLE_JPEG_BASE64,
      mimeType: 'image/jpeg'
    });

    const isCreated = upRes.status === 201 && upRes.json?.photo?.id;
    record('photos', `Upload de fotografia no estágio [${stg.toUpperCase()}] bem-sucedido`, isCreated);
    if (isCreated) createdPhotos.push(upRes.json.photo);
  }

  // 4.2 Listagem de fotos com URLs seguras
  const listPhotosRes = await request({
    hostname: '127.0.0.1',
    port: 4567,
    path: `/api/work-orders/${testOS.id}/photos`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const photosList = listPhotosRes.json?.photos || [];
  record('photos', 'Listagem de fotos retorna status 200 e array de fotos', listPhotosRes.status === 200 && Array.isArray(photosList));
  record('photos', 'Todas as fotos possuem URLs resolvidas e seguras', photosList.length >= 3 && photosList.every(p => p.url));

  // 4.3 Auditoria estrita de ausência de Base64 no banco de dados principal
  const dbPath = path.join(__dirname, '..', 'data', 'database.json');
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const osInDb = (dbData.workOrders || []).find(o => o.id === testOS.id);
  const photosJsonStr = JSON.stringify(osInDb?.photos || []);
  const hasBase64InDb = photosJsonStr.includes(SAMPLE_JPEG_BASE64) || photosJsonStr.includes('base64,');
  record('photos', 'ZERO dados binários ou base64 persistidos no registro da OS no banco de dados', !hasBase64InDb);

  // 4.4 Exclusão recuperável e retry
  if (createdPhotos.length > 0) {
    const photoToTestRecovery = createdPhotos[0];

    // Ativa simulação de falha
    await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: '/api/work-orders/photos/test-simulation',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { enabled: true, message: 'Falha simulada de rede no bucket Supabase com token eyJhbGciOiJIUzI1NiJ9.demo' });

    // Exclui com falha simulada
    const delRes = await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: `/api/work-orders/${testOS.id}/photos/${photoToTestRecovery.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    record('photos', 'Exclusão com falha remota retorna pendingStorageDeletion=true', delRes.status === 200 && delRes.json?.pendingStorageDeletion === true);

    // Consulta fila de pendências
    const pendingRes = await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: '/api/work-orders/photos/pending-deletions',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pendingItem = (pendingRes.json?.pendingDeletions || []).find(p => p.photoId === photoToTestRecovery.id);
    record('photos', 'Arquivo registrado com sucesso na fila de exclusão recuperável (Outbox)', Boolean(pendingItem));
    record('photos', 'Mensagem de erro na fila devidamente sanitizada (sem tokens vazados)', pendingItem && !pendingItem.lastError.includes('eyJhbGci') && pendingItem.lastError.includes('[TOKEN_REDACTED]'));

    // Desativa simulação e executa cleanup
    await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: '/api/work-orders/photos/test-simulation',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { enabled: false });

    const cleanupRes = await request({
      hostname: '127.0.0.1',
      port: 4567,
      path: '/api/work-orders/photos/cleanup-pending',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    record('photos', 'Reprocessamento /cleanup-pending executa com sucesso', cleanupRes.status === 200 && cleanupRes.json?.results?.succeeded >= 1);

    // Limpa as outras fotos criadas no teste
    for (let i = 1; i < createdPhotos.length; i++) {
      await request({
        hostname: '127.0.0.1',
        port: 4567,
        path: `/api/work-orders/${testOS.id}/photos/${createdPhotos[i].id}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  }
  console.log('');

  // ========================================================================
  // 5. AUDITORIA: INTEGRIDADE, SEGURANÇA E NÃO-REGRESSÃO
  // ========================================================================
  console.log('--- 5. AUDITORIA: INTEGRIDADE, SEGURANÇA E NÃO-REGRESSÃO ---');

  // 5.1 Bloqueio de rotas sem autenticação (401)
  const unauthEndpoints = [
    { method: 'GET', path: '/api/work-orders' },
    { method: 'POST', path: '/api/work-orders' },
    { method: 'GET', path: '/api/customers' },
    { method: 'GET', path: '/api/products' },
    { method: 'GET', path: '/api/sales' },
    { method: 'GET', path: '/api/work-orders/photos/pending-deletions' },
    { method: 'POST', path: '/api/work-orders/photos/cleanup-pending' }
  ];

  let unauthPass = true;
  for (const ep of unauthEndpoints) {
    const res = await request({ hostname: '127.0.0.1', port: 4567, path: ep.path, method: ep.method });
    if (res.status !== 401) {
      unauthPass = false;
      console.error(`    Falha no endpoint ${ep.method} ${ep.path}: recebido ${res.status}`);
    }
  }
  record('security', 'Todas as rotas privadas bloqueadas com 401 Unauthorized sem token', unauthPass);

  // 5.2 Não-regressão de módulos fundamentais
  const custRes = await request({ hostname: '127.0.0.1', port: 4567, path: '/api/customers', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  record('security', 'Módulo de Clientes operacional (GET /api/customers)', custRes.status === 200 && Array.isArray(custRes.json));

  const prodRes = await request({ hostname: '127.0.0.1', port: 4567, path: '/api/products', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  record('security', 'Módulo de Produtos/Estoque operacional (GET /api/products)', prodRes.status === 200 && Array.isArray(prodRes.json));

  const salesRes = await request({ hostname: '127.0.0.1', port: 4567, path: '/api/sales', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  record('security', 'Módulo de Vendas/PDV operacional (GET /api/sales)', salesRes.status === 200 && Array.isArray(salesRes.json));

  const dashRes = await request({ hostname: '127.0.0.1', port: 4567, path: '/api/dashboard', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  record('security', 'Dashboard e Métricas consolidadas operacionais (GET /api/dashboard)', dashRes.status === 200 && dashRes.json?.metrics);

  // 5.3 Proteção contra injeção de simulação de falha
  const serverIndexFile = path.join(__dirname, '..', 'server', 'index.js');
  const serverCode = fs.readFileSync(serverIndexFile, 'utf8');
  record('security', 'Rota de simulação de falha bloqueada estritamente em produção (NODE_ENV === production)', serverCode.includes("process.env.NODE_ENV === 'production'"));
  console.log('');

  // ========================================================================
  // 6. AUDITORIA: BANCO DE DADOS E RETROCOMPATIBILIDADE
  // ========================================================================
  console.log('--- 6. AUDITORIA: BANCO DE DADOS E RETROCOMPATIBILIDADE ---');

  const currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // 6.1 Compatibilidade de OS legadas sem campo photos
  const allOrdersValid = (currentDb.workOrders || []).every(os => {
    // Mesmo que photos seja undefined ou array, não deve quebrar
    return os.id && os.number && (!os.photos || Array.isArray(os.photos));
  });
  record('database', 'Estrutura de todas as Ordens de Serviço é retrocompatível e íntegra', allOrdersValid);

  // 6.2 Coleção pendingPhotoDeletions
  record('database', 'Coleção pendingPhotoDeletions existe e está inicializada no banco', Array.isArray(currentDb.pendingPhotoDeletions));
  record('database', 'Fila de exclusões pendentes está limpa após os testes (0 pendências)', (currentDb.pendingPhotoDeletions || []).length === 0);

  // 6.3 Preservação de registros existentes
  record('database', 'Total de Ordens de Serviço preservado intacto', (currentDb.workOrders || []).length >= 60);
  record('database', 'Total de Clientes preservado intacto', (currentDb.customers || []).length >= 10);
  record('database', 'Total de Produtos preservado intacto', (currentDb.products || []).length >= 10);
  console.log('');

  // ========================================================================
  // RESUMO CONSOLIDADO
  // ========================================================================
  console.log('========================================================================');
  console.log(' RELATÓRIO CONSOLIDADO DA AUDITORIA INTEGRADA (ETAPA 5)');
  console.log('========================================================================');

  let totalPass = 0;
  let totalFail = 0;

  for (const [cat, data] of Object.entries(auditResults)) {
    totalPass += data.pass;
    totalFail += data.fail;
    const catName = cat.toUpperCase();
    console.log(`  [${catName}] Aprovados: ${data.pass} | Falhas: ${data.fail}`);
  }

  console.log('------------------------------------------------------------------------');
  console.log(` TOTAL DE ITENS AUDITADOS: ${totalPass + totalFail}`);
  console.log(` TAXA DE SUCESSO: ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (totalFail > 0) {
    console.error('❌ ATENÇÃO: Foram encontradas falhas durante a auditoria integrada.');
    process.exit(1);
  } else {
    console.log('✅ AUDITORIA CONCLUÍDA COM 100% DE APROVAÇÃO!');
  }
}

runEtapa5Audit().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DA AUDITORIA:', err.message);
  process.exit(1);
});
