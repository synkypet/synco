-- Adiciona coluna de metadata para log de auditoria e telemetria operacional
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.campaigns.metadata IS 'Armazena logs de auditoria de confirmação e metadados operacionais da campanha.';
