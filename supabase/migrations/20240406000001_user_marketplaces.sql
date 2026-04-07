-- 20240406000001_user_marketplaces.sql
-- Criação da tabela de conexões de usuários com marketplaces

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

-- Habilitar RLS
ALTER TABLE public.user_marketplaces ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can manage their own marketplace connections"
    ON public.user_marketplaces
    FOR ALL
    USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_marketplaces_updated_at 
    BEFORE UPDATE ON public.user_marketplaces 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS user_marketplaces_user_id_idx ON public.user_marketplaces (user_id);
CREATE INDEX IF NOT EXISTS user_marketplaces_marketplace_id_idx ON public.user_marketplaces (marketplace_id);

-- Comentários para documentação
COMMENT ON TABLE public.user_marketplaces IS 'Armazena as configurações e o estado de ativação de marketplaces por usuário.';
