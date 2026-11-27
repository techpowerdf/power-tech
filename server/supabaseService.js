/**
 * Supabase & PostgreSQL Cloud Integration Service
 * Configurado especificamente para Serverless (Vercel) e Transaction Pooler do Supabase.
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

let pgPool = null;
let supabaseClient = null;

function getPostgresUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL ||
    null
  );
}

function getSupabaseUrl() {
  const raw = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    // Retorna a origem limpa (ex: https://xyz.supabase.co), eliminando qualquer barra final ou subcaminhos como /rest/v1
    return parsed.origin;
  } catch (e) {
    return raw.replace(/\/+$/, '');
  }
}

function getSupabaseKey() {
  // Aceita exclusivamente a chave administrativa de serviço (SUPABASE_SERVICE_ROLE_KEY).
  // NUNCA aceita chaves públicas ou anônimas (SUPABASE_ANON_KEY).
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return key || null;
}

function isSupabaseConfigured() {
  return Boolean(getPostgresUrl() || (getSupabaseUrl() && getSupabaseKey()));
}

function getPgPool() {
  const url = getPostgresUrl();
  if (!pgPool && url) {
    pgPool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000, // 10 segundos para handshake seguro em cold start
      idleTimeoutMillis: 10000,
      max: 1 // Apenas 1 conexão por contêiner serverless para o Transaction Pooler
    });

    pgPool.on('error', (err) => {
      console.error('[Supabase/Postgres Pool Error]', err.message);
    });
  }
  return pgPool;
}

function getSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!supabaseClient && url && key) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

/**
 * Obtém a versão numérica atual do registro 'main_database' no Supabase
 * Utilizado para validação de concorrência ultra-rápida (~2ms)
 */
async function getCloudVersion() {
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT COALESCE(version, 1) as version FROM system_store WHERE key = $1', ['main_database']);
      if (res.rows && res.rows.length > 0) {
        return Number(res.rows[0].version || 1);
      }
      return null;
    } catch (err) {
      if (err.message && err.message.includes('version')) {
        return 1;
      }
      throw err;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('system_store')
        .select('version')
        .eq('key', 'main_database')
        .maybeSingle();
      if (!error && data) {
        return Number(data.version || 1);
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Inicializa e carrega os dados e a versão do Supabase/PostgreSQL
 */
async function initSupabase(fallbackData) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const pool = getPgPool();
  if (pool) {
    try {
      console.log('[Supabase] Conectando ao PostgreSQL via Transaction Pooler...');
      let res;
      try {
        res = await pool.query(
          'SELECT data, COALESCE(version, 1) as version FROM system_store WHERE key = $1',
          ['main_database']
        );
      } catch (queryErr) {
        if (queryErr.message && queryErr.message.includes('version')) {
          res = await pool.query('SELECT data FROM system_store WHERE key = $1', ['main_database']);
          if (res.rows && res.rows.length > 0) {
            res.rows[0].version = 1;
          }
        } else {
          throw queryErr;
        }
      }

      if (res.rows && res.rows.length > 0 && res.rows[0].data) {
        console.log('[Supabase] Dados existentes carregados com sucesso do PostgreSQL.');
        return {
          data: res.rows[0].data,
          version: Number(res.rows[0].version || 1)
        };
      }

      // Se a tabela estiver vazia e fallbackData for fornecido, grava registro inicial
      if (fallbackData) {
        console.log('[Supabase] Registro "main_database" não encontrado. Inicializando...');
        try {
          await pool.query(
            'INSERT INTO system_store (key, data, version, updated_at) VALUES ($1, $2, 1, now()) ON CONFLICT (key) DO UPDATE SET data = $2, version = 1, updated_at = now()',
            ['main_database', JSON.stringify(fallbackData)]
          );
        } catch (insertErr) {
          if (insertErr.message && insertErr.message.includes('version')) {
            await pool.query(
              'INSERT INTO system_store (key, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = now()',
              ['main_database', JSON.stringify(fallbackData)]
            );
          } else {
            throw insertErr;
          }
        }
        return { data: fallbackData, version: 1 };
      }
    } catch (err) {
      console.error('[Supabase] Falha ao consultar PostgreSQL Pool:', err.message);
      // Se a tabela não existir, cria e popula
      if (err.message && err.message.includes('does not exist')) {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS system_store (
              key text PRIMARY KEY,
              data jsonb NOT NULL,
              version bigint NOT NULL DEFAULT 1,
              updated_at timestamptz DEFAULT now()
            );
          `);
          if (fallbackData) {
            await pool.query(
              'INSERT INTO system_store (key, data, version, updated_at) VALUES ($1, $2, 1, now()) ON CONFLICT (key) DO UPDATE SET data = $2, version = 1, updated_at = now()',
              ['main_database', JSON.stringify(fallbackData)]
            );
            return { data: fallbackData, version: 1 };
          }
        } catch (createErr) {
          console.error('[Supabase] Falha ao auto-criar tabela:', createErr.message);
        }
      }
      throw err;
    }
  }

  // Fallback REST exclusivo com SUPABASE_SERVICE_ROLE_KEY
  const client = getSupabaseClient();
  if (client) {
    try {
      console.log('[Supabase] Tentando carregar dados via API REST Supabase (Service Role)...');
      const { data, error } = await client
        .from('system_store')
        .select('data, version')
        .eq('key', 'main_database')
        .maybeSingle();

      if (!error && data && data.data) {
        console.log('[Supabase] Dados carregados com sucesso via API REST.');
        return {
          data: data.data,
          version: Number(data.version || 1)
        };
      }

      if (fallbackData) {
        console.log('[Supabase] Gravando dados iniciais via API REST...');
        const { error: upsertErr } = await client
          .from('system_store')
          .upsert({
            key: 'main_database',
            data: fallbackData,
            version: 1,
            updated_at: new Date().toISOString()
          });
        if (!upsertErr) {
          console.log('[Supabase] Dados iniciais persistidos via API REST.');
          return { data: fallbackData, version: 1 };
        } else {
          console.error('[Supabase] Erro ao gravar via API REST:', upsertErr.message);
        }
      }
    } catch (err) {
      console.error('[Supabase] Erro ao conectar via API REST:', err.message);
      throw err;
    }
  }

  return null;
}

/**
 * Salva os dados no Supabase / PostgreSQL com controle de concorrência otimista (OCC)
 */
async function saveToSupabase(data, expectedVersion = 1) {
  if (!isSupabaseConfigured() || !data) {
    return false;
  }

  let lastError = null;
  const currentExp = Number(expectedVersion) || 1;
  const targetVersion = currentExp + 1;

  // 1. PostgreSQL Pool
  const pool = getPgPool();
  if (pool) {
    try {
      let res;
      try {
        res = await pool.query(
          'UPDATE system_store SET data = $2, version = $3, updated_at = now() WHERE key = $1 AND (version = $4 OR version IS NULL) RETURNING version',
          ['main_database', JSON.stringify(data), targetVersion, currentExp]
        );
      } catch (updateErr) {
        if (updateErr.message && updateErr.message.includes('version')) {
          res = await pool.query(
            'INSERT INTO system_store (key, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = now() RETURNING 1 as version',
            ['main_database', JSON.stringify(data)]
          );
          return { success: true, version: targetVersion };
        }
        throw updateErr;
      }

      if (res.rowCount === 0) {
        // Verifica se o registro sequer existe
        const check = await pool.query('SELECT version FROM system_store WHERE key = $1', ['main_database']);
        if (check.rows.length === 0) {
          await pool.query(
            'INSERT INTO system_store (key, data, version, updated_at) VALUES ($1, $2, 1, now())',
            ['main_database', JSON.stringify(data)]
          );
          return { success: true, version: 1 };
        }

        // Se a linha existe com versão diferente: CONFLITO DE CONCORRÊNCIA!
        const actualVersion = check.rows[0].version;
        const conflictErr = new Error(
          `CONFLITO_CONCORRENCIA: Os dados foram alterados por outra requisição simultânea (versão esperada: ${currentExp}, versão atual no banco: ${actualVersion}).`
        );
        conflictErr.code = 'OCC_CONFLICT';
        conflictErr.currentDbVersion = Number(actualVersion);
        throw conflictErr;
      }

      return { success: true, version: targetVersion };
    } catch (err) {
      lastError = err;
      if (err.code === 'OCC_CONFLICT') {
        throw err; // NUNCA tenta fallback cego em caso de conflito de concorrência
      }
      console.error('[Supabase] Falha ao salvar no PostgreSQL:', err.message);
    }
  }

  // 2. Fallback REST exclusivo com SUPABASE_SERVICE_ROLE_KEY
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: upsertData, error } = await client
        .from('system_store')
        .upsert({
          key: 'main_database',
          data,
          version: targetVersion,
          updated_at: new Date().toISOString()
        })
        .select('version')
        .single();

      if (!error) {
        console.log('[Supabase] Gravação concluída com sucesso via API REST (fallback).');
        return {
          success: true,
          version: upsertData && upsertData.version ? Number(upsertData.version) : targetVersion
        };
      }
      lastError = new Error(error.message);
      console.error('[Supabase] Falha ao salvar via REST:', error.message);
    } catch (err) {
      lastError = err;
      console.error('[Supabase] Erro na requisição REST de salvamento:', err.message);
    }
  }

  throw new Error(`Falha na persistência no banco Supabase: ${lastError ? lastError.message : 'Sem conexão configurada'}`);
}

module.exports = {
  isSupabaseConfigured,
  initSupabase,
  saveToSupabase,
  getCloudVersion,
  getPgPool,
  getSupabaseClient,
  getSupabaseUrl,
  getSupabaseKey
};
