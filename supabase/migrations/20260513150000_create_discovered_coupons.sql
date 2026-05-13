-- migration: 20260513150000_create_discovered_coupons.sql
-- Objetivo: Persistência real de cupons Shopee detectados (Candidatos) com deduplicação.

CREATE TABLE IF NOT EXISTS public.discovered_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.automation_sources(id) ON DELETE SET NULL,
    
    -- Metadados de Identificação
    marketplace TEXT NOT NULL DEFAULT 'shopee' CHECK (marketplace = 'shopee'),
    offer_type TEXT NOT NULL DEFAULT 'coupon_offer' CHECK (offer_type = 'coupon_offer'),
    coupon_type TEXT NOT NULL CHECK (coupon_type IN ('codigo', 'link_resgate', 'pagina_cupons')),
    
    -- Dados do Cupom
    code TEXT,
    coupon_label TEXT,
    redemption_url TEXT,
    source_url TEXT, -- URL onde foi encontrado
    product_url TEXT, -- URL do produto relacionado (se houver)
    raw_text TEXT,
    
    -- Qualidade e Estado
    confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'unknown', 'valid', 'expired')),
    
    -- Deduplicação
    dedupe_key TEXT NOT NULL CHECK (length(trim(dedupe_key)) > 0),
    
    -- Trava de Segurança Hard-coded
    dispatchable BOOLEAN NOT NULL DEFAULT false CHECK (dispatchable = false),
    auto_dispatch_blocked BOOLEAN NOT NULL DEFAULT true CHECK (auto_dispatch_blocked = true),
    block_reason TEXT NOT NULL DEFAULT 'coupon_requires_manual_review_or_phase_2c_dispatch'
        CHECK (block_reason = 'coupon_requires_manual_review_or_phase_2c_dispatch'),
    
    -- Contadores e Timestamps
    capture_count INTEGER NOT NULL DEFAULT 1 CHECK (capture_count >= 1),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Regras de Integridade por Tipo de Cupom
    CONSTRAINT chk_coupon_data_integrity CHECK (
        (coupon_type = 'codigo' AND code IS NOT NULL AND length(trim(code)) > 0)
        OR
        (coupon_type IN ('link_resgate', 'pagina_cupons') AND redemption_url IS NOT NULL AND length(trim(redemption_url)) > 0)
    ),

    -- Restrição de Unicidade por Usuário + Dedupe Key
    CONSTRAINT uq_discovered_coupons_user_dedupe UNIQUE(user_id, dedupe_key)
);

-- Comentários para documentação do schema
COMMENT ON TABLE public.discovered_coupons IS 'Tabela de candidatos a cupons capturados via Radar ou Automação';
COMMENT ON COLUMN public.discovered_coupons.dedupe_key IS 'Chave de deduplicação determinística: marketplace:coupon:type:identifier';
COMMENT ON COLUMN public.discovered_coupons.dispatchable IS 'Trava de segurança: Cupons nunca são despachados automaticamente nesta fase';

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_user ON public.discovered_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_source ON public.discovered_coupons(source_id);
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_status ON public.discovered_coupons(status);
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_type ON public.discovered_coupons(coupon_type);
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_captured ON public.discovered_coupons(captured_at DESC);

-- Trigger de updated_at (Padrão do Projeto)
DROP TRIGGER IF EXISTS update_discovered_coupons_updated_at ON public.discovered_coupons;
CREATE TRIGGER update_discovered_coupons_updated_at
    BEFORE UPDATE ON public.discovered_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Segurança (RLS)
ALTER TABLE public.discovered_coupons ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (Dono dos dados)
DROP POLICY IF EXISTS "Users can view own discovered coupons" ON public.discovered_coupons;
CREATE POLICY "Users can view own discovered coupons"
    ON public.discovered_coupons
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Política de Escrita (Service Role / Server-side via bypass ou política explícita se necessário para authenticated)
-- No SYNCO, geralmente o backend opera via service_role ou o usuário insere via política:
DROP POLICY IF EXISTS "Users can insert own discovered coupons" ON public.discovered_coupons;
CREATE POLICY "Users can insert own discovered coupons"
    ON public.discovered_coupons
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own discovered coupons" ON public.discovered_coupons;
CREATE POLICY "Users can update own discovered coupons"
    ON public.discovered_coupons
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
