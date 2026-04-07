-- 03_rls_policies.sql
-- Políticas de RLS e Índices de Performance

-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_list_groups ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para Profiles
-- Usuários podem ler qualquer perfil (para busca/colaboração básica), mas só editar o seu próprio
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Políticas para Marketplaces
-- Marketplaces são configurações globais: leitura para todos autenticados, escrita apenas para admin (service_role)
CREATE POLICY "Marketplaces are viewable by authenticated users" ON public.marketplaces FOR SELECT TO authenticated USING (true);

-- 4. Políticas para Channels
CREATE POLICY "Users can view own channels" ON public.channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channels" ON public.channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channels" ON public.channels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own channels" ON public.channels FOR DELETE USING (auth.uid() = user_id);

-- 5. Políticas para Groups
CREATE POLICY "Users can view own groups" ON public.groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON public.groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON public.groups FOR DELETE USING (auth.uid() = user_id);

-- 6. Políticas para Destination Lists
CREATE POLICY "Users can view own lists" ON public.destination_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lists" ON public.destination_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists" ON public.destination_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON public.destination_lists FOR DELETE USING (auth.uid() = user_id);

-- 7. Políticas para Destination List Groups (Junction)
-- Permite acesso se o usuário for dono da lista
CREATE POLICY "Users can manage junction via list owner" ON public.destination_list_groups
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.destination_lists
    WHERE id = destination_list_groups.list_id
    AND user_id = auth.uid()
  )
);

-- 8. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON public.channels(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON public.groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_channel_id ON public.groups(channel_id);
CREATE INDEX IF NOT EXISTS idx_destination_lists_user_id ON public.destination_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_dlg_list_id ON public.destination_list_groups(list_id);
CREATE INDEX IF NOT EXISTS idx_dlg_group_id ON public.destination_list_groups(group_id);
