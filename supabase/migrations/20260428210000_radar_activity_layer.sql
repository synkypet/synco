-- Migration: Radar Activity Layer
-- Description: Creates observability infrastructure for Radar Pro.
-- Date: 2026-04-28

-- 1. Create the activity log table (Append-Only)
CREATE TABLE IF NOT EXISTS radar_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES automation_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'discovered', 'dispatched', 'skipped_match', 'skipped_score', 'skipped_dedupe', 'skipped_pacing', 'ineligible'
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  keyword TEXT,
  score NUMERIC,
  commission_value NUMERIC,
  discard_reason TEXT,
  metadata JSONB, -- Strict shape: { title: string, page: number, source_id: uuid }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add campaign_id to the operational table for traceability
ALTER TABLE radar_discovered_products 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- 3. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_ral_source_created
  ON radar_activity_log (source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ral_source_event
  ON radar_activity_log (source_id, event_type, created_at DESC);

-- 4. Operational Monitoring Policy
-- Note: If radar_activity_log exceeds 15 million records, generate administrative alert.
-- Strategy: Automatic 30-day retention cleanup.

-- 5. Enable RLS (Security)
ALTER TABLE radar_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs"
  ON radar_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Cron Job for Retention (Reference only, depends on pg_cron availability)
-- SELECT cron.schedule('radar-activity-retention', '0 0 * * *', 
--   'DELETE FROM radar_activity_log WHERE created_at < now() - interval ''30 days''');
