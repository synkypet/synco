-- migration: 20240417000001_add_reaffiliation_fields_to_campaign_items.sql
-- Objetivo: Adicionar campos de rastreabilidade e auditoria de reafiliação para links Shopee

ALTER TABLE public.campaign_items
ADD COLUMN IF NOT EXISTS incoming_url TEXT,
ADD COLUMN IF NOT EXISTS resolved_url TEXT,
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS generated_affiliate_url TEXT,
ADD COLUMN IF NOT EXISTS redirect_chain JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reaffiliation_status TEXT DEFAULT 'not_needed',
ADD COLUMN IF NOT EXISTS reaffiliation_error TEXT;

-- Comentários para documentação do schema
COMMENT ON COLUMN public.campaign_items.incoming_url IS 'URL original recebida do usuário/sistema';
COMMENT ON COLUMN public.campaign_items.resolved_url IS 'URL final obtida após resolver redirects';
COMMENT ON COLUMN public.campaign_items.canonical_url IS 'URL Shopee limpa/canônica usada como base real do produto';
COMMENT ON COLUMN public.campaign_items.generated_affiliate_url IS 'Nova URL afiliada gerada para o usuário atual';
COMMENT ON COLUMN public.campaign_items.redirect_chain IS 'Lista com a cadeia de redirects observada durante a resolução';
COMMENT ON COLUMN public.campaign_items.reaffiliation_status IS 'Status do processo (not_needed, resolved, canonicalized, reaffiliated, blocked, failed)';
COMMENT ON COLUMN public.campaign_items.reaffiliation_error IS 'Mensagem técnica útil em caso de falha no processo de reafiliação';
