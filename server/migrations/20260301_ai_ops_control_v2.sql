-- AI Ops Control V2 (additive)
-- Adds threaded messages, review workflow, activity log, and agent state.

ALTER TABLE ai_tasks
  DROP CONSTRAINT IF EXISTS ai_tasks_status_check;

ALTER TABLE ai_tasks
  ADD CONSTRAINT ai_tasks_status_check
  CHECK (status IN ('draft','not_assigned','assigned','in_progress','blocked','done','cancelled','needs_review','approved','changes_requested','rejected'));

CREATE TABLE IF NOT EXISTS ai_task_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_task_messages_task_id_created_at_idx ON ai_task_messages(task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_task_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  request_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision TEXT CHECK (decision IN ('approved','changes_requested','rejected')),
  decision_note TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_task_reviews_task_id_requested_at_idx ON ai_task_reviews(task_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS ai_task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED','ASSIGNED','STATUS_CHANGED','MESSAGE_ADDED','REVIEW_REQUESTED','REVIEW_DECIDED','UPDATED_FIELDS')),
  actor TEXT NOT NULL,
  note TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_task_activity_task_id_created_at_idx ON ai_task_activity(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_agent_state (
  agent_name TEXT PRIMARY KEY CHECK (agent_name IN ('bob','jussi','sally','supplier','codex')),
  status TEXT NOT NULL CHECK (status IN ('idle','running','waiting','blocked','error','offline')),
  status_message TEXT,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_agent_state (agent_name, status, status_message, last_seen_at)
VALUES
  ('bob', 'idle', 'Awaiting assignments', NOW()),
  ('jussi', 'idle', 'Awaiting assignments', NOW()),
  ('sally', 'idle', 'Awaiting assignments', NOW()),
  ('supplier', 'idle', 'Awaiting assignments', NOW()),
  ('codex', 'idle', 'Awaiting assignments', NOW())
ON CONFLICT (agent_name) DO NOTHING;
