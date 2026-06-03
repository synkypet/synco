-- ==============================================================================
-- Migration: Criação das tabelas base do módulo SyncoMetrics
-- Descrição: Tabelas isoladas (prefixo sm_) para monitoramento de grupos,
--            snapshots, deltas e descobertas. Inclui validações de RLS,
--            limite inegociável de 3 grupos, e segurança de dados do worker.
-- ==============================================================================

BEGIN;

-- ─── 1. Funções Auxiliares Isoladas do SyncoMetrics ───────────────────────────
CREATE OR REPLACE FUNCTION public.sm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 2. Tabela Principal de Monitoramento (Opt-in do usuário) ─────────────────
CREATE TABLE IF NOT EXISTS public.sm_monitored_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    monitor_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (monitor_interval_minutes >= 5),
    last_snapshot_at TIMESTAMPTZ,
    last_poll_attempt_at TIMESTAMPTZ,
    last_poll_status TEXT,
    last_error_message TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_errors >= 0),
    next_poll_at TIMESTAMPTZ,
    paused_reason TEXT CHECK (paused_reason IN ('user_disabled', 'plan_inactive', 'too_many_errors', 'channel_disconnected', 'group_not_found', 'rate_limited') OR paused_reason IS NULL),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permite o usuário reativar ou criar novos monitoramentos desde que o grupo
-- não tenha outro registro ativo (não deletado).
CREATE UNIQUE INDEX IF NOT EXISTS sm_monitored_groups_unique_active
ON public.sm_monitored_groups(user_id, group_id)
WHERE is_deleted = false;

CREATE TRIGGER set_updated_at_sm_monitored
BEFORE UPDATE ON public.sm_monitored_groups
FOR EACH ROW EXECUTE FUNCTION public.sm_set_updated_at();


-- ─── 3. Tabela de Snapshots (Série Temporal) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sm_group_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    member_count INTEGER NOT NULL CHECK (member_count >= 0),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_minute TIMESTAMPTZ NOT NULL, -- O worker envia startOfMinute() em UTC
    source TEXT DEFAULT 'wasender_polling',
    poll_duration_ms INTEGER,
    worker_version TEXT,
    raw_payload JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id, captured_minute)
);


-- ─── 4. Tabela de Deltas (Variação de Crescimento) ────────────────────────────
-- NOTA: O primeiro snapshot nunca gera delta. Deltas só nascem quando existe
-- previous_snapshot_id válido.
CREATE TABLE IF NOT EXISTS public.sm_group_deltas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    previous_snapshot_id UUID NOT NULL REFERENCES public.sm_group_snapshots(id) ON DELETE CASCADE,
    current_snapshot_id UUID NOT NULL REFERENCES public.sm_group_snapshots(id) ON DELETE CASCADE,
    previous_count INTEGER NOT NULL,
    current_count INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    estimated_joined INTEGER NOT NULL CHECK (estimated_joined >= 0),
    estimated_left INTEGER NOT NULL CHECK (estimated_left >= 0),
    captured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (delta = current_count - previous_count)
);


-- ─── 5. Tabela de Grupos Descobertos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sm_discovered_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    external_group_id TEXT NOT NULL,
    group_name TEXT,
    member_count INTEGER CHECK (member_count >= 0),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    matched_core_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'dismissed', 'ignored')),
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    raw_payload JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, external_group_id)
);


-- ─── 6. Índices de Performance ────────────────────────────────────────────────
-- Índices para sm_monitored_groups
CREATE INDEX IF NOT EXISTS idx_sm_monitored_user_id ON public.sm_monitored_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_sm_monitored_user_enabled ON public.sm_monitored_groups(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_sm_monitored_active ON public.sm_monitored_groups(enabled, next_poll_at) WHERE is_deleted = false;

-- Índices para sm_group_snapshots
CREATE INDEX IF NOT EXISTS idx_sm_snapshots_user_group_time ON public.sm_group_snapshots(user_id, group_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_snapshots_group_time ON public.sm_group_snapshots(group_id, captured_at DESC);

-- Índices para sm_group_deltas
CREATE INDEX IF NOT EXISTS idx_sm_deltas_user_group_time ON public.sm_group_deltas(user_id, group_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_deltas_group_time ON public.sm_group_deltas(group_id, captured_at DESC);

-- Índices para sm_discovered_groups
CREATE INDEX IF NOT EXISTS idx_sm_discovered_user_status ON public.sm_discovered_groups(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sm_discovered_user_channel_ext ON public.sm_discovered_groups(user_id, channel_id, external_group_id);


-- ─── 7. Triggers de Segurança (Camada de Banco) ───────────────────────────────

-- 7.1 Validação de Ownership Estrita com JOIN (Garante integridade referencial profunda)
CREATE OR REPLACE FUNCTION check_sm_monitored_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.channels c ON c.id = g.channel_id
    WHERE g.id = NEW.group_id
      AND g.channel_id = NEW.channel_id
      AND g.user_id = NEW.user_id
      AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Grupo ou Canal fornecido é inválido ou não pertence ao usuário.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sm_ownership_trigger
BEFORE INSERT OR UPDATE ON public.sm_monitored_groups
FOR EACH ROW EXECUTE FUNCTION check_sm_monitored_ownership();


-- 7.2 Limite de 3 grupos monitorados por user_id (Conta apenas ativos)
CREATE OR REPLACE FUNCTION check_sm_monitored_groups_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  IF (NEW.enabled = true AND NEW.is_deleted = false) THEN
    SELECT COUNT(*) INTO active_count
    FROM public.sm_monitored_groups
    WHERE user_id = NEW.user_id AND enabled = true AND is_deleted = false AND id != NEW.id;
    
    IF active_count >= 3 THEN
      RAISE EXCEPTION 'Limite máximo de 3 grupos monitorados atingido para este usuário.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sm_limit_trigger
BEFORE INSERT OR UPDATE ON public.sm_monitored_groups
FOR EACH ROW EXECUTE FUNCTION check_sm_monitored_groups_limit();


-- 7.3 Prevenir que queries UPDATE da UI/API mexam em campos do Worker usando auth.role()
CREATE OR REPLACE FUNCTION restrict_sm_operational_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.last_snapshot_at IS DISTINCT FROM OLD.last_snapshot_at OR
      NEW.last_poll_attempt_at IS DISTINCT FROM OLD.last_poll_attempt_at OR
      NEW.last_poll_status IS DISTINCT FROM OLD.last_poll_status OR
      NEW.last_error_message IS DISTINCT FROM OLD.last_error_message OR
      NEW.consecutive_errors IS DISTINCT FROM OLD.consecutive_errors OR
      NEW.next_poll_at IS DISTINCT FROM OLD.next_poll_at OR
      NEW.paused_reason IS DISTINCT FROM OLD.paused_reason) THEN
    
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: Campos operacionais são restritos ao processamento em background (Worker).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_sm_operational_fields
BEFORE UPDATE ON public.sm_monitored_groups
FOR EACH ROW EXECUTE FUNCTION restrict_sm_operational_updates();


-- ─── 8. Row Level Security (RLS) ──────────────────────────────────────────────
ALTER TABLE public.sm_monitored_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_group_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_group_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_discovered_groups ENABLE ROW LEVEL SECURITY;

-- sm_monitored_groups: Acesso Total (CRUD), mas UPDATE sofre restrição do Trigger acima
CREATE POLICY "Users can view own monitored groups" ON public.sm_monitored_groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monitored groups" ON public.sm_monitored_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monitored groups" ON public.sm_monitored_groups FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monitored groups" ON public.sm_monitored_groups FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sm_group_snapshots: Somente leitura (Escrita via Service Role do Worker)
CREATE POLICY "Users can view own snapshots" ON public.sm_group_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- sm_group_deltas: Somente leitura
CREATE POLICY "Users can view own deltas" ON public.sm_group_deltas FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- sm_discovered_groups: Leitura livre. Edição apenas para dispensar/ignorar
CREATE POLICY "Users can view own discovered groups" ON public.sm_discovered_groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own discovered groups" ON public.sm_discovered_groups FOR UPDATE TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status IN ('dismissed', 'ignored'));

COMMIT;
