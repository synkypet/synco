-- SYNCO Consolidated Migration
-- 1. Create the automation_coupon_dispatches table (Migration 20260515100000)
-- 2. Add recurrence support with cycle_key (Migration 20260515110100)
-- 3. Add support for promo_page_id (Migration 20260517040000)

-- ============================================================================
-- STEP 1: CREATE TABLE AND BASE CONFIGURATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS public.automation_coupon_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coupon_id UUID REFERENCES public.discovered_coupons(id) ON DELETE CASCADE, -- Made optional for promo pages
    route_id UUID NOT NULL REFERENCES public.automation_routes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    send_job_id UUID, -- Referência informativa ao job (opcional)
    
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
    sent_at TIMESTAMPTZ,
    
    dedupe_key TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_automation_coupon_dedupe_key_not_empty'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches
        ADD CONSTRAINT check_automation_coupon_dedupe_key_not_empty
        CHECK (length(trim(dedupe_key)) > 0);
    END IF;
END $$;

COMMENT ON TABLE public.automation_coupon_dispatches IS 'Histórico de envios de cupons capturados via automação para fins de deduplicação';
COMMENT ON COLUMN public.automation_coupon_dispatches.dedupe_key IS 'Chave determinística para consulta rápida: user:coupon:route:target';

CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_user ON public.automation_coupon_dispatches(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_coupon ON public.automation_coupon_dispatches(coupon_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_route ON public.automation_coupon_dispatches(route_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_dedupe ON public.automation_coupon_dispatches(dedupe_key);

DROP TRIGGER IF EXISTS update_automation_coupon_dispatches_updated_at ON public.automation_coupon_dispatches;
CREATE TRIGGER update_automation_coupon_dispatches_updated_at
    BEFORE UPDATE ON public.automation_coupon_dispatches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.automation_coupon_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own automation coupon dispatches" ON public.automation_coupon_dispatches;
CREATE POLICY "Users can view own automation coupon dispatches"
    ON public.automation_coupon_dispatches
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT ON public.automation_coupon_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_coupon_dispatches TO service_role;
REVOKE ALL ON public.automation_coupon_dispatches FROM anon;

-- ============================================================================
-- STEP 2: ADD CYCLE KEY FOR RECURRENCE SUPPORT
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_cycle_search 
ON public.automation_coupon_dispatches(user_id, coupon_id, target_id, cycle_key);

COMMENT ON COLUMN public.automation_coupon_dispatches.cycle_key IS 'Chave que define o ciclo de disparo (ex: coupon_id + target_id + timestamp truncado) para permitir recorrência segura';

-- ============================================================================
-- STEP 3: ADD PROMO LANDING PAGE SUPPORT
-- ============================================================================

DO $$
BEGIN
    -- 1. Tornar coupon_id opcional (already handled in Step 1 for new table, but let's be sure for safety)
    ALTER TABLE public.automation_coupon_dispatches ALTER COLUMN coupon_id DROP NOT NULL;

    -- 2. Adicionar coluna promo_page_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'automation_coupon_dispatches' 
        AND column_name = 'promo_page_id'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches 
        ADD COLUMN promo_page_id UUID REFERENCES public.discovered_promo_pages(id) ON DELETE CASCADE;
    END IF;

    -- 3. Adicionar restrição check_dispatch_item_type se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.automation_coupon_dispatches'::regclass
        AND conname = 'check_dispatch_item_type'
    ) THEN
        ALTER TABLE public.automation_coupon_dispatches 
        ADD CONSTRAINT check_dispatch_item_type 
        CHECK (
            (coupon_id IS NOT NULL AND promo_page_id IS NULL) OR
            (promo_page_id IS NOT NULL AND coupon_id IS NULL)
        );
    END IF;

    -- 4. Adicionar índice de performance para busca de cycle_key com promo_page_id
    CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_promo_cycle 
    ON public.automation_coupon_dispatches(user_id, promo_page_id, target_id, cycle_key);
END $$;
