-- supabase/migrations/20260505110000_add_coupon_origin_and_source.sql

-- Adicionar 'coupon_shopee' ao tipo de fonte de automação
-- Nota: Se for um ENUM, precisaríamos de ALTER TYPE. Se for CHECK constraint, DROP e ADD.
-- Assumindo CHECK constraint conforme sugestão do usuário.

ALTER TABLE automation_sources DROP CONSTRAINT IF EXISTS automation_sources_source_type_check;
ALTER TABLE automation_sources ADD CONSTRAINT automation_sources_source_type_check 
  CHECK (source_type IN ('group_monitor', 'radar_offers', 'coupon_shopee'));

-- Adicionar 'coupon' como origem válida para campanhas e jobs
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_origin_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_origin_check 
  CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon'));

ALTER TABLE send_jobs DROP CONSTRAINT IF EXISTS send_jobs_origin_check;
ALTER TABLE send_jobs ADD CONSTRAINT send_jobs_origin_check
  CHECK (origin IN ('radar', 'manual', 'monitor', 'coupon'));
