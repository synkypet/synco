-- Migration: 20260428190000_add_radar_operational_columns.sql
-- Description: Adiciona colunas operacionais de controle de ciclo do Radar na tabela
--              automation_sources, e cria a RPC claim_source_lock para locking atômico.
--
-- ATENÇÃO: Esta migration foi reconstruída por inferência do código-fonte.
-- As colunas e a RPC existiam no banco sem migration de criação.
--
-- Deve ser aplicada ANTES de:
-- 20260428195900_create_radar_discovered_products.sql
-- 20260428210000_radar_activity_layer.sql
-- 20260506220000_add_exhaustion_to_automation_sources.sql (refere needs_restock)
-- Timestamp escolhido: 20260428190000

-- ─── 1. Colunas Operacionais de automation_sources ───────────────────────────
-- Campos usados em produção pelo radar-discovery-service.ts:
-- s.needs_restock, s.last_restock_at, s.discovery_page,
-- s.discovery_locked_until, s.restock_requested_at

ALTER TABLE public.automation_sources
    ADD COLUMN IF NOT EXISTS needs_restock            BOOLEAN         NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_restock_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS restock_requested_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS discovery_page           INTEGER         NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS discovery_locked_until   TIMESTAMPTZ;

-- ─── 2. RPC claim_source_lock ────────────────────────────────────────────────
-- Usada em radar-discovery-service.ts:
--   supabase.rpc('claim_source_lock', { p_source_id, p_worker_id, p_timeout_mins })
-- Padrão baseado na claim_maintenance_lock já existente no projeto.

CREATE OR REPLACE FUNCTION public.claim_source_lock(
    p_source_id   UUID,
    p_worker_id   TEXT,
    p_timeout_mins INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
    v_now          TIMESTAMPTZ := NOW();
    v_locked_until TIMESTAMPTZ := v_now + (p_timeout_mins || ' minutes')::INTERVAL;
BEGIN
    -- Atualiza atomicamente: só consegue o lock se discovery_locked_until está NULL ou expirado
    UPDATE public.automation_sources
    SET discovery_locked_until = v_locked_until
    WHERE id = p_source_id
      AND (discovery_locked_until IS NULL OR discovery_locked_until < v_now);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
