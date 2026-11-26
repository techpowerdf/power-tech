/**
 * Script de Diagnóstico Estritamente Somente-Leitura para o Supabase
 *
 * Objetivo:
 * - Inspecionar a estrutura exata da coluna `data` do registro 'main_database' no Supabase.
 * - Determinar se está armazenado como jsonb/objeto, string ou objeto aninhado.
 * - Listar todas as chaves de primeiro nível e comparar com o modelo esperado.
 * - NENHUMA gravação, alteração, remoção ou migração é realizada.
 * - NENHUM dado pessoal, senha, hash ou credencial é exibido.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const EXPECTED_PROPERTIES = [
  'storeSettings',
  'fiscalConfig',
  'backupSettings',
  'backupHistory',
  'customers',
  'products',
  'services',
  'workOrders',
  'sales',
  'quotes',
  'fiscalInvoices',
  'users',
  'sellers',
  'expenses',
  'companies',
  'companyPlans',
  'companyEquipments',
  'companyMaintenances'
];

function getSslConfiguration(urlString) {
  const parsed = new URL(urlString);
  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }

  const sslConfig = {
    rejectUnauthorized: true,
    servername: hostname
  };

  const caCertPath = process.env.PGSSLROOTCERT;
  if (caCertPath) {
    if (fs.existsSync(caCertPath)) {
      sslConfig.ca = fs.readFileSync(caCertPath).toString();
    } else {
      console.warn(`[Aviso SSL] Caminho PGSSLROOTCERT especificado, mas não encontrado: ${caCertPath}`);
    }
  }

  return sslConfig;
}

async function runDiagnosis() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    console.error('ERRO: A variável de ambiente POSTGRES_URL não está configurada no ambiente.');
    console.error('Para executar este diagnóstico, disponibilize temporariamente POSTGRES_URL no terminal.');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('  DIAGNÓSTICO TÉCNICO SOMENTE-LEITURA: SUPABASE (system_store)');
  console.log('================================================================\n');

  console.log('1. Conectando ao Supabase com validação SSL estrita (rejectUnauthorized: true)...');
  const sslConfig = getSslConfiguration(postgresUrl);
  const pool = new Pool({
    connectionString: postgresUrl,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    max: 1
  });

  let client = null;
  try {
    client = await pool.connect();
    console.log('   ✓ Conexão TLS/SSL estabelecida com sucesso.\n');

    console.log('2. Consultando metadados do tipo de dado e versão no PostgreSQL...');
    const metaRes = await client.query(
      `SELECT
         pg_typeof(data)::text AS col_pg_type,
         jsonb_typeof(data)::text AS jsonb_type,
         version,
         updated_at
       FROM public.system_store
       WHERE key = $1`,
      ['main_database']
    );

    if (!metaRes.rows || metaRes.rows.length === 0) {
      console.log('   ❌ Registro "main_database" NÃO existe na tabela system_store.');
      return;
    }

    const meta = metaRes.rows[0];
    console.log(`   ✓ Tipo da coluna no PostgreSQL (pg_typeof): ${meta.col_pg_type}`);
    console.log(`   ✓ Tipo JSON no PostgreSQL (jsonb_typeof):   ${meta.jsonb_type}`);
    console.log(`   ✓ Versão atual no banco remoto:             ${meta.version}`);
    console.log(`   ✓ Data da última modificação:                ${meta.updated_at}\n`);

    console.log('3. Lendo o conteúdo da coluna "data" via driver node-postgres...');
    const dataRes = await client.query(
      'SELECT data FROM public.system_store WHERE key = $1',
      ['main_database']
    );

    const rawData = dataRes.rows[0].data;
    const jsType = typeof rawData;
    const isArray = Array.isArray(rawData);
    console.log(`   ✓ Tipo retornado ao JavaScript:              ${jsType}`);
    console.log(`   ✓ É Array?                                   ${isArray ? 'Sim' : 'Não'}`);

    let parsedData = rawData;
    let isDoubleEncoded = false;
    if (typeof rawData === 'string') {
      try {
        parsedData = JSON.parse(rawData);
        isDoubleEncoded = true;
        console.log('   ⚠️ Detectada string JSON (possível serialização dupla).');
      } catch (e) {
        console.log('   ❌ String não pôde ser parseada como JSON.');
      }
    } else {
      console.log('   ✓ Dado entregue nativamente como Objeto JavaScript (sem serialização dupla).');
    }

    console.log('\n4. Análise de aninhamento e chaves de primeiro nível:');
    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
      console.log('   ❌ O dado remoto não é um objeto JSON válido.');
      return;
    }

    const actualKeys = Object.keys(parsedData);
    console.log(`   ✓ Total de chaves encontradas no primeiro nível: ${actualKeys.length}`);
    console.log(`   ✓ Lista das chaves remotas: [ ${actualKeys.map(k => `"${k}"`).join(', ')} ]\n`);

    console.log('5. Detalhamento dos tipos e contagens de cada chave remota:');
    for (const key of actualKeys) {
      const val = parsedData[key];
      if (Array.isArray(val)) {
        console.log(`   - "${key}": Array (${val.length} itens)`);
      } else if (val === null) {
        console.log(`   - "${key}": null`);
      } else if (typeof val === 'object') {
        const subkeys = Object.keys(val);
        console.log(`   - "${key}": Objeto (${subkeys.length} propriedades: [ ${subkeys.slice(0, 5).join(', ')}${subkeys.length > 5 ? '...' : ''} ])`);
      } else {
        console.log(`   - "${key}": ${typeof val}`);
      }
    }

    console.log('\n6. Confronto direto com as 18 propriedades exigidas pelo modelo atual:');
    const missingKeys = EXPECTED_PROPERTIES.filter(k => !parsedData.hasOwnProperty(k));
    const extraKeys = actualKeys.filter(k => !EXPECTED_PROPERTIES.includes(k));

    if (missingKeys.length === 0) {
      console.log('   ✓ Todas as 18 propriedades obrigatórias estão presentes.');
    } else {
      console.log(`   ❌ Propriedades OBRIGATÓRIAS AUSENTES (${missingKeys.length}):`);
      for (const k of missingKeys) {
        console.log(`      • "${k}"`);
      }
    }

    if (extraKeys.length > 0) {
      console.log(`   ⚠️ Propriedades EXTRAS/INESPERADAS (${extraKeys.length}):`);
      for (const k of extraKeys) {
        console.log(`      • "${k}"`);
      }
    }

    console.log('\n7. Validação de Usuários Remotos (sem expor hashes ou senhas):');
    if (Array.isArray(parsedData.users)) {
      console.log(`   ✓ Total de usuários no banco remoto: ${parsedData.users.length}`);
      for (const u of parsedData.users) {
        const uname = u.username || 'sem_username';
        const urole = u.role || 'sem_role';
        const hasHash = Boolean(u.passwordHash);
        console.log(`      • Usuário: "${uname}" | Papel: "${urole}" | Hash presente? ${hasHash ? 'Sim' : 'Não'}`);
      }
    } else {
      console.log('   ❌ Propriedade "users" não é um array.');
    }

    console.log('\n================================================================');
    console.log('  CONCLUSÃO DO DIAGNÓSTICO');
    console.log('================================================================');
    if (missingKeys.includes('storeSettings') && extraKeys.includes('settings')) {
      console.log('DIAGNÓSTICO CONFIRMADO:');
      console.log('O banco remoto foi inicializado com a estrutura legada de "data/database.example.json"');
      console.log('(que possui "settings: {}" em vez de "storeSettings", e não contém fiscalConfig,');
      console.log('backupSettings, backupHistory e fiscalInvoices).');
      console.log('Essa semente foi gravada automaticamente pelo serverless na primeira inicialização.');
    }
    console.log('Nenhuma alteração foi realizada no Supabase ou no ambiente local.');

  } catch (err) {
    console.error('❌ ERRO DURANTE A INSPEÇÃO:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runDiagnosis();
