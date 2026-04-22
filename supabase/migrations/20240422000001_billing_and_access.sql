-- Migration: 20240422000001_billing_and_access.sql
-- Description: Create tables for plans, subscriptions and internal licenses.

-- 1. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    external_price_id TEXT,
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    limits JSONB NOT NULL DEFAULT '{
        "quotas": {
            "max_channels": 1,
            "max_groups_sync": 100,
            "max_sends_per_month": 50000
        },
        "features": {
            "radar_access": false,
            "api_access": false,
            "advanced_reports": false
        }
    }',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete')),
    provider TEXT,
    provider_customer_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id) -- Cada usuário tem apenas uma assinatura ativa/principal
);

-- 3. Internal Licenses Table (Bypass Administrativo)
CREATE TABLE IF NOT EXISTS public.internal_licenses (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin',
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_licenses ENABLE ROW LEVEL SECURITY;

-- Plans are readable by all authenticated users
DO $$ BEGIN
    CREATE POLICY "Plans readable by all" ON public.plans
        FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL; END $$;

-- Subscriptions are readable by owner
DO $$ BEGIN
    CREATE POLICY "Users can view own subscription" ON public.subscriptions
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN others THEN NULL; END $$;

-- Internal Licenses are readable by owner
DO $$ BEGIN
    CREATE POLICY "Internal licenses readable by owner" ON public.internal_licenses
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN others THEN NULL; END $$;

-- Triggers for updated_at
DO $$ BEGIN
    CREATE TRIGGER set_updated_at_plans
        BEFORE UPDATE ON public.plans
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_subscriptions
        BEFORE UPDATE ON public.subscriptions
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN others THEN NULL; END $$;

-- Seed inicial de planos
INSERT INTO public.plans (name, billing_cycle, limits)
VALUES 
('Starter', 'monthly', '{
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
('Pro', 'monthly', '{
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
ON CONFLICT DO NOTHING;
