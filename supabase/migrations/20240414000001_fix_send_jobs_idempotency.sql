-- migration: fix_send_jobs_idempotency
-- Descrição: Cria índice único para ON CONFLICT no upsert de send_jobs na tabela campaign-service

-- Remove índice se existir com nome antigo
DROP INDEX IF EXISTS public.idx_send_jobs_idempotency;

-- Cria o índice único incondicional necessário para o ON CONFLICT funcionar
CREATE UNIQUE INDEX IF NOT EXISTS uq_send_jobs_campaign_item_destination
ON public.send_jobs (campaign_id, campaign_item_id, destination);
