ALTER TABLE automation_dedupe
ADD COLUMN IF NOT EXISTS source_id UUID;
