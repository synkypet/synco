-- supabase/migrations/20260512010000_fix_automation_campaigns_rls.sql

-- 1. Garantir Permissões de Esquema
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Garantir Permissões de Tabelas para usuários autenticados
-- Automações
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_logs TO authenticated;

-- Campanhas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_destinations TO authenticated;

-- Jobs e Assinaturas
GRANT SELECT ON public.send_jobs TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

-- Templates (Condicional para evitar erro se uma das tabelas não existir)
DO $$ 
BEGIN 
    IF to_regclass('public.message_templates') IS NOT NULL THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
    END IF;
    IF to_regclass('public.templates') IS NOT NULL THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
    END IF;
END $$;

-- 3. Reforçar RLS e Policies para garantir user_id = auth.uid()

-- Subscriptions (Garantir que o usuário veja o próprio plano para evitar falso 'Operação Bloqueada')
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- automation_sources
ALTER TABLE public.automation_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automation sources" ON public.automation_sources;
CREATE POLICY "Users can manage own automation sources" ON public.automation_sources
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- automation_routes (Depende do owner da source)
ALTER TABLE public.automation_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automation routes" ON public.automation_routes;
CREATE POLICY "Users can manage own automation routes" ON public.automation_routes
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.automation_sources
    WHERE id = automation_routes.source_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.automation_sources
    WHERE id = automation_routes.source_id AND user_id = auth.uid()
  )
);

-- automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own automation logs" ON public.automation_logs;
CREATE POLICY "Users can view own automation logs" ON public.automation_logs
FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own automation logs" ON public.automation_logs;
CREATE POLICY "Users can insert own automation logs" ON public.automation_logs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage own campaigns" ON public.campaigns
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- campaign_items
ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own campaign items" ON public.campaign_items;
CREATE POLICY "Users can manage own campaign items" ON public.campaign_items
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_items.campaign_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_items.campaign_id AND user_id = auth.uid()
  )
);

-- campaign_destinations
ALTER TABLE public.campaign_destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own campaign destinations" ON public.campaign_destinations;
CREATE POLICY "Users can manage own campaign destinations" ON public.campaign_destinations
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_destinations.campaign_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_destinations.campaign_id AND user_id = auth.uid()
  )
);

-- send_jobs
ALTER TABLE public.send_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own send jobs" ON public.send_jobs;
CREATE POLICY "Users can view own send jobs" ON public.send_jobs
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Garantir Sequências
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
