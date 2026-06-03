-- ==============================================================================
-- Migration: Criação da tabela sm_metric_monitors
-- Descrição: Tabela para vinculação direta entre Campanhas Meta e Grupos (UUID)
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sm_metric_monitors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    group_id uuid not null references public.groups(id) on delete cascade,
    campaign_id text not null,
    campaign_name text not null,
    ad_account_id text not null,
    monitor_name text,
    status text default 'active' check (status in ('active', 'paused', 'deleted')),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    UNIQUE(user_id, group_id, campaign_id)
);

-- ─── 1. Trigger de updated_at ─────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_sm_monitors
BEFORE UPDATE ON public.sm_metric_monitors
FOR EACH ROW EXECUTE FUNCTION public.sm_set_updated_at();

-- ─── 2. Trigger de Validação / Ownership ──────────────────────────────────────
-- Garante que o monitor só pode ser criado para grupos já ativados no SyncoMetrics
CREATE OR REPLACE FUNCTION check_sm_monitor_group_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM public.sm_monitored_groups smg
    WHERE smg.user_id = NEW.user_id 
      AND smg.group_id = NEW.group_id
      AND smg.enabled = true
      AND smg.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Grupo inválido ou não está monitorado.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sm_monitor_ownership
BEFORE INSERT OR UPDATE ON public.sm_metric_monitors
FOR EACH ROW EXECUTE FUNCTION check_sm_monitor_group_ownership();

-- ─── 3. Row Level Security (RLS) ──────────────────────────────────────────────
ALTER TABLE public.sm_metric_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metric monitors" ON public.sm_metric_monitors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metric monitors" ON public.sm_metric_monitors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own metric monitors" ON public.sm_metric_monitors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metric monitors" ON public.sm_metric_monitors FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Opcionalmente adicionar GRANT se explícito, porém políticas RLS e default public access control já resolvem isso no Supabase
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sm_metric_monitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sm_metric_monitors TO service_role;

COMMIT;
