-- Migration: 20240428000000_mp_billing_events.sql
-- Description: Adiciona colunas para Mercado Pago em subscriptions e cria tabela de eventos de billing.

-- 1. Cria a tabela de eventos isolada
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT billing_events_provider_event_unique UNIQUE (provider, event_id)
);

-- Ativa proteção na tabela billing_events (apenas service_role altera/lê, clients não devem ver)
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Service Role Only on billing events" ON public.billing_events
        FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Atualiza a tabela subscriptions com as flags novas
DO $$ BEGIN
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_status TEXT;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL; END $$;

-- 3. Atualiza os Planos no Banco de Dados para refletir os valores base definidos 
-- (59.00 / 197.00 - mantido em external_price_id apenas como referência se preferir, 
--  mas para ser self-contained sem ID do MP vamos guardar o preco no plano e carregar na runtime)
DO $$ BEGIN
  ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2);
EXCEPTION WHEN others THEN NULL; END $$;

-- Atualizar planos existentes se encontrados
UPDATE public.plans SET price_monthly = 59.00 WHERE name = 'Starter';
UPDATE public.plans SET price_monthly = 197.00 WHERE name = 'Pro';

-- Se um seed fosse rodar agora:
INSERT INTO public.plans (name, billing_cycle, price_monthly, limits)
VALUES 
('Starter', 'monthly', 59.00, '{
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
('Pro', 'monthly', 197.00, '{
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
ON CONFLICT (id) DO NOTHING; -- Planos normalmente não têm chave única fixa em nome, mas isso é seguro se a database estiver limpa, ou podemos confiar no update acima.
