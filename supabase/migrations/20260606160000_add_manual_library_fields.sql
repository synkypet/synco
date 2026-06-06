-- migration: 20260606160000_add_manual_library_fields.sql

-- 1. Adicionar campos de curadoria manual
ALTER TABLE public.discovered_coupons 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS custom_title TEXT,
ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- 2. Atualizar constraint: dispatchable
ALTER TABLE public.discovered_coupons
DROP CONSTRAINT IF EXISTS discovered_coupons_dispatchable_check;

ALTER TABLE public.discovered_coupons
ADD CONSTRAINT discovered_coupons_dispatchable_check
CHECK (
  is_manual = true OR dispatchable = false
);

-- 3. Atualizar constraint: auto_dispatch_blocked
ALTER TABLE public.discovered_coupons
DROP CONSTRAINT IF EXISTS discovered_coupons_auto_dispatch_blocked_check;

ALTER TABLE public.discovered_coupons
ADD CONSTRAINT discovered_coupons_auto_dispatch_blocked_check
CHECK (
  is_manual = true OR auto_dispatch_blocked = true
);

-- 4. Atualizar constraint: block_reason
ALTER TABLE public.discovered_coupons
DROP CONSTRAINT IF EXISTS discovered_coupons_block_reason_check;

ALTER TABLE public.discovered_coupons
ADD CONSTRAINT discovered_coupons_block_reason_check
CHECK (
  is_manual = true OR block_reason = 'coupon_requires_manual_review_or_phase_2c_dispatch'
);

-- 5. Atualizar constraint: coupon_data_integrity para suportar itens puramente descritivos
ALTER TABLE public.discovered_coupons
DROP CONSTRAINT IF EXISTS chk_coupon_data_integrity;

ALTER TABLE public.discovered_coupons
ADD CONSTRAINT chk_coupon_data_integrity
CHECK (
  (coupon_type = 'codigo' AND ((code IS NOT NULL AND length(trim(code)) > 0) OR custom_description IS NOT NULL))
  OR
  (coupon_type IN ('link_resgate', 'pagina_cupons') AND (redemption_url IS NOT NULL OR custom_description IS NOT NULL))
);
