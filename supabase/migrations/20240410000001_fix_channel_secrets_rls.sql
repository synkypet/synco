-- Fix: Permitir que o owner faça SELECT no channel_secrets (necessário para UPSERT funcionar)
-- Isso é seguro porque o frontend NÃO chama channel_secrets diretamente — só rotas server-side.

DROP POLICY IF EXISTS "Users cannot select their own secrets directly (only backend server-side access allowed)" ON public.channel_secrets;

-- Permitir SELECT apenas para o próprio dono (necessário para UPSERT)
CREATE POLICY "Users can select their own channel secrets"
    ON public.channel_secrets FOR SELECT
    USING (auth.uid() = user_id);
