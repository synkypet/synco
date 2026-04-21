-- migration: 20240421000001_add_eligibility_and_installments_to_campaign_items.sql
-- Objetivo: Suportar a Fase 2 (Elegibilidade Operacional) e salvar parcelamento nos itens da campanha.

ALTER TABLE public.campaign_items
ADD COLUMN IF NOT EXISTS eligibility_status TEXT DEFAULT 'eligible',
ADD COLUMN IF NOT EXISTS eligibility_reasons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS installments TEXT;

-- Comentários para documentação do schema
COMMENT ON COLUMN public.campaign_items.eligibility_status IS 'Status de elegibilidade no momento do despacho (eligible, warning, ineligible)';
COMMENT ON COLUMN public.campaign_items.eligibility_reasons IS 'Lista de motivos técnicos para o status de elegibilidade';
COMMENT ON COLUMN public.campaign_items.installments IS 'Texto descritivo do parcelamento capturado na extração factual';

-- Índice para facilitar auditoria de itens inelegíveis que foram despachados
CREATE INDEX IF NOT EXISTS idx_campaign_items_eligibility 
ON public.campaign_items(eligibility_status) 
WHERE eligibility_status != 'eligible';
