-- supabase/migrations/20260506000000_message_templates.sql

CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('product', 'coupon', 'campaign')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Usuário vê seus próprios templates + os padrão do sistema
CREATE POLICY "Users see own and system templates" ON message_templates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_system_default = true);

CREATE POLICY "Users manage own templates" ON message_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Templates padrão do sistema (user_id NULL, is_system_default true)
INSERT INTO message_templates (user_id, name, category, content, is_system_default) VALUES
  (NULL, 'Cupom Animado', 'coupon', '✨ *{{titulo}}* ✨

🎁 Resgate agora e economize:
{{link}}

⏰ Válido por tempo limitado — corre!', true),

  (NULL, 'Cupom Urgente', 'coupon', '🚨 CUPOM DISPONÍVEL 🚨

🎟️ *{{titulo}}*

👇 Acesse antes que acabe:
{{link}}

🔥 Promoção por tempo limitado!', true),

  (NULL, 'Produto Oferta', 'product', '🔥 *OFERTA DO DIA* 🔥

📦 *{{titulo}}*
💰 De: ~R$ {{preco_original}}~
💎 *Por: R$ {{preco}}*
🏷️ {{desconto}}% de desconto

🛒 Compre aqui: {{link}}', true),

  (NULL, 'Produto Simples', 'product', '👀 Viu essa oferta?

*{{titulo}}*
💵 R$ {{preco}} ({{desconto}}% OFF)

👉 {{link}}

⚠️ Estoque limitado!', true),

  (NULL, 'Campanha Destaque', 'campaign', '🛍️ *{{titulo}}* — Shopee em Promoção!

Centenas de produtos com desconto em um só lugar 👇
{{link}}

💥 Aproveite enquanto durar!', true),

  (NULL, 'Campanha Urgente', 'campaign', '⚡ CAMPANHA ATIVA AGORA ⚡

🏷️ *{{titulo}}*
Ofertas imperdíveis com até {{comissao}}% de cashback para você!

🔗 Acesse: {{link}}

⏳ Por tempo limitado!', true);
