-- supabase/migrations/20260514193000_managed_templates_schema.sql

-- 1. Standardize message_templates
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS is_editable BOOLEAN DEFAULT true;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS is_deletable BOOLEAN DEFAULT true;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create Unique Index for system templates to allow idempotent UPSERTs
-- Change from partial index to normal index for better ON CONFLICT inference
DROP INDEX IF EXISTS public.message_templates_template_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_template_key_unique 
ON public.message_templates(template_key);

-- Migrate existing data defensively
DO $$
BEGIN
    -- Update is_system from is_system_default if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='is_system_default') THEN
        UPDATE message_templates SET is_system = is_system_default WHERE is_system IS FALSE;
        UPDATE message_templates SET is_editable = NOT is_system_default WHERE is_system_default IS TRUE;
        UPDATE message_templates SET is_deletable = NOT is_system_default WHERE is_system_default IS TRUE;
    END IF;

    -- Update template_type from category if empty
    UPDATE message_templates SET template_type = category WHERE template_type IS NULL;
END $$;

-- 2. Create message_template_user_settings
CREATE TABLE IF NOT EXISTS message_template_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  system_template_enabled BOOLEAN NOT NULL DEFAULT true,
  active_user_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, template_type)
);

-- 3. Security: message_template_user_settings
ALTER TABLE message_template_user_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users manage own template settings" ON message_template_user_settings;
    CREATE POLICY "Users manage own template settings" ON message_template_user_settings
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_template_user_settings TO authenticated;
REVOKE ALL ON TABLE public.message_template_user_settings FROM anon;

-- 4. Security: message_templates (Harden Policies)
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Drop legacy and newly created policies for idempotency
    DROP POLICY IF EXISTS "Users see own and system templates" ON message_templates;
    DROP POLICY IF EXISTS "Users manage own templates" ON message_templates;
    DROP POLICY IF EXISTS "message_templates_select" ON message_templates;
    DROP POLICY IF EXISTS "message_templates_insert" ON message_templates;
    DROP POLICY IF EXISTS "message_templates_update" ON message_templates;
    DROP POLICY IF EXISTS "message_templates_delete" ON message_templates;
    
    -- New Harden Policies (Drop and Recreate)
    -- A) SELECT: System templates OR own templates
    CREATE POLICY "message_templates_select" ON message_templates
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR is_system = true);

    -- B) INSERT: Only own templates, never system
    CREATE POLICY "message_templates_insert" ON message_templates
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND is_system = false);

    -- C) UPDATE: Only own templates, never system
    CREATE POLICY "message_templates_update" ON message_templates
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id AND is_system = false)
      WITH CHECK (auth.uid() = user_id AND is_system = false);

    -- D) DELETE: Only own templates, never system
    CREATE POLICY "message_templates_delete" ON message_templates
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id AND is_system = false);
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_templates TO authenticated;
REVOKE ALL ON TABLE public.message_templates FROM anon;

-- 5. Trigger for updated_at (Shared)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_message_template_user_settings_updated_at') THEN
        CREATE TRIGGER update_message_template_user_settings_updated_at
        BEFORE UPDATE ON message_template_user_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
