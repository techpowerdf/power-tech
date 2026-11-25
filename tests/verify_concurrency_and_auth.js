const { verifyPassword, hashPassword, ensureDefaultAdminUser } = require('../server/authService');
const { getDatabase, saveDatabase, ensureDatabaseLoaded, getCurrentDbVersion } = require('../server/db');
const { saveToSupabase } = require('../server/supabaseService');

async function testAuthentication() {
  console.log('--- TESTE 1: AUTENTICAÇÃO E PRESERVAÇÃO DE SENHAS ---');
  
  const db = getDatabase();
  const admin = db.users.find(u => u.username === 'admin');
  const powertech = db.users.find(u => u.username === 'Powertech');

  // 1.1 Confirmação dos hashes PBKDF2 atuais
  const adminValid = verifyPassword('admin123', admin.passwordHash);
  const powertechValid = verifyPassword('admin123', powertech.passwordHash);

  console.log('1.1 Hash PBKDF2 admin válido com admin123:', adminValid ? '✓ SIM' : '❌ NÃO');
  console.log('1.2 Hash PBKDF2 Powertech válido com admin123:', powertechValid ? '✓ SIM' : '❌ NÃO');

  if (!adminValid || !powertechValid) {
    throw new Error('Falha na validação de hash PBKDF2 dos administradores!');
  }

  // 1.2 Teste de não-sobrescrita de senha personalizada
  console.log('1.3 Simulando alteração de senha do admin para senha customizada...');
  const customPass = 'MinhaSenhaSegura@2026';
  const customHash = hashPassword(customPass);
  
  // Cria clone para teste isolado
  const mockDb = {
    users: [
      {
        id: 'usr-admin-default-admin',
        username: 'admin',
        name: 'Administrador Power Tech',
        role: 'admin',
        active: true,
        passwordHash: customHash
      }
    ]
  };

  // Executa ensureDefaultAdminUser
  ensureDefaultAdminUser(mockDb);

  // Verifica se o hash continua sendo o customizado
  const stillCustom = verifyPassword(customPass, mockDb.users[0].passwordHash);
  const revertedToDefault = verifyPassword('admin123', mockDb.users[0].passwordHash);

  console.log('1.4 Senha personalizada preservada após inicialização:', stillCustom ? '✓ SIM' : '❌ NÃO');
  console.log('1.5 Não foi resetada para a padrão admin123:', !revertedToDefault ? '✓ SIM' : '❌ NÃO');

  if (!stillCustom || revertedToDefault) {
    throw new Error('Falha: ensureDefaultAdminUser sobrescreveu a senha personalizada!');
  }

  console.log('✓ TESTE 1 PASSOU COM SUCESSO!\n');
}

async function testConcurrencyOCC() {
  console.log('--- TESTE 2: CONCORRÊNCIA E CONTROLE OTIMISTA (OCC) ---');

  // Simula o comportamento do Supabase com verificação de versão condicional
  let cloudDatabase = {
    key: 'main_database',
    version: 1,
    data: { workOrders: [{ id: 'os-1', number: 1001, status: 'aberto' }] }
  };

  function mockSupabaseConditionalUpdate(key, newData, newVersion, expectedVersion) {
    if (cloudDatabase.version !== expectedVersion) {
      // Conflito de versão! RowCount = 0
      const err = new Error(`CONFLITO_CONCORRENCIA: Versão esperada ${expectedVersion}, versão atual ${cloudDatabase.version}`);
      err.code = 'OCC_CONFLICT';
      throw err;
    }
    cloudDatabase.data = JSON.parse(JSON.stringify(newData));
    cloudDatabase.version = newVersion;
    return { rowCount: 1, version: newVersion };
  }

  console.log('2.1 Estado inicial do banco na nuvem: Versão', cloudDatabase.version);

  // Instância A e Instância B leem a versão 1
  const instanceA_readVersion = cloudDatabase.version;
  const instanceB_readVersion = cloudDatabase.version;
  console.log('2.2 Instância A leu versão:', instanceA_readVersion);
  console.log('2.3 Instância B leu versão:', instanceB_readVersion);

  // Instância A adiciona Ordem de Serviço #1002 e grava com sucesso
  console.log('2.4 Instância A grava OS #1002 com expectedVersion =', instanceA_readVersion);
  const dataA = {
    workOrders: [
      ...cloudDatabase.data.workOrders,
      { id: 'os-2', number: 1002, status: 'em_andamento' }
    ]
  };
  const resA = mockSupabaseConditionalUpdate('main_database', dataA, instanceA_readVersion + 1, instanceA_readVersion);
  console.log(`✓ Instância A gravou com sucesso! Nova versão no banco: ${resA.version}`);

  // Instância B tenta gravar OS #1003 usando seu expectedVersion defasado (versão 1)
  console.log('2.5 Instância B tenta gravar OS #1003 com expectedVersion desatualizado =', instanceB_readVersion);
  const dataB = {
    workOrders: [
      ...cloudDatabase.data.workOrders.slice(0, 1), // tem apenas a OS 1001
      { id: 'os-3', number: 1003, status: 'analise' }
    ]
  };

  let conflictCaught = false;
  try {
    mockSupabaseConditionalUpdate('main_database', dataB, instanceB_readVersion + 1, instanceB_readVersion);
  } catch (err) {
    if (err.code === 'OCC_CONFLICT') {
      conflictCaught = true;
      console.log('✓ Instância B bloqueada com OCC_CONFLICT! Sobrescrita evitada com sucesso.');
    }
  }

  if (!conflictCaught) {
    throw new Error('Falha crítica: Instância B conseguiu sobrescrever dados da Instância A!');
  }

  // Verifica se a gravação da Instância A foi preservada intacta
  const os1002Exists = cloudDatabase.data.workOrders.some(o => o.number === 1002);
  console.log('2.6 OS #1002 gravada pela Instância A permanece intacta:', os1002Exists ? '✓ SIM' : '❌ NÃO');

  if (!os1002Exists) {
    throw new Error('Falha: OS #1002 foi perdida!');
  }

  // Instância B recarrega a versão mais recente e reaplica a alteração
  console.log('2.7 Instância B recarrega dados mais recentes (Versão', cloudDatabase.version, ')...');
  const freshReadVersion = cloudDatabase.version;
  const mergedDataB = {
    workOrders: [
      ...cloudDatabase.data.workOrders,
      { id: 'os-3', number: 1003, status: 'analise' }
    ]
  };
  const resB = mockSupabaseConditionalUpdate('main_database', mergedDataB, freshReadVersion + 1, freshReadVersion);
  console.log(`✓ Instância B gravou após recarregar! Nova versão no banco: ${resB.version}`);

  // Verifica se ambas as ordens coexistem
  const allOrders = cloudDatabase.data.workOrders.map(o => o.number);
  console.log('2.8 Todas as ordens coexistem sem perdas:', allOrders);
  if (!allOrders.includes(1001) || !allOrders.includes(1002) || !allOrders.includes(1003)) {
    throw new Error('Falha: nem todas as ordens foram preservadas!');
  }

  console.log('✓ TESTE 2 PASSOU COM SUCESSO!\n');
}

async function testPersistenceAndRestart() {
  console.log('--- TESTE 3: PERSISTÊNCIA LOCAL E RECUPERAÇÃO APÓS REINICIALIZAÇÃO ---');

  const db = getDatabase();
  const vInitial = getCurrentDbVersion();
  console.log('3.1 Versão atual em memória:', vInitial);

  // Adiciona um registro de teste
  const testId = `test-${Date.now()}`;
  db.customers.push({
    id: testId,
    name: 'Cliente Teste Reinicialização',
    phone: '(11) 98888-7777',
    createdAt: new Date().toISOString()
  });

  await saveDatabase(db);
  const vAfterSave = getCurrentDbVersion();
  console.log(`✓ Dados salvos com sucesso! Versão incrementada para: ${vAfterSave}`);

  // Simula reinicialização do contêiner limpando a variável inMemoryDb
  console.log('3.2 Simulando reinicialização a frio do contêiner (cold start)...');
  delete require.cache[require.resolve('../server/db')];
  const freshDbModule = require('../server/db');

  const freshDb = await freshDbModule.ensureDatabaseLoaded();
  const customerFound = freshDb.customers.find(c => c.id === testId);

  console.log('3.3 Cliente recuperado após reinicialização:', customerFound ? '✓ SIM' : '❌ NÃO');

  if (!customerFound) {
    throw new Error('Falha: Cliente de teste não foi encontrado após a reinicialização!');
  }

  // Limpeza do cliente de teste
  freshDb.customers = freshDb.customers.filter(c => c.id !== testId);
  await freshDbModule.saveDatabase(freshDb);
  console.log('3.4 Limpeza de dados de teste concluída com sucesso.');

  console.log('✓ TESTE 3 PASSOU COM SUCESSO!\n');
}

async function run() {
  try {
    await testAuthentication();
    await testConcurrencyOCC();
    await testPersistenceAndRestart();
    console.log('====================================================');
    console.log('TODAS AS 3 BATERIAS DE TESTES FORAM CONCLUÍDAS COM 100% DE SUCESSO!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES:', err.message);
    process.exit(1);
  }
}

run();
