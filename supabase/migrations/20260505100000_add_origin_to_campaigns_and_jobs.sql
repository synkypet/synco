-- supabase/migrations/20260505100000_add_origin_to_campaigns_and_jobs.sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';
ALTER TABLE send_jobs ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';

-- Índices para performance na filtragem por usuário e status
CREATE INDEX IF NOT EXISTS idx_campaigns_user_origin ON campaigns(user_id, origin);
CREATE INDEX IF NOT EXISTS idx_send_jobs_user_status_origin ON send_jobs(user_id, status, origin);
