/**
 * Supabase & PostgreSQL Cloud Integration Service
 * Suporta conexão via PostgreSQL Pool (POSTGRES_URL / DATABASE_URL)
 * e via cliente REST (@supabase/supabase-js com SUPABASE_URL e chaves).
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

let pgPool = null;
let supabaseClient = null;
let isInitialized = false;

// Obtém URL do Postgres provida pelo Vercel + Supabase
const postgresUrl = 
  process.env.POSTGRES_URL || 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.DATABASE_URL || 
  process.env.SUPABASE_DB_URL || 
  null;

// Obtém credenciais da API Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
const supabaseKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  null;

function isSupabaseConfigured() {
  return Boolean(postgresUrl || (supabaseUrl && supabaseKey));
}

function getPgPool() {
  if (!pgPool && postgresUrl) {
    pgPool = new Pool({
      connectionString: postgresUrl,
      ssl: postgresUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    pgPool.on('error', (err) => {
      console.error('[Supabase/Postgres Pool Error]', err.message);
    });
  }
  return pgPool;
}

function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

/**
 * Inicializa a tabela no Supabase/PostgreSQL caso ainda não exista
 */
async function initSupabase(fallbackData) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const pool = getPgPool();
  if (pool) {
    try {
      console.log('[Supabase] Conectando ao PostgreSQL na nuvem...');
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS system_store (
            key text PRIMARY KEY,
            data jsonb NOT NULL,
            updated_at timestamptz DEFAULT now()
          );
        `);
        console.log('[Supabase] Tabela "system_store" verificada com sucesso.');

        // Verifica se os dados principais já existem
        const res = await client.query('SELECT data FROM system_store WHERE key = $1', ['main_database']);
        if (res.rows && res.rows.length > 0 && res.rows[0].data) {
          console.log('[Supabase] Dados principais carregados do banco em nuvem.');
          isInitialized = true;
          return res.rows[0].data;
        } else if (fallbackData) {
          console.log('[Supabase] Populando banco em nuvem com os dados iniciais...');
          await client.query(
            'INSERT INTO system_store (key, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = now()',
            ['main_database', JSON.stringify(fallbackData)]
          );
          isInitialized = true;
          return fallbackData;
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[Supabase] Erro ao conectar via PostgreSQL Pool:', err.message);
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      console.log('[Supabase] Conectando via REST Client (@supabase/supabase-js)...');
      const { data, error } = await client
        .from('system_store')
        .select('data')
        .eq('key', 'main_database')
        .maybeSingle();

      if (!error && data && data.data) {
        console.log('[Supabase] Dados principais obtidos com sucesso via REST.');
        isInitialized = true;
        return data.data;
      } else if (fallbackData) {
        console.log('[Supabase] Tentando inicializar dados via REST...');
        const { error: upsertErr } = await client
          .from('system_store')
          .upsert({
            key: 'main_database',
            data: fallbackData,
            updated_at: new Date().toISOString()
          });
        if (!upsertErr) {
          console.log('[Supabase] Dados iniciais gravados via REST com sucesso.');
          isInitialized = true;
          return fallbackData;
        } else {
          console.warn('[Supabase] Aviso ao gravar via REST (verifique se a tabela system_store foi criada):', upsertErr.message);
        }
      }
    } catch (err) {
      console.error('[Supabase] Erro ao conectar via REST Client:', err.message);
    }
  }

  return null;
}

/**
 * Salva os dados no Supabase / PostgreSQL em nuvem
 */
async function saveToSupabase(data) {
  if (!isSupabaseConfigured() || !data) return false;

  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO system_store (key, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = now()',
        ['main_database', JSON.stringify(data)]
      );
      return true;
    } catch (err) {
      console.error('[Supabase] Falha ao salvar no PostgreSQL:', err.message);
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from('system_store')
        .upsert({
          key: 'main_database',
          data,
          updated_at: new Date().toISOString()
        });
      if (!error) return true;
      console.error('[Supabase] Falha ao salvar via REST:', error.message);
    } catch (err) {
      console.error('[Supabase] Erro na requisição REST de salvamento:', err.message);
    }
  }

  return false;
}

module.exports = {
  isSupabaseConfigured,
  initSupabase,
  saveToSupabase,
  getPgPool,
  getSupabaseClient
};
