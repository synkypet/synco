-- migration: 20260515102000_update_shopee_coupon_template.sql
-- Objetivo: Atualizar o formato padrão dos cupons Shopee para ordem correta (Código antes de Desconto)
-- e garantir que o CTA de resgate use os novos placeholders de linha seguros.

UPDATE public.message_templates
SET content = '🔥 *CUPOM SHOPEE LIBERADO!* 🔥

{{coupon_code_line}}
{{coupon_discount_line}}

⚡ Resgate antes que acabe.

{{coupon_link_line}}

⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.'
WHERE template_key = 'shopee_coupon_default';

-- Se não existir, o seed original cuidará na próxima execução, 
-- mas aqui garantimos que a produção receba o hotfix se o template_key bater.
