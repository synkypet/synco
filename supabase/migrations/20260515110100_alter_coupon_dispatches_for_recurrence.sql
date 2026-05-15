-- migration: 20260515110100_alter_coupon_dispatches_for_recurrence.sql
-- Objetivo: Permitir recorrência de disparos de cupons usando cycle_key.

DO $$
BEGIN
    -- 1. Adicionar coluna cycle_key se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'automation_coupon_dispatches' 
        AND column_name = 'cycle_key'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches ADD COLUMN cycle_key TEXT;
    END IF;

    -- 2. Preencher registros legados
    UPDATE public.automation_coupon_dispatches 
    SET cycle_key = 'legacy' 
    WHERE cycle_key IS NULL;

    -- 3. Tornar a coluna obrigatória
    ALTER TABLE public.automation_coupon_dispatches ALTER COLUMN cycle_key SET NOT NULL;

    -- 4. Dropar restrição de unicidade antiga se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.automation_coupon_dispatches'::regclass
        AND conname = 'uq_automation_coupon_user_target'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches DROP CONSTRAINT uq_automation_coupon_user_target;
    END IF;

    -- 5. Criar nova restrição de unicidade incluindo cycle_key (Dedupe Global por Ciclo)
    -- Removido route_id para evitar duplicidade entre diferentes automações no mesmo ciclo
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.automation_coupon_dispatches'::regclass
        AND conname = 'uq_automation_coupon_dispatch_cycle'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches 
        ADD CONSTRAINT uq_automation_coupon_dispatch_cycle UNIQUE(user_id, coupon_id, target_id, cycle_key);
    END IF;

    -- 6. Adicionar CHECK para cycle_key não vazio
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.automation_coupon_dispatches'::regclass
        AND conname = 'check_automation_coupon_cycle_key_not_empty'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches
        ADD CONSTRAINT check_automation_coupon_cycle_key_not_empty
        CHECK (length(trim(cycle_key)) > 0);
    END IF;
END $$;

-- 7. Índice de performance para o novo padrão de busca (Dedupe Global por Ciclo)
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_cycle_search 
ON public.automation_coupon_dispatches(user_id, coupon_id, target_id, cycle_key);

-- 8. Comentários
COMMENT ON COLUMN public.automation_coupon_dispatches.cycle_key IS 'Chave que define o ciclo de disparo (ex: coupon_id + target_id + timestamp truncado) para permitir recorrência segura';
