-- supabase/migrations/20260506000000_message_templates.sql

-- Se a tabela já existir, limpamos os templates antigos para garantir os novos modelos
-- DELETE FROM message_templates WHERE is_system_default = true;

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('product', 'coupon', 'campaign')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir que as políticas existam
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own and system templates') THEN
        ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users see own and system templates" ON message_templates
          FOR SELECT TO authenticated
          USING (auth.uid() = user_id OR is_system_default = true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own templates') THEN
        CREATE POLICY "Users manage own templates" ON message_templates
          FOR ALL TO authenticated
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Limpar templates padrão antigos se estiver re-executando
DELETE FROM message_templates WHERE is_system_default = true;

-- Templates padrão do sistema (user_id NULL, is_system_default true)
INSERT INTO message_templates (user_id, name, category, content, is_system_default) VALUES
  -- PRODUTOS
  (NULL, 'Produto com Desconto', 'product', '🛍️ {{titulo_maiusculo}}
~De: R$ {{preco_original}}~
🔥 *Por: R$ {{preco}}*

📦 Compre aqui:
{{link}}

⚠️ Promoção sujeita a alteração a qualquer momento.', true),

  (NULL, 'Produto Simples', 'product', '🛍️ {{titulo_maiusculo}}
🔥 *Por: R$ {{preco}}*

📦 Compre aqui:
{{link}}

⚠️ Promoção sujeita a alteração a qualquer momento.', true),

  -- CUPONS
  (NULL, 'Cupom Campanha', 'coupon', '🚨 CUPONS SHOPEE RENOVADOS 🚨
🔥 {{titulo_maiusculo}} 🔥

🎟️ Cupons de até R$ {{valor}} OFF
🚚 Frete Grátis acima de R$ {{frete_minimo}}

🔗 RESGATE OS CUPONS AQUI:
{{link}}', true),

  (NULL, 'Cupom Código', 'coupon', '🎟️ Use o cupom: {{titulo_maiusculo}} | resgate aqui: {{link}}', true),

  (NULL, 'Cupom Valor OFF', 'coupon', 'Cupom Shopee
R$ {{valor}} OFF em R$ {{minimo}}:

🎟️ {{codigo}}

🛒 Ative aqui:
{{link}}', true),

  -- CAMPANHAS
  (NULL, 'Campanha Destaque', 'campaign', '🚨 TÁ ROLANDO AGORA! 🚨
🔥 {{titulo_maiusculo}} 🔥

✨ Seleção especial com descontos incríveis!
🎟️ Cupons disponíveis no link

👇 VEJA TODAS AS OFERTAS:
🔗 {{link}}

⚠️ Promoção sujeita a alteração a qualquer momento.', true);
