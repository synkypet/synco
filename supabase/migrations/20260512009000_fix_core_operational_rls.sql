-- supabase/migrations/20260512009000_fix_core_operational_rls.sql

-- 1. Garantir Permissões de Esquema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Garantir Permissões de Tabelas para usuários autenticados
-- Tabelas de Catálogo (Apenas Leitura)
GRANT SELECT ON public.marketplaces TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.plans TO authenticated;

-- Tabelas Operacionais (CRUD Próprio)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_list_groups TO authenticated;

-- 3. Tabela shopee_coupon_pages
-- Criar se não existir para evitar 500 no /api/coupon/pages
CREATE TABLE IF NOT EXISTS public.shopee_coupon_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    original_url TEXT,
    short_link TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_refreshed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT ON public.shopee_coupon_pages TO authenticated;

-- 4. Reforçar RLS e Policies para garantir user_id = auth.uid()

-- Channels
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own channels" ON public.channels;
CREATE POLICY "Users can view own channels" ON public.channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own channels" ON public.channels;
CREATE POLICY "Users can insert own channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own channels" ON public.channels;
CREATE POLICY "Users can update own channels" ON public.channels FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own channels" ON public.channels;
CREATE POLICY "Users can delete own channels" ON public.channels FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own groups" ON public.groups;
CREATE POLICY "Users can view own groups" ON public.groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own groups" ON public.groups;
CREATE POLICY "Users can insert own groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own groups" ON public.groups;
CREATE POLICY "Users can update own groups" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own groups" ON public.groups;
CREATE POLICY "Users can delete own groups" ON public.groups FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Destination Lists
ALTER TABLE public.destination_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own lists" ON public.destination_lists;
CREATE POLICY "Users can view own lists" ON public.destination_lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own lists" ON public.destination_lists;
CREATE POLICY "Users can insert own lists" ON public.destination_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own lists" ON public.destination_lists;
CREATE POLICY "Users can update own lists" ON public.destination_lists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own lists" ON public.destination_lists;
CREATE POLICY "Users can delete own lists" ON public.destination_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Destination List Groups (Junction)
-- A segurança desta tabela depende da propriedade da lista
ALTER TABLE public.destination_list_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage junction via list owner" ON public.destination_list_groups;
CREATE POLICY "Users can manage junction via list owner" ON public.destination_list_groups
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.destination_lists
    WHERE id = destination_list_groups.list_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.destination_lists
    WHERE id = destination_list_groups.list_id
    AND user_id = auth.uid()
  )
);

-- Products (Global Catalog - Apenas Leitura)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Produtos são visíveis para todos os usuários autenticados" ON public.products;
CREATE POLICY "Produtos são visíveis para todos os usuários autenticados"
  ON public.products FOR SELECT TO authenticated USING (true);

-- Shopee Coupon Pages (Global Catalog - Apenas Leitura)
ALTER TABLE public.shopee_coupon_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view shopee coupon pages" ON public.shopee_coupon_pages;
CREATE POLICY "Authenticated users can view shopee coupon pages"
ON public.shopee_coupon_pages FOR SELECT TO authenticated USING (true);

-- 5. Garantir Sequências
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
