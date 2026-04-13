-- Additive foundation for agent read-layer tenancy and token auth.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS agent_tokens (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL DEFAULT 1,
  agent_name    TEXT NOT NULL DEFAULT 'bob',
  token_type    TEXT NOT NULL DEFAULT 'agent_read',
  token_hash    TEXT NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT,
  revoked_at    TIMESTAMPTZ,
  revoked_by    TEXT,
  last_used_at  TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_tokens_tenant_active_idx
  ON agent_tokens(tenant_id, is_active, revoked_at);

CREATE INDEX IF NOT EXISTS agent_tokens_last_used_idx
  ON agent_tokens(last_used_at DESC);

ALTER TABLE bob_read_logs
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE bob_read_logs
  ADD COLUMN IF NOT EXISTS auth_type TEXT;

ALTER TABLE bob_read_logs
  ADD COLUMN IF NOT EXISTS auth_subject TEXT;
