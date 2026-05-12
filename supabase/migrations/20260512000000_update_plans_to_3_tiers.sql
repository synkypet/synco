-- Migration: 20260512000000_update_plans_to_3_tiers.sql
-- Description: Atualiza a estrutura de planos para o modelo SYNCO (Start, Pro, Scale)
--              usando abordagem segura (UPDATE + INSERT WHERE NOT EXISTS).
--              Adiciona a coluna metadata para suporte a checkout externo (Kiwify).

-- 1. Adicionar coluna metadata se não existir
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{"kiwify_checkout_url": ""}'::jsonb;

-- 2. Atualizar SYNCO Start se existir um plano Starter/SYNCO Start
UPDATE public.plans
SET 
  name = 'SYNCO Start',
  slug = 'synco-start',
  price_monthly = 97.00,
  limits = '{
        "quotas": {
            "max_channels": 1,
            "max_groups_sync": 10,
            "max_sends_per_month": 10000,
            "max_radars": 0
        },
        "features": {
            "radar_access": false,
            "api_access": false,
            "advanced_reports": false
        }
    }'::jsonb,
  billing_cycle = 'monthly',
  metadata = '{"kiwify_checkout_url": ""}'::jsonb,
  is_active = true,
  updated_at = now()
WHERE slug IN ('starter', 'synco-start') OR name IN ('Starter', 'SYNCO Start');

-- 3. Atualizar SYNCO Pro se existir um plano Pro/SYNCO Pro
UPDATE public.plans
SET 
  name = 'SYNCO Pro',
  slug = 'synco-pro',
  price_monthly = 197.00,
  limits = '{
        "quotas": {
            "max_channels": 3,
            "max_groups_sync": 30,
            "max_sends_per_month": 50000,
            "max_radars": 2
        },
        "features": {
            "radar_access": true,
            "api_access": false,
            "advanced_reports": false
        }
    }'::jsonb,
  billing_cycle = 'monthly',
  metadata = '{"kiwify_checkout_url": ""}'::jsonb,
  is_active = true,
  updated_at = now()
WHERE slug IN ('pro', 'synco-pro') OR name IN ('Pro', 'SYNCO Pro');

-- 4. Inserir SYNCO Start se não existir
INSERT INTO public.plans (id, name, slug, price_monthly, billing_cycle, limits, metadata, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'SYNCO Start', 
    'synco-start', 
    97.00, 
    'monthly', 
    '{
        "quotas": {
            "max_channels": 1,
            "max_groups_sync": 10,
            "max_sends_per_month": 10000,
            "max_radars": 0
        },
        "features": {
            "radar_access": false,
            "api_access": false,
            "advanced_reports": false
        }
    }'::jsonb,
    '{"kiwify_checkout_url": ""}'::jsonb,
    true,
    now(),
    now()
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'synco-start');

-- 5. Inserir SYNCO Pro se não existir
INSERT INTO public.plans (id, name, slug, price_monthly, billing_cycle, limits, metadata, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'SYNCO Pro', 
    'synco-pro', 
    197.00, 
    'monthly', 
    '{
        "quotas": {
            "max_channels": 3,
            "max_groups_sync": 30,
            "max_sends_per_month": 50000,
            "max_radars": 2
        },
        "features": {
            "radar_access": true,
            "api_access": false,
            "advanced_reports": false
        }
    }'::jsonb,
    '{"kiwify_checkout_url": ""}'::jsonb,
    true,
    now(),
    now()
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'synco-pro');

-- 6. Inserir SYNCO Scale se não existir
INSERT INTO public.plans (id, name, slug, price_monthly, billing_cycle, limits, metadata, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'SYNCO Scale', 
    'synco-scale', 
    347.00, 
    'monthly', 
    '{
        "quotas": {
            "max_channels": 5,
            "max_groups_sync": 100,
            "max_sends_per_month": 200000,
            "max_radars": 5
        },
        "features": {
            "radar_access": true,
            "api_access": false,
            "advanced_reports": false
        }
    }'::jsonb,
    '{"kiwify_checkout_url": ""}'::jsonb,
    true,
    now(),
    now()
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'synco-scale');

-- 7. Marcar planos antigos como inativos
UPDATE public.plans 
SET is_active = false 
WHERE slug NOT IN ('synco-start', 'synco-pro', 'synco-scale');

-- 8. Garantir permissões
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
