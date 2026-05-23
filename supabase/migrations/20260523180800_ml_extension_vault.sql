-- Tabela: ml_sessions
CREATE TABLE ml_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_session   TEXT NOT NULL,
  encryption_iv       TEXT NOT NULL,
  encryption_tag      TEXT NOT NULL,
  session_fingerprint TEXT NOT NULL,
  is_valid            BOOLEAN DEFAULT true NOT NULL,
  synced_at           TIMESTAMPTZ NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE ml_sessions ENABLE ROW LEVEL SECURITY;

-- RLS apenas para acesso via painel (sessão Supabase Auth)
-- Endpoints da extensão usam service role no servidor, não auth.uid()
CREATE POLICY "users can access own session via panel"
  ON ml_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Tabela: extension_tokens
CREATE TABLE extension_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id          TEXT NOT NULL UNIQUE,
  token_secret_hash TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_used_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE extension_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can access own tokens via panel"
  ON extension_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Tabela: ml_pairing_codes
CREATE TABLE ml_pairing_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL UNIQUE,
  used        BOOLEAN DEFAULT false NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE ml_pairing_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can access own pairing codes via panel"
  ON ml_pairing_codes FOR ALL
  USING (auth.uid() = user_id);

-- Tabela: ml_link_generation_log
CREATE TABLE ml_link_generation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('success', 'failed', 'fallback')),
  error_code  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE ml_link_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can access own logs via panel"
  ON ml_link_generation_log FOR ALL
  USING (auth.uid() = user_id);
