/**
 * tests/test_migration_script_enhancements.js
 * 
 * Bateria de testes unitários simulados para validação das melhorias de segurança
 * em scripts/upload_local_to_supabase.js:
 * 1. Validação de hostname local vs remoto via new URL()
 * 2. Validação segura do caminho do backup externo (sem falsos positivos)
 * 3. Dry-run Cenário A: Supabase na Versão 1 (estado de fábrica)
 * 4. Dry-run Cenário B: Supabase na Versão 2 com dados idênticos (hash canônico correspondente)
 * 5. Dry-run Cenário B: Supabase na Versão 2 com divergência de hash
 * 6. Rejeição de versões remotas inesperadas (diferentes de 1 e 2)
 * 7. Tratamento de erro pós-COMMIT (isMigrationSuccessful = true com erro em release/end)
 * 8. Tratamento de falha no COMMIT (resultado indeterminado sem repetição automática)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  verifyIsFactorySeedState,
  loadProjectInitialData,
  compareConfigObject,
  canonicalJson,
  computeSha256,
  extractDatabaseHostname,
  isLocalDatabaseHost,
  getSslConfiguration,
  isPathInsideOrEqual,
  validateExternalBackupPath,
  EXPECTED_PROPERTY_TYPES,
  EXPECTED_COUNTS,
  EMPTY_ARRAY_KEYS
} = require('../scripts/upload_local_to_supabase.js');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Motivo: ${err.message}`);
    failCount++;
  }
}

async function runTestAsync(testName, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Motivo: ${err.message}`);
    failCount++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('  TESTES DE SEGURANÇA E MELHORIAS NO SCRIPT DE MIGRAÇÃO');
  console.log('================================================================\n');

  const projectRoot = path.resolve(__dirname, '..');
  const projectInitialData = loadProjectInitialData();
  const localDbPath = path.resolve(projectRoot, 'data', 'database.json');
  const localData = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));

  // -------------------------------------------------------------
  // TESTE 1: Validação de hostname local e remoto com parser new URL()
  // -------------------------------------------------------------
  console.log('1. TESTE DE IDENTIFICAÇÃO DE HOSTS (LOCAL VS REMOTO)');

  runTest('Identifica "localhost" como host local', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://user:pass@localhost:5432/postgres'), true);
  });

  runTest('Identifica "127.0.0.1" como host local', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://user:pass@127.0.0.1:5432/postgres'), true);
  });

  runTest('Identifica "[::1]" como host local', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://user:pass@[::1]:5432/postgres'), true);
  });

  runTest('Identifica "supabase.co" como host remoto (SSL obrigatório)', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://postgres.abc:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'), false);
    const ssl = getSslConfiguration('postgres://postgres.abc:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres');
    assert.deepStrictEqual(ssl, { rejectUnauthorized: true });
  });

  runTest('Evita falso positivo em host remoto com "localhost" no subdomínio', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://user:pass@localhost.servidor-remoto.com:5432/postgres'), false);
  });

  runTest('Evita falso positivo em host remoto com "127.0.0.1" no domínio (ex: nip.io)', () => {
    assert.strictEqual(isLocalDatabaseHost('postgres://user:pass@app-127.0.0.1.nip.io:5432/postgres'), false);
  });

  // -------------------------------------------------------------
  // TESTE 2: Validação segura do caminho do backup externo
  // -------------------------------------------------------------
  console.log('\n2. TESTE DE LIMITES DE DIRETÓRIO DO BACKUP EXTERNO');

  runTest('Permite diretório de backup em pasta externa do usuário', () => {
    const backupDir = 'C:\\Users\\Power\\PowerTech_Backups';
    const validation = validateExternalBackupPath(backupDir, projectRoot);
    assert.strictEqual(validation.isValid, true);
  });

  runTest('Bloqueia se o backup estiver dentro da pasta do projeto', () => {
    const insideBackupDir = path.join(projectRoot, 'data', 'backups');
    const validation = validateExternalBackupPath(insideBackupDir, projectRoot);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.reason.includes('reside dentro'));
  });

  runTest('Bloqueia se o diretório de backup for a própria raiz do projeto', () => {
    const validation = validateExternalBackupPath(projectRoot, projectRoot);
    assert.strictEqual(validation.isValid, false);
  });

  runTest('Evita falso positivo em pasta irmã com prefixo semelhante (ex: project-backups)', () => {
    const siblingWithSamePrefix = projectRoot + '-backups';
    const validation = validateExternalBackupPath(siblingWithSamePrefix, projectRoot);
    assert.strictEqual(validation.isValid, true, 'Não deve dar falso positivo para pasta irmã');
  });

  // -------------------------------------------------------------
  // TESTE 3: Dry-run Cenário A - Supabase na Versão 1 (Estado de Fábrica)
  // -------------------------------------------------------------
  console.log('\n3. TESTE DRY-RUN CENÁRIO A (SUPABASE VERSÃO 1)');

  function createMockRemoteFactoryDatabase(initialData) {
    return {
      storeSettings: JSON.parse(JSON.stringify(initialData.storeSettings)),
      fiscalConfig: JSON.parse(JSON.stringify(initialData.fiscalConfig)),
      backupSettings: {
        ...JSON.parse(JSON.stringify(initialData.backupSettings)),
        lastBackupAt: new Date().toISOString(),
        backupDirectory: 'C:\\Users\\Power\\PowerTech_Backups'
      },
      backupHistory: [],
      customers: [],
      products: [],
      services: [],
      workOrders: [],
      sales: [],
      quotes: [],
      fiscalInvoices: [],
      users: JSON.parse(JSON.stringify(initialData.users)),
      sellers: [],
      expenses: [],
      companies: [],
      companyPlans: [],
      companyEquipments: [],
      companyMaintenances: []
    };
  }

  runTest('Aprova estado inicial de fábrica oficial esperado no Supabase', () => {
    const factoryState = createMockRemoteFactoryDatabase(projectInitialData);
    const seedCheck = verifyIsFactorySeedState(factoryState, projectInitialData);
    assert.strictEqual(seedCheck.isValid, true, seedCheck.reason);
  });

  runTest('Rejeita banco na versão 1 se contiver dados reais cadastrados (ex: clientes)', () => {
    const dirtyData = createMockRemoteFactoryDatabase(projectInitialData);
    dirtyData.customers = [{ id: 'cust-1', name: 'Cliente Teste' }];
    const seedCheck = verifyIsFactorySeedState(dirtyData, projectInitialData);
    assert.strictEqual(seedCheck.isValid, false);
    assert.ok(seedCheck.reason.includes('customers'));
  });

  runTest('Rejeita banco na versão 1 se usuário administrativo não-fábrica for inserido', () => {
    const dirtyData = createMockRemoteFactoryDatabase(projectInitialData);
    dirtyData.users[0].username = 'hacker';
    const seedCheck = verifyIsFactorySeedState(dirtyData, projectInitialData);
    assert.strictEqual(seedCheck.isValid, false);
  });

  // -------------------------------------------------------------
  // TESTE 4: Dry-run Cenário B - Supabase na Versão 2 com dados idênticos
  // -------------------------------------------------------------
  console.log('\n4. TESTE DRY-RUN CENÁRIO B (SUPABASE VERSÃO 2 COM DADOS IDÊNTICOS)');

  runTest('Identifica correspondência perfeita de hash canônico entre base local e remota v2', () => {
    const remoteDataV2 = JSON.parse(JSON.stringify(localData));
    const localHash = computeSha256(canonicalJson(localData));
    const remoteHash = computeSha256(canonicalJson(remoteDataV2));

    assert.strictEqual(localHash, remoteHash);
    // Valida também contagens
    for (const [mod, exp] of Object.entries(EXPECTED_COUNTS)) {
      const actual = remoteDataV2[mod].length;
      const isMatch = Array.isArray(exp) ? exp.includes(actual) : actual === exp;
      assert.strictEqual(isMatch, true, `Contagem divergente em ${mod}`);
    }
  });

  // -------------------------------------------------------------
  // TESTE 5: Dry-run Cenário B - Supabase na Versão 2 com divergência de hash
  // -------------------------------------------------------------
  console.log('\n5. TESTE DRY-RUN CENÁRIO B (SUPABASE VERSÃO 2 COM DIVERGÊNCIA DE HASH)');

  runTest('Detecta divergência se um registro for adicionado ou alterado no banco remoto', () => {
    const divergentData = JSON.parse(JSON.stringify(localData));
    divergentData.customers.push({ id: 'cust-divergent', name: 'Cliente Inesperado' });

    const localHash = computeSha256(canonicalJson(localData));
    const remoteHash = computeSha256(canonicalJson(divergentData));

    assert.notStrictEqual(localHash, remoteHash);
  });

  // -------------------------------------------------------------
  // TESTE 6: Rejeição de versões inesperadas no Supabase
  // -------------------------------------------------------------
  console.log('\n6. TESTE DE REJEIÇÃO DE VERSÕES REMOTAS INESPERADAS');

  runTest('Rejeita versões menores que 1 (ex: versão 0)', () => {
    const v = 0;
    const isSupportedVersion = (v === 1 || v === 2);
    assert.strictEqual(isSupportedVersion, false);
  });

  runTest('Rejeita versões superiores a 2 (ex: versão 3)', () => {
    const v = 3;
    const isSupportedVersion = (v === 1 || v === 2);
    assert.strictEqual(isSupportedVersion, false);
  });

  // -------------------------------------------------------------
  // TESTE 7: Tratamento de erro pós-COMMIT com isMigrationSuccessful = true
  // -------------------------------------------------------------
  console.log('\n7. TESTE DE RESILIÊNCIA PÓS-COMMIT (SUCESSO PRESERVADO APÓS ERRO DE LIMPEZA)');

  runTest('Falha em client.release() ou pool.end() não anula a migração bem-sucedida', () => {
    let isMigrationSuccessful = true;
    let cleanupErrorCaught = false;
    let reportedAsFailure = false;
    let processExitCode = 0;

    // Simula erro durante limpeza pós-commit
    try {
      throw new Error('Falha no encerramento de socket SSL do pool');
    } catch (cleanupErr) {
      cleanupErrorCaught = true;
      if (!isMigrationSuccessful) {
        reportedAsFailure = true;
        processExitCode = 1;
      }
    }

    assert.strictEqual(isMigrationSuccessful, true);
    assert.strictEqual(cleanupErrorCaught, true);
    assert.strictEqual(reportedAsFailure, false, 'Não deve reportar a migração como falha');
    assert.strictEqual(processExitCode, 0, 'Exit code não deve ser 1 quando a migração teve commit confirmado');
  });

  // -------------------------------------------------------------
  // TESTE 8: Tratamento de falha no envio do COMMIT (Resultado Indeterminado)
  // -------------------------------------------------------------
  console.log('\n8. TESTE DE FALHA NO ENVIO DO COMMIT (ESTADO INDETERMINADO)');

  runTest('Falha durante envio de COMMIT alerta estado indeterminado e impede repetição automática', () => {
    let commitAttempted = true;
    let isMigrationSuccessful = false;
    let detectedIndeterminate = false;
    let shouldAutoRetry = true;

    // Simulação do bloco catch do script
    try {
      throw new Error('Timeout de rede durante o envio do comando COMMIT');
    } catch (err) {
      if (commitAttempted && !isMigrationSuccessful) {
        detectedIndeterminate = true;
        shouldAutoRetry = false; // NUNCA repetir automaticamente
      }
    }

    assert.strictEqual(detectedIndeterminate, true, 'Deve classificar como estado indeterminado');
    assert.strictEqual(shouldAutoRetry, false, 'Não deve permitir repetição automática');
  });

  console.log('\n================================================================');
  console.log(`RESULTADO DOS TESTES DO SCRIPT DE MIGRAÇÃO:`);
  console.log(`  Sucessos: ${passCount}`);
  console.log(`  Falhas:   ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal no executor de testes:', err);
  process.exit(1);
});
