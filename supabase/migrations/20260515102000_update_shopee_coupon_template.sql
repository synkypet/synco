-- migration: 20260515102000_update_shopee_coupon_template.sql
-- Objetivo: Upsert do formato padrão dos cupons Shopee para ordem correta (Código antes de Desconto)
-- e garantir que o CTA de resgate use os novos placeholders de linha seguros.

INSERT INTO public.message_templates (
  name,
  template_key,
  template_type,
  category,
  content,
  is_system,
  is_default,
  is_editable,
  is_deletable,
  metadata
)
VALUES (
  'Cupom Shopee Individual',
  'shopee_coupon_default',
  'shopee_coupon',
  'coupon',
  '🔥 *CUPOM SHOPEE LIBERADO!* 🔥

{{coupon_code_line}}
{{coupon_discount_line}}

⚡ Resgate antes que acabe.

{{coupon_link_line}}

⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.',
  true,
  true,
  false,
  false,
  '{}'::jsonb
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  template_type = EXCLUDED.template_type,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_system = true,
  is_default = true,
  is_editable = false,
  is_deletable = false,
  metadata = COALESCE(public.message_templates.metadata, '{}'::jsonb),
  updated_at = now();
