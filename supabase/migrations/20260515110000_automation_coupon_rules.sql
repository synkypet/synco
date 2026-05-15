-- migration: 20260515110000_automation_coupon_rules.sql
-- Objetivo: Regras de agendamento e seleção para automação de cupons capturados.

-- 1. Criação da Tabela
CREATE TABLE IF NOT EXISTS public.automation_coupon_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.automation_sources(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.automation_routes(id) ON DELETE CASCADE,
    
    coupon_id UUID REFERENCES public.discovered_coupons(id) ON DELETE CASCADE,
    promo_page_id UUID REFERENCES public.discovered_promo_pages(id) ON DELETE CASCADE,
    
    item_type TEXT NOT NULL CHECK (item_type IN ('coupon', 'promo_landing')),
    
    is_selected BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (interval_minutes >= 10),
    
    next_run_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Restrição: Exclusividade de campos baseada no tipo
    CONSTRAINT check_item_type_fields CHECK (
        (item_type = 'coupon' AND coupon_id IS NOT NULL AND promo_page_id IS NULL) OR
        (item_type = 'promo_landing' AND promo_page_id IS NOT NULL AND coupon_id IS NULL)
    ),

    -- Constraints de integridade: Um item só pode aparecer uma vez por rota
    CONSTRAINT uq_automation_rule_coupon UNIQUE (source_id, route_id, coupon_id),
    CONSTRAINT uq_automation_rule_promo UNIQUE (source_id, route_id, promo_page_id)
);

-- 2. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_auto_coupon_rules_user ON public.automation_coupon_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_rules_source ON public.automation_coupon_rules(source_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_rules_route ON public.automation_coupon_rules(route_id);
CREATE INDEX IF NOT EXISTS idx_auto_coupon_rules_next_run ON public.automation_coupon_rules(next_run_at) WHERE is_active = true AND is_selected = true;

-- 3. Comentários
COMMENT ON TABLE public.automation_coupon_rules IS 'Agenda ativa de cupons para automação recorrente. SELECT liberado para usuário, escrita apenas via API/ServiceRole.';

-- 4. Trigger de updated_at (Safe Check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_automation_coupon_rules_updated_at') THEN
        CREATE TRIGGER tr_automation_coupon_rules_updated_at
            BEFORE UPDATE ON public.automation_coupon_rules
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 5. Segurança (RLS)
ALTER TABLE public.automation_coupon_rules ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (Dono dos dados)
DROP POLICY IF EXISTS "Users can view own coupon rules" ON public.automation_coupon_rules;
CREATE POLICY "Users can view own coupon rules"
    ON public.automation_coupon_rules
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Escrita restrita ao service_role via GRANT (Escrita segura via Backend)
-- Não há políticas de INSERT/UPDATE/DELETE para authenticated.

-- 6. GRANTs e Permissões Estritas
REVOKE ALL ON public.automation_coupon_rules FROM anon;
GRANT SELECT ON public.automation_coupon_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_coupon_rules TO service_role;
