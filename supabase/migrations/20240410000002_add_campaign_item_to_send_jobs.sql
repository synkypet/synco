-- Adiciona campaign_item_id e imagem na tabela send_jobs para idempotência granular
ALTER TABLE public.send_jobs
ADD COLUMN IF NOT EXISTS campaign_item_id UUID REFERENCES public.campaign_items(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Índice para acelerar a busca de idempotência antes da inserção
CREATE UNIQUE INDEX IF NOT EXISTS idx_send_jobs_idempotency
ON public.send_jobs(campaign_id, campaign_item_id, destination)
WHERE campaign_id IS NOT NULL AND campaign_item_id IS NOT NULL;
