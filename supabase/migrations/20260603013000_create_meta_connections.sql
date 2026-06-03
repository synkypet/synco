-- 1. sm_meta_connections: Metadados seguros da conta (Público para o dono)
CREATE TABLE public.sm_meta_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ad_account_id text NOT NULL,
    ad_account_name text,
    account_status text,
    currency text,
    timezone_name text,
    pixel_id text,
    pixel_name text,
    pixel_status text,
    connection_status text DEFAULT 'connected',
    last_tested_at timestamptz,
    last_error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, ad_account_id)
);

-- 2. sm_meta_secrets: Armazenamento do token (Isolado e Sigiloso)
CREATE TABLE public.sm_meta_secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.sm_meta_connections(id) ON DELETE CASCADE,
    access_token text NOT NULL,
    token_type text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(connection_id)
);

-- RLS
ALTER TABLE public.sm_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_meta_secrets ENABLE ROW LEVEL SECURITY;

-- Policies for sm_meta_connections
CREATE POLICY "Users can manage their own meta connections" 
ON public.sm_meta_connections 
FOR ALL USING (auth.uid() = user_id);

-- Policies for sm_meta_secrets
-- Note: NO policy is created for authenticated users. They are completely blocked from this table via RLS.

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_meta_connections TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_meta_secrets TO service_role;
-- We do not grant anything to authenticated for sm_meta_secrets.

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_sm_meta_connections
BEFORE UPDATE ON public.sm_meta_connections
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sm_meta_secrets
BEFORE UPDATE ON public.sm_meta_secrets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
