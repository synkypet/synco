-- 20240406000002_products_and_campaigns.sql
-- Adição de tabelas para o Radar de Ofertas e Histórico de Envios

-- 1. Tabela de Produtos (Catálogo do Radar)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    marketplace TEXT NOT NULL, -- 'Shopee', 'Mercado Livre', etc.
    category TEXT,
    original_url TEXT NOT NULL,
    image_url TEXT,
    original_price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    discount_percent INTEGER,
    commission_percent INTEGER,
    commission_value DECIMAL(10,2),
    coupon TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2),
    sales_count INTEGER DEFAULT 0,
    opportunity_score INTEGER,
    free_shipping BOOLEAN DEFAULT FALSE,
    official_store BOOLEAN DEFAULT FALSE,
    already_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Campanhas (Histórico de Envios)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'failed', 'scheduled'
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Itens da Campanha (Produtos enviados)
CREATE TABLE IF NOT EXISTS public.campaign_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, 
    product_name TEXT NOT NULL, 
    custom_text TEXT, 
    affiliate_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Destinos da Campanha
CREATE TABLE IF NOT EXISTS public.campaign_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    destination_type TEXT NOT NULL, -- 'list' ou 'group'
    destination_id UUID NOT NULL, -- ID da destination_list ou do group
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Triggers de updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Índices para performance e filtros
CREATE INDEX IF NOT EXISTS idx_products_marketplace ON public.products(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_opportunity_score ON public.products(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- 7. RLS (Row Level Security)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_destinations ENABLE ROW LEVEL SECURITY;

-- Produtos são públicos (leitura), mas apenas admin/system (bypass) podem escrever
CREATE POLICY "Produtos são visíveis para todos os usuários autenticados"
ON public.products FOR SELECT
TO authenticated
USING (true);

-- Campanhas são privadas por usuário
CREATE POLICY "Usuários podem ver suas próprias campanhas"
ON public.campaigns FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias campanhas"
ON public.campaigns FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias campanhas"
ON public.campaigns FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Itens e Destinos seguem a mesma regra via join lateral
CREATE POLICY "Usuários podem ver itens de suas campanhas"
ON public.campaign_items FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

CREATE POLICY "Usuários podem inserir itens em suas campanhas"
ON public.campaign_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

CREATE POLICY "Usuários podem ver destinos de suas campanhas"
ON public.campaign_destinations FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

CREATE POLICY "Usuários podem inserir destinos em suas campanhas"
ON public.campaign_destinations FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

-- Seeds de exemplo para o Radar
INSERT INTO public.products (name, marketplace, category, original_url, image_url, original_price, current_price, discount_percent, commission_percent, opportunity_score, free_shipping, official_store)
VALUES 
('Fone Bluetooth TWS Pro Max', 'Shopee', 'Eletrônicos', 'https://shopee.com.br/product-1', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', 189.90, 49.90, 74, 12, 95, true, true),
('Organizador Maquiagem Acrílico 360°', 'Shopee', 'Casa', 'https://shopee.com.br/product-2', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400', 149.90, 59.90, 60, 18, 88, false, false),
('Webcam Full HD 1080p c/ Microfone', 'Mercado Livre', 'Informática', 'https://mercadolivre.com.br/product-3', 'https://images.unsplash.com/photo-1589121017834-89f660840460?w=400', 250.00, 129.00, 48, 10, 82, true, true),
('Smart Watch Series 8 Ultra', 'Amazon', 'Acessórios', 'https://amazon.com.br/product-4', 'https://images.unsplash.com/photo-1544117518-e6992da2bac4?w=400', 599.00, 299.00, 50, 8, 85, true, false),
('Kit 10 Meias Esportivas Algodão', 'Magalu', 'Moda', 'https://magalu.com.br/product-5', 'https://images.unsplash.com/photo-1586350977966-b040f8980757?w=400', 89.90, 39.90, 55, 15, 90, false, true);
