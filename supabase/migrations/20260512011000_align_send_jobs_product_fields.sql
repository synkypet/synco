-- Migration: 20260512011000_align_send_jobs_product_fields.sql
-- Description: Adiciona colunas faltantes em send_jobs e torna source_id opcional em automation_logs para logs de sistema.

-- 1. Alinhar send_jobs com payload real
ALTER TABLE public.send_jobs 
ADD COLUMN IF NOT EXISTS installments JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Corrigir automation_logs para permitir logs sem source_id (ex: source_not_found)
ALTER TABLE public.automation_logs 
ALTER COLUMN source_id DROP NOT NULL;

-- 3. Notificar recarregamento do schema para PostgREST
NOTIFY pgrst, 'reload schema';
