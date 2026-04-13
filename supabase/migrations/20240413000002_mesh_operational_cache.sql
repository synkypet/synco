-- 20240413000002_mesh_operational_cache.sql
-- Migration: Transform group persistence into operational cache by adding last_seen_at

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
