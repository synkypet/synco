-- Migration: Add keyword exhaustion tracking to automation_sources
-- Description: Adds consecutive_empty_cycles counter and discovery_exhausted_at timestamp
--              to support automatic page reset when a keyword is exhausted.
-- Date: 2026-05-06

-- Tracks how many consecutive discovery cycles produced zero new products.
-- Resets to 0 when a productive cycle occurs.
-- When this reaches 3 (EXHAUSTION_THRESHOLD), discovery_page resets to 1.
ALTER TABLE public.automation_sources
ADD COLUMN IF NOT EXISTS consecutive_empty_cycles INTEGER NOT NULL DEFAULT 0;

-- Timestamp of the last time the keyword was considered exhausted and
-- discovery_page was reset to 1. Informational / observability only.
ALTER TABLE public.automation_sources
ADD COLUMN IF NOT EXISTS discovery_exhausted_at TIMESTAMPTZ;

-- Initialize existing rows: if discovery_page > 1 and needs_restock is true,
-- those are likely stuck rows — set consecutive_empty_cycles to 2 so the
-- next empty cycle triggers exhaustion reset immediately.
UPDATE public.automation_sources
SET consecutive_empty_cycles = 2
WHERE discovery_page > 5
  AND needs_restock = true
  AND consecutive_empty_cycles = 0;
