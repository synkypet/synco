-- Migration: 20260512006000_fix_marketplace_preferences_rls.sql
-- Description: Corrige RLS e GRANTS para marketplaces, user_marketplaces, user_send_preferences e profiles

-- 1. Schema Grants
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. marketplaces
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.marketplaces TO authenticated;

DROP POLICY IF EXISTS "Marketplaces are viewable by authenticated users" ON public.marketplaces;
DROP POLICY IF EXISTS "Authenticated users can view marketplaces" ON public.marketplaces;

CREATE POLICY "Authenticated users can view marketplaces"
ON public.marketplaces FOR SELECT TO authenticated USING (is_active = true);


-- 2. user_marketplaces
ALTER TABLE public.user_marketplaces ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_marketplaces TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own marketplace connections" ON public.user_marketplaces;
DROP POLICY IF EXISTS "Users can view own marketplace connections" ON public.user_marketplaces;
DROP POLICY IF EXISTS "Users can insert own marketplace connections" ON public.user_marketplaces;
DROP POLICY IF EXISTS "Users can update own marketplace connections" ON public.user_marketplaces;
DROP POLICY IF EXISTS "Users can delete own marketplace connections" ON public.user_marketplaces;

CREATE POLICY "Users can view own marketplace connections"
ON public.user_marketplaces FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marketplace connections"
ON public.user_marketplaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace connections"
ON public.user_marketplaces FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketplace connections"
ON public.user_marketplaces FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 3. user_send_preferences
ALTER TABLE public.user_send_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.user_send_preferences TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own send preferences" ON public.user_send_preferences;
DROP POLICY IF EXISTS "Users can insert their own send preferences" ON public.user_send_preferences;
DROP POLICY IF EXISTS "Users can update their own send preferences" ON public.user_send_preferences;

CREATE POLICY "Users can manage their own send preferences"
ON public.user_send_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own send preferences"
ON public.user_send_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own send preferences"
ON public.user_send_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 4. profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- NOTA: O grant default para anon não é alterado, mas por ser authenticated-only nessas policies
-- os unauthenticated não conseguirão acessar dados indevidos nestas tabelas.
