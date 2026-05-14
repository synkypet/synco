-- supabase/migrations/20260514120000_create_discovered_promo_pages.sql

-- 1. Criar a tabela de páginas promocionais descobertas
CREATE TABLE IF NOT EXISTS public.discovered_promo_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id uuid REFERENCES public.automation_sources(id) ON DELETE SET NULL,
    marketplace text NOT NULL DEFAULT 'shopee',
    offer_type text NOT NULL DEFAULT 'promo_landing',
    landing_type text NOT NULL,
    title text,
    description text,
    raw_url text,
    canonical_url text,
    source_url text,
    raw_text text,
    confidence numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'candidate',
    dedupe_key text NOT NULL,
    
    -- TRAVAS DE SEGURANÇA (FASE 2G)
    dispatchable boolean NOT NULL DEFAULT false CHECK (dispatchable = false),
    auto_dispatch_blocked boolean NOT NULL DEFAULT true CHECK (auto_dispatch_blocked = true),
    block_reason text NOT NULL DEFAULT 'promo_landing_requires_manual_review',
    
    capture_count integer NOT NULL DEFAULT 1,
    captured_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints de integridade
    CONSTRAINT check_marketplace_shopee CHECK (marketplace = 'shopee'),
    CONSTRAINT check_offer_type_promo CHECK (offer_type = 'promo_landing'),
    CONSTRAINT check_landing_type_valid CHECK (landing_type IN ('super_ofertas')),
    CONSTRAINT check_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT check_status_valid CHECK (status IN ('candidate', 'unknown', 'valid', 'expired')),
    CONSTRAINT check_dedupe_key_not_empty CHECK (dedupe_key <> ''),
    CONSTRAINT check_capture_count_positive CHECK (capture_count >= 1),
    
    -- Deduplicação por usuário
    UNIQUE(user_id, dedupe_key)
);

-- 2. Habilitar RLS
ALTER TABLE public.discovered_promo_pages ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
-- Usuários autenticados podem ver apenas seus próprios registros
CREATE POLICY "Users can select their own discovered promo pages"
    ON public.discovered_promo_pages
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Somente service_role (backend) pode inserir/atualizar/deletar
-- Isso garante que as travas de segurança (dispatchable=false) não sejam burladas via frontend

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_discovered_promo_pages_user_id ON public.discovered_promo_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_promo_pages_source_id ON public.discovered_promo_pages(source_id);
CREATE INDEX IF NOT EXISTS idx_discovered_promo_pages_status ON public.discovered_promo_pages(status);
CREATE INDEX IF NOT EXISTS idx_discovered_promo_pages_landing_type ON public.discovered_promo_pages(landing_type);
CREATE INDEX IF NOT EXISTS idx_discovered_promo_pages_captured_at ON public.discovered_promo_pages(captured_at DESC);

-- 5. Trigger para updated_at
CREATE TRIGGER update_discovered_promo_pages_updated_at
    BEFORE UPDATE ON public.discovered_promo_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Comentários para documentação
COMMENT ON TABLE public.discovered_promo_pages IS 'Páginas promocionais (landing pages) capturadas pelo Radar e Automações.';
COMMENT ON COLUMN public.discovered_promo_pages.dispatchable IS 'Sempre false para promo_landing vindas do Radar (Exige revisão manual).';
COMMENT ON COLUMN public.discovered_promo_pages.auto_dispatch_blocked IS 'Sempre true para promo_landing (Bloqueio de envio automático).';
