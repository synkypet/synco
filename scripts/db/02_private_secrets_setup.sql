-- ==========================================
-- SCRIPT: Setup Tabela Privada de Secrets (GCM)
-- ==========================================
-- 1. Modifica a tabela base para aceitar o App ID explícito e a flag da UI
ALTER TABLE public.user_marketplaces 
ADD COLUMN IF NOT EXISTS shopee_app_id text,
ADD COLUMN IF NOT EXISTS has_secret boolean DEFAULT false;

-- 2. Cria a Tabela Auxiliar Trancada
CREATE TABLE IF NOT EXISTS public.user_marketplace_secrets (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace_id uuid NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
    encrypted_secret text NOT NULL,
    iv text NOT NULL,
    auth_tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, marketplace_id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.user_marketplace_secrets ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Nenhuma política (POLICY) de leitura/escrita será criada para usuários normais
-- 'authenticated' ou 'anon'. Isso força a tabela a ser invisível para o frontend.
-- A infraestrutura de backend Node.js vai manipular dados aqui utilizando Service Role Key (Admin).
