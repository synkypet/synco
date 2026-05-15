-- migration: 20260515213000_add_validation_status_to_discovered_coupons.sql
-- Objetivo: Adicionar campos de validação para evitar que produtos sejam classificados como cupons.

-- 1. Adicionar colunas de validação
ALTER TABLE public.discovered_coupons 
ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'candidate',
ADD COLUMN IF NOT EXISTS is_verified_coupon BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. Adicionar check constraint para validation_status
ALTER TABLE public.discovered_coupons
DROP CONSTRAINT IF EXISTS chk_validation_status;

ALTER TABLE public.discovered_coupons
ADD CONSTRAINT chk_validation_status 
CHECK (validation_status IN ('candidate', 'verified', 'rejected', 'product_link', 'expired'));

-- 3. Criar índice para performance de filtragem na automação
CREATE INDEX IF NOT EXISTS idx_discovered_coupons_validation ON public.discovered_coupons(validation_status, is_verified_coupon);

-- 4. Comentários
COMMENT ON COLUMN public.discovered_coupons.validation_status IS 'Estado da auditoria factual: candidate (inicial), verified (confirmado), rejected (inválido), product_link (erro de classificação)';
COMMENT ON COLUMN public.discovered_coupons.is_verified_coupon IS 'Flag simplificada para sincronização com automações';
