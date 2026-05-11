-- Migration: 20240428120000_fix_plans_schema.sql
-- Description: Add missing columns to plans table and update data.

-- 1. Deduplicar planos existentes antes de aplicar slug UNIQUE
DELETE FROM public.plans p
USING public.plans p2
WHERE p.name = p2.name
  AND p.id > p2.id
  AND p.name IN ('Starter', 'Pro');

-- 2. Add columns if they don't exist
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Update existing plans with slugs and prices
UPDATE public.plans
SET slug = CASE
      WHEN name = 'Starter' THEN 'starter'
      WHEN name = 'Pro' THEN 'pro'
      ELSE slug
    END,
    price_monthly = CASE
      WHEN name = 'Starter' THEN 59.00
      WHEN name = 'Pro' THEN 197.00
      ELSE price_monthly
    END
WHERE name IN ('Starter', 'Pro');

-- 4. Deduplicar por slug antes de criar UNIQUE
DELETE FROM public.plans p
USING public.plans p2
WHERE p.slug = p2.slug
  AND p.id > p2.id
  AND p.slug IS NOT NULL;

-- 5. Criar UNIQUE normal para permitir ON CONFLICT (slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plans_slug_key'
  ) THEN
    ALTER TABLE public.plans
    ADD CONSTRAINT plans_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 6. Ensure Starter and Pro exist idempotently
INSERT INTO public.plans (name, slug, price_monthly, billing_cycle, limits)
VALUES 
('Starter', 'starter', 59.00, 'monthly', '{
    "quotas": {
        "max_channels": 1,
        "max_groups_sync": 50,
        "max_sends_per_month": 10000
    },
    "features": {
        "radar_access": false,
        "api_access": false,
        "advanced_reports": false
    }
}'::jsonb),
('Pro', 'pro', 197.00, 'monthly', '{
    "quotas": {
        "max_channels": 3,
        "max_groups_sync": 200,
        "max_sends_per_month": 100000
    },
    "features": {
        "radar_access": true,
        "api_access": false,
        "advanced_reports": true
    }
}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    billing_cycle = EXCLUDED.billing_cycle,
    limits = EXCLUDED.limits;
