-- 20240408000001_wasender_integration.sql
-- Migration para adicionar a infraestrutura segura para a Integração Wasender

-- 1. Adicionando coluna remote_id à tabela groups
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS remote_id TEXT;

-- 2. Criando Tabela dedicada para Segredos do Canal
CREATE TABLE IF NOT EXISTS public.channel_secrets (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger para updated_at da tabela secrets
CREATE TRIGGER update_channel_secrets_updated_at 
BEFORE UPDATE ON public.channel_secrets 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Habilitando RLS para a tabela de segredos
ALTER TABLE public.channel_secrets ENABLE ROW LEVEL SECURITY;

-- 5. Policies Rígidas para channel_secrets: Válido APENAS para os recursos pertencentes ao usuário.
-- O Service Role sempre passará pelo RLS nas rotas Next.js server-side, mas aqui protegemos de acesso indevido pelo front.
CREATE POLICY "Users can insert their own channel secrets"
ON public.channel_secrets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channel secrets"
ON public.channel_secrets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users cannot select their own secrets directly (only backend server-side access allowed)"
ON public.channel_secrets FOR SELECT
USING (false); -- Apenas Service Role pode ler; cliente web nunca deve recuperar session_api_key.
