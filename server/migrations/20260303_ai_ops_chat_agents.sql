-- AI Ops Phase 1 chat + agent profile registry (additive only)

ALTER TABLE IF EXISTS ai_agent_state
  DROP CONSTRAINT IF EXISTS ai_agent_state_status_check;

ALTER TABLE IF EXISTS ai_agent_state
  ADD CONSTRAINT ai_agent_state_status_check
  CHECK (status IN ('online','offline','busy'));

CREATE TABLE IF NOT EXISTS ai_agent_profiles (
  agent_name TEXT PRIMARY KEY CHECK (agent_name IN ('bob','jussi','sally','supplier','codex')),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_chat_threads_last_message_idx
  ON ai_chat_threads(COALESCE(last_message_at, created_at) DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES ai_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL CHECK (token_estimate >= 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_thread_created_idx
  ON ai_chat_messages(thread_id, created_at ASC, id ASC);
