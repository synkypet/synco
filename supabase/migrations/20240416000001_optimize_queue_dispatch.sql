-- migration: 20240416000001_optimize_queue_dispatch.sql
-- Objetivo: Otimizar a performance do worker de envio e do heartbeat

-- 1. Índice para busca de jobs pendentes (ordenado por criação)
-- Usado no worker para identificar canais ativos e o próximo job a enviar.
CREATE INDEX IF NOT EXISTS idx_send_jobs_pending_dispatch 
ON public.send_jobs (status, created_at ASC, channel_id) 
WHERE status = 'pending';

-- 2. Índice para controle de pacing
-- Usado para buscar o processed_at do último job enviado por um canal.
CREATE INDEX IF NOT EXISTS idx_send_jobs_channel_pacing 
ON public.send_jobs (channel_id, processed_at DESC) 
WHERE processed_at IS NOT NULL;

-- 3. Índice para monitoramento e stall detection (Heartbeat e Reset)
-- Usado para identificar jobs travados em 'processing'.
CREATE INDEX IF NOT EXISTS idx_send_jobs_processing_status 
ON public.send_jobs (status, updated_at ASC) 
WHERE status = 'processing';
