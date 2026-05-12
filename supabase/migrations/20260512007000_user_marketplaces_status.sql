-- Migration: 20260512007000_user_marketplaces_status.sql
-- Description: Adiciona colunas de status de conexão, secrets info e tabela de segredos isolada

-- 1. Tabela de Segredos Isolada (Acesso exclusivo server-side)
CREATE TABLE IF NOT EXISTS public.user_marketplace_secrets (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, marketplace_id)
);

ALTER TABLE public.user_marketplace_secrets ENABLE ROW LEVEL SECURITY;

-- Revoga qualquer acesso direto (anon/authenticated) e garante apenas service_role
REVOKE ALL ON public.user_marketplace_secrets FROM anon;
REVOKE ALL ON public.user_marketplace_secrets FROM authenticated;
GRANT ALL ON public.user_marketplace_secrets TO service_role;

-- 2. Colunas Adicionais na tabela user_marketplaces
ALTER TABLE public.user_marketplaces
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS shopee_app_id TEXT,
ADD COLUMN IF NOT EXISTS has_secret BOOLEAN DEFAULT FALSE;

-- Garantir acesso da tabela de secrets à service_role (Admin client)
-- GRANT ALL ON public.user_marketplace_secrets TO service_role; (Já feito acima)
