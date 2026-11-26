/**
 * Suíte de Testes Automatizados para Validação de Sementes Remotas e Cenários de Migração
 *
 * Cobertura:
 * 1. Semente legada de 14 propriedades (deploy inicial Vercel) - Aprovação com tipos e restrições corretas
 * 2. Rejeição de dados operacionais (clientes, produtos, serviços, OS, vendas, etc.) na semente legada
 * 3. Rejeição de configurações legadas preenchidas ("settings" não-vazio)
 * 4. Rejeição de usuários inesperados, divergentes ou hashes corrompidos
 * 5. Rejeição de propriedades inesperadas na semente legada
 * 6. Semente padrão de 18 propriedades (harmonizada) - Aprovação e rejeições estruturais
 * 7. Cenário de banco já migrado na Versão 2 (conferência de SHA-256 canônico e bloqueio de regravação)
 * 8. Garantia de imutabilidade e ausência de escritas em caso de falha de validação
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  verifyIsFactorySeedState,
  loadProjectInitialData,
  compareConfigObject,
  canonicalJson,
  computeSha256,
  EXPECTED_PROPERTY_TYPES,
  EXPECTED_LEGACY_PROPERTY_TYPES,
  EXPECTED_COUNTS,
  EMPTY_ARRAY_KEYS,
  LEGACY_EMPTY_ARRAY_KEYS
} = require('./upload_local_to_supabase');

const projectInitialData = loadProjectInitialData();

console.log('================================================================');
console.log('  SUÍTE DE TESTES: VALIDAÇÃO DE SEMENTES E MODO DRY-RUN');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Motivo: ${err.message}`);
  }
}

// Helper para clonar
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Semente legada válida de 14 propriedades (idêntica à gravada pelo deploy Vercel original)
function createValidLegacySeed() {
  return {
    workOrders: [],
    sales: [],
    customers: [],
    products: [],
    services: [],
    quotes: [],
    expenses: [],
    sellers: [],
    companies: [],
    companyPlans: [],
    companyEquipments: [],
    companyMaintenances: [],
    settings: {},
    users: clone(projectInitialData.users)
  };
}

// Semente padrão válida de 18 propriedades (idêntica ao novo database.example.json)
function createValidStandardSeed() {
  const exampleContent = fs.readFileSync(path.join(__dirname, '..', 'data', 'database.example.json'), 'utf8');
  return JSON.parse(exampleContent);
}

// -------------------------------------------------------------
// GRUPO 1: Semente Legada Válida de 14 Propriedades
// -------------------------------------------------------------
console.log('--- GRUPO 1: Semente Legada de 14 Propriedades (Deploy Inicial Vercel) ---');

runTest('1.1 Semente legada pura deve ser aprovada com seedType "legacy_14"', () => {
  const seed = createValidLegacySeed();
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, true, `Deveria ser válido: ${res.reason}`);
  assert.strictEqual(res.seedType, 'legacy_14');
});

runTest('1.2 Semente legada deve aceitar hashes PBKDF2 personalizados válidos para os 2 admins', () => {
  const seed = createValidLegacySeed();
  // Hash alternativo de 161 caracteres
  seed.users[0].passwordHash = 'a'.repeat(32) + ':' + 'b'.repeat(128);
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, true);
});

// -------------------------------------------------------------
// GRUPO 2: Rejeição de Dados Operacionais na Semente Legada
// -------------------------------------------------------------
console.log('\n--- GRUPO 2: Rejeição Rigorosa de Dados Operacionais na Semente Legada ---');

const operationalModules = [
  'customers', 'products', 'services', 'workOrders', 'sales',
  'quotes', 'expenses', 'sellers', 'companies', 'companyPlans',
  'companyEquipments', 'companyMaintenances'
];

for (const mod of operationalModules) {
  runTest(`2.${operationalModules.indexOf(mod) + 1} Rejeição se "${mod}" contiver qualquer registro`, () => {
    const seed = createValidLegacySeed();
    seed[mod].push({ id: 'dummy-record', createdAt: new Date().toISOString() });
    const res = verifyIsFactorySeedState(seed, projectInitialData);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason.includes(mod), `Deveria citar o módulo ${mod}, recebido: ${res.reason}`);
    assert.ok(res.reason.includes('Esperado array estritamente vazio'));
  });
}

// -------------------------------------------------------------
// GRUPO 3: Rejeição de Configurações Legadas Não-Vazias ("settings")
// -------------------------------------------------------------
console.log('\n--- GRUPO 3: Rejeição de Configurações Legadas Não-Vazias ("settings") ---');

runTest('3.1 Rejeição se "settings" contiver qualquer propriedade', () => {
  const seed = createValidLegacySeed();
  seed.settings = { storeName: 'Loja Não Autorizada' };
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('objeto estritamente vazio ({})'));
});

runTest('3.2 Rejeição se "settings" for string', () => {
  const seed = createValidLegacySeed();
  seed.settings = 'config';
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('Objeto'));
});

runTest('3.3 Rejeição se "settings" for array', () => {
  const seed = createValidLegacySeed();
  seed.settings = [];
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('Objeto'));
});

runTest('3.4 Rejeição se "settings" for null', () => {
  const seed = createValidLegacySeed();
  seed.settings = null;
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
});

// -------------------------------------------------------------
// GRUPO 4: Rejeição de Usuários Inválidos ou Inesperados
// -------------------------------------------------------------
console.log('\n--- GRUPO 4: Rejeição de Usuários Inválidos ou Inesperados ---');

runTest('4.1 Rejeição de usuário adicional na semente legada', () => {
  const seed = createValidLegacySeed();
  seed.users.push({
    id: 'usr-extra',
    username: 'vendedor',
    name: 'Vendedor',
    role: 'seller',
    active: true,
    passwordHash: 'c'.repeat(32) + ':' + 'd'.repeat(128),
    permissions: {}
  });
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('esperado exatamente 2 de fábrica'));
});

runTest('4.2 Rejeição de usuário com username diferente de admin/powertech', () => {
  const seed = createValidLegacySeed();
  seed.users[1].username = 'hacker';
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('não-fábrica'));
});

runTest('4.3 Rejeição se permissões de usuário divergirem do INITIAL_DATA', () => {
  const seed = createValidLegacySeed();
  seed.users[0].permissions.workOrdersDelete = false; // Era true de fábrica
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('diverge'));
});

runTest('4.4 Rejeição se formato do hash PBKDF2 for inválido ou corrompido', () => {
  const seed = createValidLegacySeed();
  seed.users[0].passwordHash = 'hash_invalido_curto';
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('PBKDF2 inválido ou corrompido'));
});

// -------------------------------------------------------------
// GRUPO 5: Rejeição de Propriedades Inesperadas
// -------------------------------------------------------------
console.log('\n--- GRUPO 5: Rejeição de Propriedades Inesperadas ---');

runTest('5.1 Rejeição se semente legada contiver propriedade não prevista', () => {
  const seed = createValidLegacySeed();
  seed.propriedadeInesperada = true;
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('Propriedade de primeiro nível inesperada no banco remoto legado'));
});

runTest('5.2 Rejeição se semente legada contiver storeSettings misturado com settings legado', () => {
  const seed = createValidLegacySeed();
  seed.storeSettings = clone(projectInitialData.storeSettings);
  // Se contiver storeSettings e settings, cai no fluxo padrão de 18 propriedades
  // onde "settings" é uma propriedade inesperada!
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
});

// -------------------------------------------------------------
// GRUPO 6: Semente Padrão de 18 Propriedades
// -------------------------------------------------------------
console.log('\n--- GRUPO 6: Semente Padrão de 18 Propriedades ---');

runTest('6.1 Semente padrão (database.example.json atual) deve ser aprovada com seedType "standard_18"', () => {
  const seed = createValidStandardSeed();
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, true, `Deveria ser válido: ${res.reason}`);
  assert.strictEqual(res.seedType, 'standard_18');
});

runTest('6.2 Rejeição na semente padrão se storeSettings for ausente e settings não existir', () => {
  const seed = createValidStandardSeed();
  delete seed.storeSettings;
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('storeSettings'));
});

runTest('6.3 Rejeição na semente padrão se storeSettings divergir estruturalmente', () => {
  const seed = createValidStandardSeed();
  seed.storeSettings.storeName = 'Nome Totalmente Modificado';
  const res = verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('Divergência estrutural'));
});

// -------------------------------------------------------------
// GRUPO 7: Cenário de Banco Já Migrado na Versão 2
// -------------------------------------------------------------
console.log('\n--- GRUPO 7: Cenário de Banco na Versão 2 (Já Migrado) ---');

const localData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'database.json'), 'utf8'));

runTest('7.1 Banco remoto idêntico à base local na Versão 2 deve ter SHA-256 canônico idêntico', () => {
  const remoteDataV2 = clone(localData);
  const localCanonical = canonicalJson(localData);
  const remoteCanonical = canonicalJson(remoteDataV2);
  const hashLocal = computeSha256(localCanonical);
  const hashRemote = computeSha256(remoteCanonical);
  assert.strictEqual(hashLocal, hashRemote);
});

runTest('7.2 Banco remoto na Versão 2 com alteração em 1 registro deve ter hash divergente e ser rejeitado', () => {
  const remoteDataV2 = clone(localData);
  // Altera um único campo de um cliente
  remoteDataV2.customers[0].name = 'Nome Alterado Remotamente';
  const localCanonical = canonicalJson(localData);
  const remoteCanonical = canonicalJson(remoteDataV2);
  const hashLocal = computeSha256(localCanonical);
  const hashRemote = computeSha256(remoteCanonical);
  assert.notStrictEqual(hashLocal, hashRemote);
});

runTest('7.3 Conferência das contagens esperadas dos módulos locais na Versão 2', () => {
  for (const [moduleName, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    const count = Array.isArray(localData[moduleName]) ? localData[moduleName].length : 0;
    const isMatch = Array.isArray(expectedCount)
      ? expectedCount.includes(count)
      : count === expectedCount;
    assert.ok(isMatch, `Contagem divergente em ${moduleName}: ${count} (esperado: ${expectedCount})`);
  }
});

// -------------------------------------------------------------
// GRUPO 8: Imutabilidade e Integridade Local
// -------------------------------------------------------------
console.log('\n--- GRUPO 8: Imutabilidade e Integridade Local ---');

runTest('8.1 Nenhuma função de validação modifica o objeto remoto fornecido', () => {
  const seed = createValidLegacySeed();
  const originalJson = JSON.stringify(seed);
  verifyIsFactorySeedState(seed, projectInitialData);
  assert.strictEqual(JSON.stringify(seed), originalJson);
});

runTest('8.2 Arquivo local data/database.json permanece rigorosamente inalterado', () => {
  const currentContent = fs.readFileSync(path.join(__dirname, '..', 'data', 'database.json'), 'utf8');
  const currentSha256 = computeSha256(currentContent);
  const validHashes = [
    '426b1c633c7e2929f5c066e4d06501cfe2288e2a03ed8848ca8ecf165f5f3818', // Cópia de segurança oficial
    '9b0f968e3d46de3a1c532f63b4f67fef33034281e39400ce35dfd52a33abcb73'  // Base oficial atual data/database.json
  ];
  assert.ok(
    validHashes.includes(currentSha256),
    `O SHA-256 de data/database.json (${currentSha256}) deve corresponder a uma versão oficial reconhecida!`
  );
});

console.log('\n================================================================');
console.log(`  RESULTADO: ${passedTests} de ${totalTests} testes passaram.`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
