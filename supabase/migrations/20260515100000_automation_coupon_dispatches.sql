-- migration: 20260515100000_automation_coupon_dispatches.sql
-- Objetivo: Histórico e Deduplicação de disparos de cupons capturados via automação.

-- 1. Garantir função de updated_at (Idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Criação da Tabela
CREATE TABLE IF NOT EXISTS public.automation_coupon_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES public.discovered_coupons(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.automation_routes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    send_job_id UUID, -- Referência informativa ao job (opcional)
    
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
    sent_at TIMESTAMPTZ,
    
    dedupe_key TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Restrição de Unicidade: Um cupom não deve ser reenviado para a mesma rota/destino do mesmo usuário
    CONSTRAINT uq_automation_coupon_user_target UNIQUE(user_id, coupon_id, route_id, target_id)
);

-- 3. CHECK para dedupe_key não vazio (Idempotente)
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

-- Comentários
COMMENT ON TABLE public.automation_coupon_dispatches IS 'Histórico de envios de cupons capturados via automação para fins de deduplicação';
COMMENT ON COLUMN public.automation_coupon_dispatches.dedupe_key IS 'Chave determinística para consulta rápida: user:coupon:route:target';

-- Índices
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_user ON public.automation_coupon_dispatches(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_coupon ON public.automation_coupon_dispatches(coupon_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_route ON public.automation_coupon_dispatches(route_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_dispatch_dedupe ON public.automation_coupon_dispatches(dedupe_key);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_automation_coupon_dispatches_updated_at ON public.automation_coupon_dispatches;
CREATE TRIGGER update_automation_coupon_dispatches_updated_at
    BEFORE UPDATE ON public.automation_coupon_dispatches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Segurança (RLS)
ALTER TABLE public.automation_coupon_dispatches ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (Dono dos dados)
DROP POLICY IF EXISTS "Users can view own automation coupon dispatches" ON public.automation_coupon_dispatches;
CREATE POLICY "Users can view own automation coupon dispatches"
    ON public.automation_coupon_dispatches
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Escrita restrita ao service_role via GRANT (sem policies de escrita para authenticated)

-- 4. GRANTs
GRANT SELECT ON public.automation_coupon_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_coupon_dispatches TO service_role;
REVOKE ALL ON public.automation_coupon_dispatches FROM anon;
