-- 20240409000001_send_engine_and_secrets.sql
-- Migration: Motor de Envios (send_jobs + send_receipts) e webhook_secret em channel_secrets

-- ─── 1. Adicionar webhook_secret à tabela de segredos ──────────────────────
ALTER TABLE public.channel_secrets
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- ─── 2. Tabela de Jobs de Envio (Fila baseada em Postgres) ─────────────────
CREATE TABLE IF NOT EXISTS public.send_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    destination TEXT NOT NULL,         -- remote_id do grupo ou número direto
    destination_name TEXT,             -- nome do grupo/contato (para logs)
    message_body TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',  -- 'text', 'image', 'link_preview'
    status TEXT DEFAULT 'pending',     -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    try_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ,          -- para envios agendados
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Tabela de Recibos de Envio (Idempotência) ─────────────────────────
-- Garante que o mesmo item de campanha não seja enviado duas vezes ao mesmo destino.
CREATE TABLE IF NOT EXISTS public.send_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_job_id UUID NOT NULL REFERENCES public.send_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    campaign_item_id UUID REFERENCES public.campaign_items(id) ON DELETE SET NULL,
    destination TEXT NOT NULL,
    status TEXT DEFAULT 'delivered',   -- 'delivered', 'failed', 'rejected'
    wasender_message_id TEXT,          -- ID retornado pela API Wasender
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Índices de Performance ─────────────────────────────────────────────
-- Fila: buscar jobs pendentes por sessão rapidamente
CREATE INDEX IF NOT EXISTS idx_send_jobs_status_session
ON public.send_jobs(status, session_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_send_jobs_user_id
ON public.send_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_send_jobs_campaign_id
ON public.send_jobs(campaign_id);

-- Idempotência: checar se já existe recibo para campanha + item + destino
CREATE UNIQUE INDEX IF NOT EXISTS idx_send_receipts_idempotency
ON public.send_receipts(campaign_id, campaign_item_id, destination)
WHERE campaign_id IS NOT NULL AND campaign_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_send_receipts_job
ON public.send_receipts(send_job_id);

-- ─── 5. Triggers de updated_at ─────────────────────────────────────────────
CREATE TRIGGER update_send_jobs_updated_at
BEFORE UPDATE ON public.send_jobs
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ─── 6. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.send_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_receipts ENABLE ROW LEVEL SECURITY;

-- send_jobs: usuários só veem/criam os seus
CREATE POLICY "Users can view their own send_jobs"
ON public.send_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own send_jobs"
ON public.send_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own send_jobs"
ON public.send_jobs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- send_receipts: somente leitura para o dono
CREATE POLICY "Users can view their own send_receipts"
ON public.send_receipts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own send_receipts"
ON public.send_receipts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
