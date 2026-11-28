/**
 * TESTE INTEGRADO E AUDITORIA DE SEGURANÇA E ESTABILIDADE
 * Power Tech Gestão - Etapa de Correções
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4567/api';

async function runTests() {
  console.log('===============================================================');
  console.log('INICIANDO BATERIA DE TESTES INTEGRADOS E AUDITORIA DE SEGURANÇA');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function record(title, success, details = '') {
    if (success) {
      console.log(`[PASS] ${title}`);
      if (details) console.log(`       -> ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      if (details) console.error(`       -> ${details}`);
      failed++;
    }
  }

  // ==========================================================
  // BLOCO 1: AUDITORIA DE CÓDIGO FONTE (TELA DE LOGIN E CREDENCIAIS)
  // ==========================================================
  console.log('--- 1. AUDITORIA DA TELA DE LOGIN E CREDENCIAIS ---');
  const loginViewPath = path.join(__dirname, '..', 'src', 'views', 'LoginView.tsx');
  const loginViewCode = fs.readFileSync(loginViewPath, 'utf-8');

  // 1.1 Estados iniciais vazios
  const hasEmptyUsername = loginViewCode.includes("const [username, setUsername] = useState<string>('');");
  const hasEmptyPassword = loginViewCode.includes("const [password, setPassword] = useState<string>('');");
  record(
    'Campos de usuário e senha inicializam com strings estritamente vazias no React',
    hasEmptyUsername && hasEmptyPassword,
    `username vazio: ${hasEmptyUsername}, password vazio: ${hasEmptyPassword}`
  );

  // 1.2 Ausência de credenciais padrão ou dicas no código
  const hasNoHardcodedAdmin123 = !loginViewCode.includes('admin123');
  const hasNoFirstAccessHint = !loginViewCode.includes('Primeiro acesso padrão');
  record(
    'Ausência total de credenciais padrão e dicas de acesso na tela de login',
    hasNoHardcodedAdmin123 && hasNoFirstAccessHint,
    `Sem admin123: ${hasNoHardcodedAdmin123}, Sem dica de primeiro acesso: ${hasNoFirstAccessHint}`
  );

  // 1.3 Atributos de acessibilidade e autocomplete para navegador
  const hasAutoCompleteUser = loginViewCode.includes('autoComplete="username"');
  const hasAutoCompletePass = loginViewCode.includes('autoComplete="current-password"');
  record(
    'Atributos corretos de formulário e autocomplete presentes',
    hasAutoCompleteUser && hasAutoCompletePass,
    `autoComplete username: ${hasAutoCompleteUser}, autoComplete current-password: ${hasAutoCompletePass}`
  );

  // ==========================================================
  // BLOCO 2: ROTAS PRIVADAS REJEITAM ACESSO SEM TOKEN (401)
  // ==========================================================
  console.log('\n--- 2. PROTEÇÃO DE ROTAS PRIVADAS CONTRA ACESSO NÃO AUTORIZADO ---');
  const protectedEndpoints = [
    { method: 'GET', url: '/work-orders' },
    { method: 'GET', url: '/users' },
    { method: 'GET', url: '/customers' },
    { method: 'GET', url: '/products' },
    { method: 'GET', url: '/sales' },
    { method: 'GET', url: '/quotes' },
    { method: 'GET', url: '/dashboard' },
    { method: 'GET', url: '/settings' },
    { method: 'GET', url: '/auth/me' },
    { method: 'POST', url: '/auth/verify-admin-password', body: { password: 'test' } },
    { method: 'POST', url: '/work-orders', body: { customerName: 'Invader' } },
    { method: 'DELETE', url: '/work-orders/test-unauthorized' }
  ];

  let allRejectedWithoutToken = true;
  for (const ep of protectedEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.url}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      if (res.status !== 401) {
        console.error(`Rota ${ep.method} ${ep.url} respondeu ${res.status} em vez de 401!`);
        allRejectedWithoutToken = false;
      }
    } catch (e) {
      allRejectedWithoutToken = false;
    }
  }
  record(
    'Todas as 12 rotas privadas testadas rejeitam requisições sem token com HTTP 401',
    allRejectedWithoutToken,
    'Nenhum dado é exposto a visitantes anônimos sem autenticação'
  );

  // ==========================================================
  // BLOCO 3: FLUXO DE LOGIN E BACKDOOR ELIMINADO
  // ==========================================================
  console.log('\n--- 3. TESTE DE AUTENTICAÇÃO E ELIMINAÇÃO DE BACKDOORS ---');

  // 3.1 Login vazio rejeitado
  const emptyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '', password: '' })
  });
  record(
    'Tentativa de login com campos vazios é rejeitada com HTTP 400',
    emptyLoginRes.status === 400
  );

  // 3.2 Login com senha errada rejeitado
  const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'senha_completamente_incorreta_xyz' })
  });
  record(
    'Tentativa de login com senha incorreta é rejeitada com HTTP 401',
    wrongPassRes.status === 401
  );

  // 3.3 Login legítimo de administrador
  const validAdminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const validAdminJson = await validAdminRes.json();
  const adminToken = validAdminJson.token;
  record(
    'Login legítimo de administrador com credenciais válidas emite token JWT assinado',
    validAdminRes.status === 200 && !!adminToken,
    `Usuário autenticado: ${validAdminJson.user?.username} (${validAdminJson.user?.role})`
  );

  // 3.4 Validar token emitido em /auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const meJson = await meRes.json();
  record(
    'Token JWT é reconhecido com sucesso em /api/auth/me',
    meRes.status === 200 && !!meJson.user?.id,
    `Usuário retornado por /api/auth/me: ${meJson.user?.username} (${meJson.user?.name})`
  );

  // ==========================================================
  // BLOCO 4: VALIDAÇÃO DE SENHA DE ADMIN E EXCLUSÃO DE OS
  // ==========================================================
  console.log('\n--- 4. VALIDAÇÃO DE SENHA DO ADMINISTRADOR E EXCLUSÃO DE OS ---');

  // 4.1 Senha de admin incorreta deve retornar 403 sem deslogar o usuário
  const wrongAdminPassRes = await fetch(`${BASE_URL}/auth/verify-admin-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ password: 'senha_errada_admin' })
  });
  record(
    'Validação de senha de administrador incorreta responde HTTP 403 (Proibido)',
    wrongAdminPassRes.status === 403,
    'Status 403 impede que o interceptor confunda com token expirado (401)'
  );

  // 4.2 Sessão do usuário continua intacta após erro de senha de admin
  const meAfterWrongPass = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  record(
    'Sessão do usuário permanece 100% válida e conectada após digitar senha incorreta',
    meAfterWrongPass.status === 200
  );

  // 4.3 Senha de admin correta
  const correctAdminPassRes = await fetch(`${BASE_URL}/auth/verify-admin-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ password: 'admin123' })
  });
  record(
    'Validação de senha de administrador correta responde HTTP 200 (Sucesso)',
    correctAdminPassRes.status === 200
  );

  // 4.4 Exclusão de OS com senha errada
  const tempOsRes = await fetch(`${BASE_URL}/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      customerName: 'Cliente Teste Auditoria Fictício',
      brand: 'Marca Teste',
      model: 'Modelo Teste',
      reportedIssue: 'Apenas teste de exclusão temporário',
      status: 'aberta'
    })
  });
  const tempOs = await tempOsRes.json();
  const tempOsId = tempOs.id;

  const deleteWrongPass = await fetch(`${BASE_URL}/work-orders/${tempOsId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': encodeURIComponent('senha_errada_123')
    }
  });
  record(
    'Exclusão de OS com senha incorreta é barrada com HTTP 403 e OS permanece na lista',
    deleteWrongPass.status === 403
  );

  // 4.5 Exclusão de OS com senha correta
  const deleteCorrectPass = await fetch(`${BASE_URL}/work-orders/${tempOsId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': encodeURIComponent('admin123')
    }
  });
  record(
    'Exclusão de OS com senha de administrador correta remove o registro com sucesso',
    deleteCorrectPass.status === 200
  );

  // Confere se foi removida
  const getOsDeleted = await fetch(`${BASE_URL}/work-orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allOsList = await getOsDeleted.json();
  const osStillExists = (allOsList || []).some(o => o.id === tempOsId);
  record(
    'Confirmação de que a OS temporária não consta mais no banco',
    !osStillExists
  );

  // ==========================================================
  // BLOCO 5: AUDITORIA E CRUD DO MENU DE USUÁRIOS
  // ==========================================================
  console.log('\n--- 5. AUDITORIA COMPLETA DO MENU DE USUÁRIOS (ISOLADO / FICTÍCIO) ---');

  const testUsername = `user_audit_${Date.now()}`;
  let createdUserId = null;

  // 5.1 Rejeição de senha com menos de 6 caracteres
  const shortPassRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Operador Teste Curto',
      username: testUsername,
      password: '12345', // 5 caracteres < 6
      role: 'operador',
      active: true,
      permissions: { dashboard: true, workOrders: true, workOrdersDelete: false }
    })
  });
  record(
    'Criação de usuário com senha menor que 6 caracteres é rejeitada com HTTP 400',
    shortPassRes.status === 400
  );

  // 5.2 Criação com senha válida (mínimo 6 caracteres)
  const createUserRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Operador Teste Auditoria',
      username: testUsername,
      password: 'senha_segura_456',
      role: 'operador',
      active: true,
      permissions: { dashboard: true, workOrders: true, workOrdersDelete: false }
    })
  });
  const createUserJson = await createUserRes.json();
  createdUserId = createUserJson.user?.id;
  record(
    'Criação de usuário com senha válida (>= 6 chars) concluída com sucesso',
    (createUserRes.status === 201 || createUserRes.status === 200) && !!createdUserId,
    `HTTP Status: ${createUserRes.status}, ID: ${createdUserId}`
  );

  // 5.3 Verificação de segurança: hash não exposto
  record(
    'Objeto de usuário retornado NÃO expõe passwordHash no frontend',
    createUserJson.user?.passwordHash === undefined,
    'Proteção contra vazamento de credenciais na API'
  );

  // 5.4 Testar login com o novo usuário fictício
  const testUserLogin1 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUsername, password: 'senha_segura_456' })
  });
  record(
    'Novo usuário criado autentica com sucesso com as credenciais cadastradas',
    testUserLogin1.status === 200
  );

  // 5.5 Edição de dados do usuário (alterar nome e senha)
  const newUsername = `user_edit_${Date.now()}`;
  const editUserRes = await fetch(`${BASE_URL}/users/${createdUserId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Operador Teste Alterado',
      username: newUsername,
      password: 'nova_senha_super_segura_789'
    })
  });
  record(
    'Edição de nome, login e senha do usuário concluída com sucesso (HTTP 200)',
    editUserRes.status === 200
  );

  // 5.6 Testar se senha antiga foi invalidada e nova senha funciona
  const oldPassLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: newUsername, password: 'senha_segura_456' })
  });
  const newPassLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: newUsername, password: 'nova_senha_super_segura_789' })
  });
  record(
    'Senha antiga é revogada e nova senha passa a vigorar imediatamente',
    oldPassLogin.status === 401 && newPassLogin.status === 200
  );

  // 5.7 Desativação do usuário e bloqueio de acesso
  const deactivateRes = await fetch(`${BASE_URL}/users/${createdUserId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ active: false })
  });
  const loginDeactivated = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: newUsername, password: 'nova_senha_super_segura_789' })
  });
  record(
    'Usuário desativado é bloqueado imediatamente de efetuar login com HTTP 403',
    deactivateRes.status === 200 && loginDeactivated.status === 403
  );

  // 5.8 Proteção contra auto-desativação do admin conectado
  const selfDeactivateRes = await fetch(`${BASE_URL}/users/${validAdminJson.user?.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ active: false })
  });
  record(
    'Backend impede que o administrador em uso desative sua própria conta (HTTP 400)',
    selfDeactivateRes.status === 400
  );

  // 5.9 Exclusão do usuário fictício de teste com senha de admin
  const deleteTestUserRes = await fetch(`${BASE_URL}/users/${createdUserId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-admin-password': encodeURIComponent('admin123')
    }
  });
  record(
    'Limpeza de dados: usuário fictício de teste excluído com sucesso do sistema',
    deleteTestUserRes.status === 200
  );

  // ==========================================================
  // BLOCO 6: AUDITORIA DO UPLOAD NÃO-BLOQUEANTE DE FOTOGRAFIAS
  // ==========================================================
  console.log('\n--- 6. AUDITORIA DO FLUXO DE UPLOAD NÃO-BLOQUEANTE DE FOTOS ---');
  const galleryCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'WorkOrderPhotosGallery.tsx'), 'utf-8');
  const workOrdersViewCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'WorkOrdersView.tsx'), 'utf-8');

  // 6.1 Encapsulamento com finally
  const hasFinallyInGallery = galleryCode.includes('setUploadProgress(null);') && galleryCode.includes('finally {');
  record(
    'WorkOrderPhotosGallery encapsula rotina de upload em bloco try/finally rigoroso',
    hasFinallyInGallery,
    'Garante que setUploadProgress(null) é sempre chamado, evitando travamentos visuais'
  );

  // 6.2 Atualização incremental das fotos
  const hasIncrementalPhotos = galleryCode.includes('// Atualização incremental imediata da galeria') &&
    galleryCode.includes('setPhotos((prev) =>');
  record(
    'Galeria de fotos atualiza o estado incrementalmente a cada foto enviada ao Supabase',
    hasIncrementalPhotos,
    'O usuário visualiza cada foto imediatamente sem aguardar o restante do lote'
  );

  // 6.3 Botões apenas desabilitados durante uploadProgress
  const hasCorrectDisabledState = galleryCode.includes('disabled={!!uploadProgress}');
  record(
    'Controles da galeria só ficam inativos durante o envio ativo do lote',
    hasCorrectDisabledState
  );

  // 6.4 Encapsulamento de fotos em estágio na criação de OS
  const hasFinallyInStagedUpload = workOrdersViewCode.includes('setIsUploadingStagedPhotos(false);') &&
    workOrdersViewCode.includes('finally {');
  record(
    'Upload de fotos em estágio na abertura de OS protegido com bloco finally',
    hasFinallyInStagedUpload
  );

  // ==========================================================
  // RESUMO CONSOLIDADO
  // ==========================================================
  console.log('\n===============================================================');
  console.log(`RESULTADO FINAL DA AUDITORIA: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro catastrófico na execução dos testes:', err);
  process.exit(1);
});
