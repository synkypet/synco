-- supabase/migrations/20260514193100_managed_templates_seeds.sql

-- Inserir Templates Padrão do Sistema (Idempotente)
INSERT INTO message_templates 
(name, template_key, template_type, category, content, is_system, is_default, is_editable, is_deletable)
VALUES
-- PRODUTO SHOPEE PADRÃO
(
  'Produto Shopee Padrão', 
  'shopee_product_default', 
  'shopee_product', 
  'product', 
  '🛍️ {{product_name}}

{{smart_price_block}}

📦 Compre aqui:
{{affiliate_link}}

{{disclaimer}}', 
  true, true, false, false
),
-- PRODUTO SHOPEE PREMIUM (COM CUPOM)
(
  'Produto Shopee Premium', 
  'shopee_product_premium', 
  'shopee_product_premium', 
  'product', 
  '🛍️ {{product_name}}

{{smart_price_block}}

📦 Compre aqui:
{{affiliate_link}}

{{coupon_block}}

⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.', 
  true, true, false, false
),
-- CUPOM SHOPEE
(
  'Cupom Shopee Individual', 
  'shopee_coupon_default', 
  'shopee_coupon', 
  'coupon', 
  '🔥 *CUPOM DE DESCONTO LIBERADO!*

{{coupon_discount_line}}
🎟️ *Código:* {{coupon_code}}

🔗 Resgate aqui:
{{coupon_link}}

⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.', 
  true, true, false, false
),
-- PROMO LANDING / SUPER OFERTAS
(
  'Shopee Super Ofertas', 
  'shopee_promo_landing_default', 
  'shopee_promo_landing', 
  'campaign', 
  '🚨 *ACESSO VIP SHOPEE LIBERADO!* 🚨

🔥 Uma página especial de ofertas da Shopee acabou de ser liberada com promoções por tempo limitado.

🛒 Produtos com descontos em várias categorias podem aparecer a qualquer momento.
🎟️ Cupons, frete grátis e ofertas relâmpago ficam disponíveis conforme estoque e disponibilidade.

⚡ Quem entra primeiro tem mais chance de aproveitar antes que os melhores achados acabem.

🔗 *ENTRE NA ÁREA VIP DE OFERTAS:*
{{promo_link}}

⚠️ Os preços, cupons e descontos podem mudar ou acabar sem aviso prévio.', 
  true, true, false, false
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  template_type = EXCLUDED.template_type,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default,
  is_editable = EXCLUDED.is_editable,
  is_deletable = EXCLUDED.is_deletable,
  updated_at = now();
