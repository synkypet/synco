-- supabase/migrations/20260515101000_allow_captured_coupon_automation_source.sql

-- 1. Atualizar restrição de tipo de fonte para incluir cupons capturados
ALTER TABLE public.automation_sources DROP CONSTRAINT IF EXISTS automation_sources_source_type_check;

ALTER TABLE public.automation_sources 
    ADD CONSTRAINT automation_sources_source_type_check 
    CHECK (source_type IN (
        'group_monitor', 
        'radar_offers', 
        'coupon_shopee', 
        'captured_coupons_shopee'
    ));

-- 2. Garantir que as origens de campanhas e jobs também aceitem 'automation_coupon'
-- Preservando todos os valores existentes: 'radar', 'manual', 'monitor', 'coupon'
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_origin_check;
ALTER TABLE public.campaigns 
    ADD CONSTRAINT campaigns_origin_check 
    CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon', 'automation_coupon'));

ALTER TABLE public.send_jobs DROP CONSTRAINT IF EXISTS send_jobs_origin_check;
ALTER TABLE public.send_jobs 
    ADD CONSTRAINT send_jobs_origin_check 
    CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon', 'automation_coupon'));
