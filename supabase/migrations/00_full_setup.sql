-- ══════════════════════════════════════════════════════════════════════════════
-- SYNCO — Migration Completa (Safe - não dá erro se já existir)
-- Cole TUDO no SQL Editor do Supabase e clique em Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══ Extensões ═══
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══ Função updated_at ═══
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ═══ Profiles ═══
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Marketplaces ═══
CREATE TABLE IF NOT EXISTS public.marketplaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    description TEXT,
    configured BOOLEAN DEFAULT FALSE,
    affiliate_id TEXT,
    last_validated TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Channels ═══
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Groups ═══
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    is_source BOOLEAN DEFAULT FALSE,
    is_destination BOOLEAN DEFAULT FALSE,
    is_monitored BOOLEAN DEFAULT FALSE,
    members_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Destination Lists ═══
CREATE TABLE IF NOT EXISTS public.destination_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.destination_list_groups (
    list_id UUID NOT NULL REFERENCES public.destination_lists(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    PRIMARY KEY (list_id, group_id)
);

-- ═══ Triggers updated_at (base) ═══
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplaces_updated_at ON public.marketplaces;
CREATE TRIGGER update_marketplaces_updated_at BEFORE UPDATE ON public.marketplaces FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_channels_updated_at ON public.channels;
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_destination_lists_updated_at ON public.destination_lists;
CREATE TRIGGER update_destination_lists_updated_at BEFORE UPDATE ON public.destination_lists FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ═══ Auth Trigger ═══
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ═══ RLS (base) ═══
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_list_groups ENABLE ROW LEVEL SECURITY;

-- Policies (DROP IF EXISTS para evitar duplicatas)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
  CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

  DROP POLICY IF EXISTS "Marketplaces are viewable by authenticated users" ON public.marketplaces;
  CREATE POLICY "Marketplaces are viewable by authenticated users" ON public.marketplaces FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "Users can view own channels" ON public.channels;
  CREATE POLICY "Users can view own channels" ON public.channels FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can insert own channels" ON public.channels;
  CREATE POLICY "Users can insert own channels" ON public.channels FOR INSERT WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update own channels" ON public.channels;
  CREATE POLICY "Users can update own channels" ON public.channels FOR UPDATE USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can delete own channels" ON public.channels;
  CREATE POLICY "Users can delete own channels" ON public.channels FOR DELETE USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view own groups" ON public.groups;
  CREATE POLICY "Users can view own groups" ON public.groups FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can insert own groups" ON public.groups;
  CREATE POLICY "Users can insert own groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update own groups" ON public.groups;
  CREATE POLICY "Users can update own groups" ON public.groups FOR UPDATE USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can delete own groups" ON public.groups;
  CREATE POLICY "Users can delete own groups" ON public.groups FOR DELETE USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view own lists" ON public.destination_lists;
  CREATE POLICY "Users can view own lists" ON public.destination_lists FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can insert own lists" ON public.destination_lists;
  CREATE POLICY "Users can insert own lists" ON public.destination_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update own lists" ON public.destination_lists;
  CREATE POLICY "Users can update own lists" ON public.destination_lists FOR UPDATE USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can delete own lists" ON public.destination_lists;
  CREATE POLICY "Users can delete own lists" ON public.destination_lists FOR DELETE USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can manage junction via list owner" ON public.destination_list_groups;
  CREATE POLICY "Users can manage junction via list owner" ON public.destination_list_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.destination_lists
      WHERE id = destination_list_groups.list_id
      AND user_id = auth.uid()
    )
  );
END $$;

-- ═══ Índices base ═══
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON public.channels(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON public.groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_channel_id ON public.groups(channel_id);
CREATE INDEX IF NOT EXISTS idx_destination_lists_user_id ON public.destination_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_dlg_list_id ON public.destination_list_groups(list_id);
CREATE INDEX IF NOT EXISTS idx_dlg_group_id ON public.destination_list_groups(group_id);

-- ═══ Seeds Marketplaces ═══
INSERT INTO public.marketplaces (name, icon, color, description, configured)
VALUES 
  ('Shopee', 'shopping_bag', '#EE4D2D', 'Marketplace global com foco em ofertas variadas.', true),
  ('Mercado Livre', 'local_shipping', '#FFE600', 'Líder em e-commerce na América Latina.', true),
  ('Amazon', 'amazon', '#FF9900', 'O maior marketplace do mundo.', true),
  ('Magalu', 'shopping_cart', '#0086FF', 'Varejista brasileira com ecossistema completo.', true),
  ('AliExpress', 'global', '#E62E04', 'Gigante chinês de exportação global.', true),
  ('Shein', 'style', '#000000', 'Foco em moda e lifestyle com preços competitivos.', true)
ON CONFLICT (name) DO UPDATE 
SET 
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  configured = EXCLUDED.configured;

-- ═══ User Marketplaces ═══
CREATE TABLE IF NOT EXISTS public.user_marketplaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    affiliate_id TEXT,
    affiliate_code TEXT,
    affiliate_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, marketplace_id)
);

ALTER TABLE public.user_marketplaces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage their own marketplace connections" ON public.user_marketplaces;
  CREATE POLICY "Users can manage their own marketplace connections"
    ON public.user_marketplaces FOR ALL USING (auth.uid() = user_id);
END $$;

DROP TRIGGER IF EXISTS update_user_marketplaces_updated_at ON public.user_marketplaces;
CREATE TRIGGER update_user_marketplaces_updated_at 
    BEFORE UPDATE ON public.user_marketplaces 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX IF NOT EXISTS user_marketplaces_user_id_idx ON public.user_marketplaces (user_id);
CREATE INDEX IF NOT EXISTS user_marketplaces_marketplace_id_idx ON public.user_marketplaces (marketplace_id);

-- ═══ Products & Campaigns ═══
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    marketplace TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, 
    product_name TEXT NOT NULL, 
    custom_text TEXT, 
    affiliate_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    destination_type TEXT NOT NULL,
    destination_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_products_marketplace ON public.products(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_opportunity_score ON public.products(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_destinations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Produtos são visíveis para todos os usuários autenticados" ON public.products;
  CREATE POLICY "Produtos são visíveis para todos os usuários autenticados"
    ON public.products FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "Usuários podem ver suas próprias campanhas" ON public.campaigns;
  CREATE POLICY "Usuários podem ver suas próprias campanhas"
    ON public.campaigns FOR SELECT TO authenticated USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Usuários podem criar suas próprias campanhas" ON public.campaigns;
  CREATE POLICY "Usuários podem criar suas próprias campanhas"
    ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias campanhas" ON public.campaigns;
  CREATE POLICY "Usuários podem atualizar suas próprias campanhas"
    ON public.campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Usuários podem ver itens de suas campanhas" ON public.campaign_items;
  CREATE POLICY "Usuários podem ver itens de suas campanhas"
    ON public.campaign_items FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
  DROP POLICY IF EXISTS "Usuários podem inserir itens em suas campanhas" ON public.campaign_items;
  CREATE POLICY "Usuários podem inserir itens em suas campanhas"
    ON public.campaign_items FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

  DROP POLICY IF EXISTS "Usuários podem ver destinos de suas campanhas" ON public.campaign_destinations;
  CREATE POLICY "Usuários podem ver destinos de suas campanhas"
    ON public.campaign_destinations FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
  DROP POLICY IF EXISTS "Usuários podem inserir destinos em suas campanhas" ON public.campaign_destinations;
  CREATE POLICY "Usuários podem inserir destinos em suas campanhas"
    ON public.campaign_destinations FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
END $$;

-- Seeds de Produtos
INSERT INTO public.products (name, marketplace, category, original_url, image_url, original_price, current_price, discount_percent, commission_percent, opportunity_score, free_shipping, official_store)
VALUES 
('Fone Bluetooth TWS Pro Max', 'Shopee', 'Eletrônicos', 'https://shopee.com.br/product-1', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', 189.90, 49.90, 74, 12, 95, true, true),
('Organizador Maquiagem Acrílico 360°', 'Shopee', 'Casa', 'https://shopee.com.br/product-2', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400', 149.90, 59.90, 60, 18, 88, false, false),
('Webcam Full HD 1080p c/ Microfone', 'Mercado Livre', 'Informática', 'https://mercadolivre.com.br/product-3', 'https://images.unsplash.com/photo-1589121017834-89f660840460?w=400', 250.00, 129.00, 48, 10, 82, true, true),
('Smart Watch Series 8 Ultra', 'Amazon', 'Acessórios', 'https://amazon.com.br/product-4', 'https://images.unsplash.com/photo-1544117518-e6992da2bac4?w=400', 599.00, 299.00, 50, 8, 85, true, false),
('Kit 10 Meias Esportivas Algodão', 'Magalu', 'Moda', 'https://magalu.com.br/product-5', 'https://images.unsplash.com/photo-1586350977966-b040f8980757?w=400', 89.90, 39.90, 55, 15, 90, false, true)
ON CONFLICT DO NOTHING;

-- ═══ Earnings Tables ═══
CREATE TABLE IF NOT EXISTS public.earnings_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace TEXT NOT NULL,
    period TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    products_count INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_commissions NUMERIC(15, 2) DEFAULT 0.00,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.earnings_import_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES public.earnings_imports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_name TEXT,
    order_id TEXT,
    order_amount NUMERIC(15, 2),
    commission_amount NUMERIC(15, 2),
    status TEXT,
    occurred_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.earnings_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_import_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own earnings imports" ON public.earnings_imports;
  CREATE POLICY "Users can view their own earnings imports"
    ON public.earnings_imports FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can insert their own earnings imports" ON public.earnings_imports;
  CREATE POLICY "Users can insert their own earnings imports"
    ON public.earnings_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update their own earnings imports" ON public.earnings_imports;
  CREATE POLICY "Users can update their own earnings imports"
    ON public.earnings_imports FOR UPDATE USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can delete their own earnings imports" ON public.earnings_imports;
  CREATE POLICY "Users can delete their own earnings imports"
    ON public.earnings_imports FOR DELETE USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view their own earnings import items" ON public.earnings_import_items;
  CREATE POLICY "Users can view their own earnings import items"
    ON public.earnings_import_items FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can insert their own earnings import items" ON public.earnings_import_items;
  CREATE POLICY "Users can insert their own earnings import items"
    ON public.earnings_import_items FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;

CREATE INDEX IF NOT EXISTS idx_earnings_imports_user_id ON public.earnings_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_import_id ON public.earnings_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_user_id ON public.earnings_import_items(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_occurred_at ON public.earnings_import_items(occurred_at);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_earnings_imports_updated_at ON public.earnings_imports;
CREATE TRIGGER tr_earnings_imports_updated_at
    BEFORE UPDATE ON public.earnings_imports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══ Wasender Integration ═══
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS remote_id TEXT;

CREATE TABLE IF NOT EXISTS public.channel_secrets (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_channel_secrets_updated_at ON public.channel_secrets;
CREATE TRIGGER update_channel_secrets_updated_at 
BEFORE UPDATE ON public.channel_secrets 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.channel_secrets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert their own channel secrets" ON public.channel_secrets;
  CREATE POLICY "Users can insert their own channel secrets"
    ON public.channel_secrets FOR INSERT WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update their own channel secrets" ON public.channel_secrets;
  CREATE POLICY "Users can update their own channel secrets"
    ON public.channel_secrets FOR UPDATE USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users cannot select their own secrets directly (only backend server-side access allowed)" ON public.channel_secrets;
  CREATE POLICY "Users cannot select their own secrets directly (only backend server-side access allowed)"
    ON public.channel_secrets FOR SELECT USING (false);
END $$;

-- ═══ Send Engine (Fila + Recibos + webhook_secret) ═══
ALTER TABLE public.channel_secrets ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

CREATE TABLE IF NOT EXISTS public.send_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    destination TEXT NOT NULL,
    destination_name TEXT,
    message_body TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    status TEXT DEFAULT 'pending',
    try_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.send_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_job_id UUID NOT NULL REFERENCES public.send_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    campaign_item_id UUID REFERENCES public.campaign_items(id) ON DELETE SET NULL,
    destination TEXT NOT NULL,
    status TEXT DEFAULT 'delivered',
    wasender_message_id TEXT,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_send_jobs_status_session ON public.send_jobs(status, session_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_send_jobs_user_id ON public.send_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_send_jobs_campaign_id ON public.send_jobs(campaign_id);

-- Índice único de idempotência (ignora erro se já existir)
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_send_receipts_idempotency
    ON public.send_receipts(campaign_id, campaign_item_id, destination)
    WHERE campaign_id IS NOT NULL AND campaign_item_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_send_receipts_job ON public.send_receipts(send_job_id);

DROP TRIGGER IF EXISTS update_send_jobs_updated_at ON public.send_jobs;
CREATE TRIGGER update_send_jobs_updated_at
BEFORE UPDATE ON public.send_jobs
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.send_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_receipts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own send_jobs" ON public.send_jobs;
  CREATE POLICY "Users can view their own send_jobs" ON public.send_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can create their own send_jobs" ON public.send_jobs;
  CREATE POLICY "Users can create their own send_jobs" ON public.send_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can update their own send_jobs" ON public.send_jobs;
  CREATE POLICY "Users can update their own send_jobs" ON public.send_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view their own send_receipts" ON public.send_receipts;
  CREATE POLICY "Users can view their own send_receipts" ON public.send_receipts FOR SELECT TO authenticated USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Users can create their own send_receipts" ON public.send_receipts;
  CREATE POLICY "Users can create their own send_receipts" ON public.send_receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
END $$;

-- ═══ FIM ═══
-- Se chegou aqui sem erro, TODAS as tabelas estão criadas! 🎉
