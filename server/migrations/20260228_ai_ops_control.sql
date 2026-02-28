-- AI Ops Control Room
-- Additive-only migration: task queue + audit trail

CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'ad-hoc',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  assigned_to TEXT,
  publish BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'Cameron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_tasks_frequency_check CHECK (frequency IN ('once','daily','weekly','monthly','ad-hoc')),
  CONSTRAINT ai_tasks_priority_check CHECK (priority IN ('low','medium','high','urgent')),
  CONSTRAINT ai_tasks_status_check CHECK (status IN ('draft','not_assigned','assigned','in_progress','blocked','done','cancelled')),
  CONSTRAINT ai_tasks_assigned_to_check CHECK (assigned_to IN ('bob','jussi','sally','supplier','codex') OR assigned_to IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_tasks_task_number_uidx ON ai_tasks(task_number) WHERE task_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_tasks_status_idx ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS ai_tasks_assigned_to_idx ON ai_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS ai_tasks_due_at_idx ON ai_tasks(due_at);
CREATE INDEX IF NOT EXISTS ai_tasks_created_at_idx ON ai_tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'Cameron',
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_task_events_type_check CHECK (event_type IN ('created','status_changed','assigned','note_added','publish_toggled','edited'))
);

CREATE INDEX IF NOT EXISTS ai_task_events_task_id_created_at_idx ON ai_task_events(task_id, created_at DESC);
