-- migration: 20260517040000_alter_dispatches_for_promo_landing.sql
-- Objetivo: Permitir o histórico de disparos e deduplicação de páginas promocionais.

DO $$
BEGIN
    -- 1. Tornar coupon_id opcional
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
