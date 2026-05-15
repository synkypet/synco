-- migration: 20260515101000_allow_captured_coupon_automation_source.sql
-- Objetivo: Permitir o novo tipo de fonte 'captured_coupons_shopee' na tabela automation_sources.

DO $$ 
BEGIN
    -- 1. Atualizar a constraint de source_type em automation_sources
    ALTER TABLE public.automation_sources DROP CONSTRAINT IF EXISTS automation_sources_source_type_check;
    
    ALTER TABLE public.automation_sources ADD CONSTRAINT automation_sources_source_type_check 
    CHECK (source_type IN (
        'group_monitor', 
        'radar_offers', 
        'coupon_shopee', 
        'captured_coupons_shopee'
    ));

    -- 2. Garantir que as origens de campanhas e jobs também aceitem 'automation_coupon' 
    -- (Já deve estar OK da fase anterior, mas reforçamos a integridade aqui)
    ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_origin_check;
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_origin_check 
    CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon', 'automation_coupon'));

    ALTER TABLE public.send_jobs DROP CONSTRAINT IF EXISTS send_jobs_origin_check;
    ALTER TABLE public.send_jobs ADD CONSTRAINT send_jobs_origin_check
    CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon', 'automation_coupon'));
END $$;
