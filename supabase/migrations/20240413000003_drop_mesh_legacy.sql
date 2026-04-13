-- 20240413000003_drop_mesh_legacy.sql
-- Migration: Drop legacy mesh persistence tables as part of the High-Scale Operational Persistence redesign.

-- Drop group_participants which was heavily slowing down large meshes and chewing up DB sizing
DROP TABLE IF EXISTS public.group_participants CASCADE;

-- We can also optionally drop contacts if they are ONLY used for group_participants.
-- However, given SYNCO might use contacts for destination lists directly later, we will 
-- only drop group_participants for now to surgically handle the deep mesh persistence issue.
-- The user explicitly asked to stop persisting the "malha profunda" (group participants).
