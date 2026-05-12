-- Migration: 20260512008000_harden_marketplace_secrets_rls.sql
-- Description: Revoga acessos do usuário autenticado para a tabela de segredos. Apenas backend pode escrever e ler.

ALTER TABLE public.user_marketplace_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users cannot select their own marketplace secrets directly" ON public.user_marketplace_secrets;
DROP POLICY IF EXISTS "Users can insert own marketplace secrets" ON public.user_marketplace_secrets;
DROP POLICY IF EXISTS "Users can update own marketplace secrets" ON public.user_marketplace_secrets;

-- Revoga permissões que poderiam permitir acesso direto da API frontend anon ou authenticated
REVOKE ALL ON public.user_marketplace_secrets FROM anon;
REVOKE ALL ON public.user_marketplace_secrets FROM authenticated;

-- Garante que o service_role (backend admin) tenha controle total
GRANT ALL ON public.user_marketplace_secrets TO service_role;
