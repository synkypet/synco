-- Migration: 20240428120000_fix_plans_schema.sql
-- Description: Add missing columns to plans table and update data.

-- 1. Add columns if they don't exist
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Update existing plans with slugs and prices
UPDATE public.plans SET slug = 'starter', price_monthly = 59.00 WHERE name = 'Starter';
UPDATE public.plans SET slug = 'pro', price_monthly = 197.00 WHERE name = 'Pro';

-- 3. Ensure Starter and Pro exist (if they were deleted for some reason)
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
}'),
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
}')
ON CONFLICT (slug) DO UPDATE SET 
    price_monthly = EXCLUDED.price_monthly,
    limits = EXCLUDED.limits;
