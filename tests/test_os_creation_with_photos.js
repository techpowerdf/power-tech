/**
 * Testes Automatizados - Criação de OS com Fotografias de Entrada e Validação do Supabase Storage
 * Power Tech Gestão - Módulo de Fotografias de OS
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const { getSupabaseUrl } = require('../server/supabaseService');
const { savePhotoFile, resolvePhotoUrl, deletePhotoFile } = require('../server/photoStorageService');

const BASE_URL = 'http://127.0.0.1:4567';

function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// 1x1 pixel JPEG em Base64
const TINY_JPEG_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runTests() {
  console.log('================================================================');
  console.log('INICIANDO AUDITORIA E TESTES DO MÓDULO DE FOTOGRAFIAS E SUPABASE');
  console.log('================================================================\n');

  // Teste 1: Validação da normalização de URL no Supabase Service
  console.log('1. Testando sanitização da SUPABASE_URL...');
  const originalEnvUrl = process.env.SUPABASE_URL;

  const testUrls = [
    { input: 'https://xyzproject.supabase.co', expected: 'https://xyzproject.supabase.co' },
    { input: 'https://xyzproject.supabase.co/', expected: 'https://xyzproject.supabase.co' },
    { input: 'https://xyzproject.supabase.co/rest/v1', expected: 'https://xyzproject.supabase.co' },
    { input: 'https://xyzproject.supabase.co/rest/v1/', expected: 'https://xyzproject.supabase.co' },
    { input: 'https://xyzproject.supabase.co/storage/v1', expected: 'https://xyzproject.supabase.co' },
    { input: '  https://xyzproject.supabase.co/  ', expected: 'https://xyzproject.supabase.co' }
  ];

  for (const { input, expected } of testUrls) {
    process.env.SUPABASE_URL = input;
    const cleaned = getSupabaseUrl();
    assert.strictEqual(cleaned, expected, `Falha ao normalizar URL '${input}': esperado '${expected}', obteve '${cleaned}'`);
  }
  process.env.SUPABASE_URL = originalEnvUrl;
  console.log('   ✓ Todas as variações de SUPABASE_URL foram limpas com sucesso para a raiz exata (sem barras extras ou /rest/v1).\n');

  // Teste 2: Validação de caminhos de arquivos no photoStorageService
  console.log('2. Testando construção de caminhos do Storage...');
  const fakeBuffer = Buffer.from('fake-image-bytes');
  const metadata = await savePhotoFile({
    workOrderId: 'os-9999',
    stage: 'entrada',
    fileName: 'Foto Equipamento (Frontal).jpg',
    mimeType: 'image/jpeg',
    buffer: fakeBuffer,
    username: 'admin'
  });

  assert.ok(metadata.storagePath, 'storagePath deve ser gerado');
  assert.ok(!metadata.storagePath.startsWith('/'), 'storagePath não deve começar com barra');
  assert.ok(!metadata.storagePath.includes('\\'), 'storagePath não deve conter barras invertidas');
  assert.ok(!metadata.storagePath.includes('//'), 'storagePath não deve conter barras duplas');
  assert.ok(!metadata.storagePath.includes('work-order-photos'), 'storagePath não deve repetir o nome do bucket');
  assert.ok(metadata.storagePath.startsWith('os-9999/'), 'storagePath deve começar com a pasta os-{id}/');
  assert.ok(metadata.storagePath.includes('entrada-'), 'storagePath deve conter o prefixo do estágio');
  assert.strictEqual(metadata.stage, 'entrada', 'Estágio deve ser entrada');
  console.log(`   ✓ Caminho gerado: ${metadata.storagePath}`);
  console.log('   ✓ Formato do caminho rigorosamente validado e seguro.\n');

  // Teste 3: Autenticação no Backend
  console.log('3. Realizando autenticação administrativa...');
  let loginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });

  let token = null;
  if (loginRes.status === 200 && loginRes.body?.token) {
    token = loginRes.body.token;
  } else {
    // Tenta fallback com a senha de desenvolvimento
    const fallbackRes = await makeRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'DefinaUmaSenhaForteParaOAdminAqui!2026'
    });
    if (fallbackRes.status === 200 && fallbackRes.body?.token) {
      token = fallbackRes.body.token;
    }
  }

  assert.ok(token, 'Token JWT de autenticação deve ser obtido');
  console.log('   ✓ Autenticação bem-sucedida.\n');

  // Teste 4: Criação de Ordem de Serviço com simulação do novo fluxo de abertura
  console.log('4. Testando fluxo de criação da OS com Fotografias...');
  const newOsPayload = {
    customerName: 'CLIENTE TESTE AUDITORIA FOTOS',
    customerPhone: '61988887777',
    equipmentType: 'notebook',
    brand: 'DELL',
    model: 'INSPIRON 15 3000',
    serialNumber: 'DL12345678',
    reportedIssue: 'EQUIPAMENTO NÃO LIGA, TELA TRINCADA',
    status: 'aberta',
    checklist: {
      ligando: false,
      carregadorFonte: true,
      caboForca: false,
      avariasVisiveis: 'TAMPA RISCADA E TELA TRINCADA'
    }
  };

  const createOsRes = await makeRequest('POST', '/api/work-orders', newOsPayload, token);
  assert.strictEqual(createOsRes.status, 201, 'Criação de OS deve retornar 201 Created');
  const createdOS = createOsRes.body;
  assert.ok(createdOS.id, 'Nova OS deve possuir ID');
  assert.ok(createdOS.number, 'Nova OS deve possuir número');
  console.log(`   ✓ OS criada com sucesso: ID=${createdOS.id}, Número=#${createdOS.number}`);

  // Teste 5: Upload de múltiplas fotografias de "Entrada" simulando as fotos em estágio
  console.log('5. Enviando fotografias de entrada vinculadas à nova OS...');
  const photo1Res = await makeRequest(
    'POST',
    `/api/work-orders/${createdOS.id}/photos`,
    {
      stage: 'entrada',
      fileName: 'visao_frontal_tela_trincada.jpg',
      base64Data: TINY_JPEG_BASE64,
      mimeType: 'image/jpeg'
    },
    token
  );

  assert.ok(photo1Res.status === 200 || photo1Res.status === 201, `Upload da foto 1 deve retornar 200/201 (status=${photo1Res.status})`);
  assert.ok(photo1Res.body.photo, 'Foto 1 deve ser retornada no corpo');
  assert.strictEqual(photo1Res.body.photo.stage, 'entrada', 'Estágio da foto 1 deve ser entrada');
  console.log(`   ✓ Foto 1 enviada: ID=${photo1Res.body.photo.id}, Path=${photo1Res.body.photo.storagePath}`);

  const photo2Res = await makeRequest(
    'POST',
    `/api/work-orders/${createdOS.id}/photos`,
    {
      stage: 'entrada',
      fileName: 'etiqueta_numero_serie.jpg',
      base64Data: TINY_JPEG_BASE64,
      mimeType: 'image/jpeg'
    },
    token
  );

  assert.ok(photo2Res.status === 200 || photo2Res.status === 201, `Upload da foto 2 deve retornar 200/201 (status=${photo2Res.status})`);
  assert.ok(photo2Res.body.photo, 'Foto 2 deve ser retornada no corpo');
  assert.strictEqual(photo2Res.body.photo.stage, 'entrada', 'Estágio da foto 2 deve ser entrada');
  console.log(`   ✓ Foto 2 enviada: ID=${photo2Res.body.photo.id}, Path=${photo2Res.body.photo.storagePath}`);

  // Teste 6: Consulta das fotos vinculadas à OS
  console.log('6. Consultando lista de fotos da OS...');
  const listPhotosRes = await makeRequest('GET', `/api/work-orders/${createdOS.id}/photos`, null, token);
  assert.strictEqual(listPhotosRes.status, 200, 'Listagem de fotos deve retornar 200 OK');
  assert.strictEqual(listPhotosRes.body.photos.length, 2, 'OS deve conter exatamente 2 fotos');
  assert.ok(listPhotosRes.body.photos[0].url, 'Fotos devem conter URL assinada / de visualização');
  console.log(`   ✓ Total de fotos consultadas: ${listPhotosRes.body.photos.length}`);

  // Teste 7: Exclusão com confirmação de uma fotografia
  console.log('7. Testando exclusão segura de uma fotografia...');
  const photoToDeleteId = photo1Res.body.photo.id;
  const deleteRes = await makeRequest('DELETE', `/api/work-orders/${createdOS.id}/photos/${photoToDeleteId}`, null, token);
  assert.strictEqual(deleteRes.status, 200, 'Exclusão da foto deve retornar 200 OK');
  assert.strictEqual(deleteRes.body.success, true, 'Exclusão deve ser confirmada com sucesso');

  const afterDeleteListRes = await makeRequest('GET', `/api/work-orders/${createdOS.id}/photos`, null, token);
  assert.strictEqual(afterDeleteListRes.body.photos.length, 1, 'Após exclusão deve restar 1 foto');
  console.log('   ✓ Exclusão de fotografia concluída com sucesso.\n');

  // Limpeza: Remoção da OS de teste
  console.log('8. Limpando dados do teste de auditoria...');
  await makeRequest('DELETE', `/api/work-orders/${createdOS.id}`, { adminPassword: 'admin' }, token);
  console.log('   ✓ Limpeza concluída.\n');

  console.log('================================================================');
  console.log('TODOS OS TESTES E VALIDAÇÕES FORAM CONCLUÍDOS COM SUCESSO (100%)');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NOS TESTES:', err);
  process.exit(1);
});
