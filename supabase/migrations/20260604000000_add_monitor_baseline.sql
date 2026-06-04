-- Migration: Add Baseline to sm_metric_monitors
-- Description: Creates baseline fields to start metric counting from zero.

BEGIN;

ALTER TABLE public.sm_metric_monitors
ADD COLUMN IF NOT EXISTS baseline_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS baseline_snapshot_id UUID REFERENCES public.sm_group_snapshots(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS baseline_member_count INTEGER;

-- Backfill: For existing monitors, set baseline_at to created_at
UPDATE public.sm_metric_monitors
SET baseline_at = created_at
WHERE baseline_at IS NULL;

COMMIT;
