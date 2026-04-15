-- Migration: Heartbeat Maintenance Locks
-- Tabela para evitar concorrência no pump de fila via cron.

CREATE TABLE IF NOT EXISTS public.maintenance_locks (
    key TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC para tentar obter o lock de forma atômica
CREATE OR REPLACE FUNCTION public.claim_maintenance_lock(
    p_lock_key TEXT,
    p_worker_id TEXT,
    p_timeout_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_locked_until TIMESTAMPTZ := v_now + (p_timeout_seconds || ' seconds')::INTERVAL;
BEGIN
    -- 1. Limpar locks expirados (auto-cleanup)
    DELETE FROM public.maintenance_locks WHERE locked_until < v_now;

    -- 2. Tentar inserir o novo lock
    -- Se a chave já existir, o INSERT falhará (Unique Violation)
    BEGIN
        INSERT INTO public.maintenance_locks (key, worker_id, locked_until)
        VALUES (p_lock_key, p_worker_id, v_locked_until);
        RETURN TRUE;
    EXCEPTION WHEN unique_violation THEN
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
