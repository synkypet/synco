-- Migration: 20260511191500_user_send_preferences.sql
-- Description: Create global user send preferences table for send window management.

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.user_send_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    send_window_start TEXT,
    send_window_end TEXT,
    send_window_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Validation Checks
    CONSTRAINT check_send_window_start_format CHECK (
        send_window_start IS NULL OR send_window_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT check_send_window_end_format CHECK (
        send_window_end IS NULL OR send_window_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT check_send_window_both_or_none CHECK (
        (send_window_start IS NULL AND send_window_end IS NULL)
        OR
        (send_window_start IS NOT NULL AND send_window_end IS NOT NULL)
    )
);

-- 2. Enable RLS
ALTER TABLE public.user_send_preferences ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage own send preferences" ON public.user_send_preferences;
    CREATE POLICY "Users can manage own send preferences"
        ON public.user_send_preferences FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 4. Trigger updated_at
DROP TRIGGER IF EXISTS update_user_send_preferences_updated_at ON public.user_send_preferences;
CREATE TRIGGER update_user_send_preferences_updated_at
    BEFORE UPDATE ON public.user_send_preferences
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- 5. Comments
COMMENT ON TABLE public.user_send_preferences IS 'Global preferences for sending jobs, including time windows.';
COMMENT ON COLUMN public.user_send_preferences.send_window_start IS 'Start of the allowed send window (HH:mm).';
COMMENT ON COLUMN public.user_send_preferences.send_window_end IS 'End of the allowed send window (HH:mm).';
