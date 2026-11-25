-- =================================================================
-- Schema Oficial Supabase & PostgreSQL - Power Tech / InfoTech
-- =================================================================

-- 1. Tabela Principal de Armazenamento e Estado do Sistema (JSONB)
CREATE TABLE IF NOT EXISTS public.system_store (
  key text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilita Row Level Security (RLS)
ALTER TABLE public.system_store ENABLE ROW LEVEL SECURITY;

-- 3. Política de Acesso para o Backend / API
-- Permite leitura e escrita completa do sistema
CREATE POLICY "Permitir acesso completo para aplicacao"
ON public.system_store
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Índices para Alto Desempenho em Nuvem
CREATE INDEX IF NOT EXISTS idx_system_store_updated_at ON public.system_store (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_store_gin ON public.system_store USING gin (data);

-- 5. Comentários para Documentação
COMMENT ON TABLE public.system_store IS 'Armazenamento central das coleções do sistema Power Tech (Ordens de Serviço, Clientes, Produtos, Configurações, Usuários)';
