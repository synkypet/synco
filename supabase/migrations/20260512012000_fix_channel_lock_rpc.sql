-- Migration: 20260512012000_fix_channel_lock_rpc.sql
-- Objetivo: Criar sistema de lock atômico por canal para o Worker v4

-- 1. Tabela de Locks de Canal
CREATE TABLE IF NOT EXISTS public.channel_locks (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    lock_owner TEXT NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Segurança (RLS)
ALTER TABLE public.channel_locks ENABLE ROW LEVEL SECURITY;

-- Limpar acessos anteriores
REVOKE ALL ON public.channel_locks FROM anon;
REVOKE ALL ON public.channel_locks FROM authenticated;

-- Acesso total apenas para o service_role (Worker/Backend)
GRANT ALL ON public.channel_locks TO service_role;

-- 3. RPC para Reivindicar Lock (Claim)
-- Assinatura exata usada pelo Worker:
-- supabase.rpc('claim_channel_lock', { p_channel_id, p_worker_id, p_lock_timeout })
CREATE OR REPLACE FUNCTION public.claim_channel_lock(
    p_channel_id UUID,
    p_worker_id TEXT,
    p_lock_timeout INTERVAL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Tenta inserir o lock ou atualizar se estiver expirado/mesmo dono
    INSERT INTO public.channel_locks (channel_id, lock_owner, locked_until)
    VALUES (p_channel_id, p_worker_id, v_now + p_lock_timeout)
    ON CONFLICT (channel_id) DO UPDATE
    SET 
        lock_owner = EXCLUDED.lock_owner,
        locked_until = EXCLUDED.locked_until,
        updated_at = v_now
    WHERE 
        channel_locks.locked_until < v_now OR 
        channel_locks.lock_owner = p_worker_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RPC para Liberar Lock (Release)
-- Assinatura exata usada pelo Worker:
-- supabase.rpc('release_channel_lock', { p_channel_id, p_worker_id })
CREATE OR REPLACE FUNCTION public.release_channel_lock(
    p_channel_id UUID,
    p_worker_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.channel_locks
    WHERE channel_id = p_channel_id AND lock_owner = p_worker_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Permissões de Execução
GRANT EXECUTE ON FUNCTION public.claim_channel_lock(UUID, TEXT, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_channel_lock(UUID, TEXT) TO service_role;

-- 6. Reload Schema
NOTIFY pgrst, 'reload schema';
