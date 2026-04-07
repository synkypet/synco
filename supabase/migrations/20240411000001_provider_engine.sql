-- ══════════════════════════════════════════════════════════════════════════════
-- Provider Engine — Migration
-- Adiciona classificação de erros e suporte a fallback multi-canal em send_jobs.
-- ══════════════════════════════════════════════════════════════════════════════

-- Classificação de erro (TEMPORARY | PERMANENT)
ALTER TABLE public.send_jobs ADD COLUMN IF NOT EXISTS error_type TEXT;

-- Canal de fallback (para tentar envio por outro canal se o primário falhar)
ALTER TABLE public.send_jobs ADD COLUMN IF NOT EXISTS fallback_channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;

-- Índice para rate-limit por destino (busca rápida do último envio por destination)
CREATE INDEX IF NOT EXISTS idx_send_jobs_destination_processed
  ON public.send_jobs(destination, processed_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM — Colunas são NULL por padrão, sem impacto em dados existentes.
-- ══════════════════════════════════════════════════════════════════════════════
