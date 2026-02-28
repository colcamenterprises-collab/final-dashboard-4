-- AI Ops Issues + Ideas Registers (additive only)

CREATE TABLE IF NOT EXISTS ai_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','triage','plan_pending','approval_requested','approved','in_progress','needs_review','done','closed','rejected')),
  created_by TEXT NOT NULL,
  owner_agent TEXT NOT NULL DEFAULT 'Bob',
  assignee TEXT,
  plan_md TEXT,
  approval_note TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_issues_status_idx ON ai_issues(status);
CREATE INDEX IF NOT EXISTS ai_issues_severity_idx ON ai_issues(severity);
CREATE INDEX IF NOT EXISTS ai_issues_assignee_idx ON ai_issues(assignee);
CREATE INDEX IF NOT EXISTS ai_issues_created_at_idx ON ai_issues(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES ai_issues(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_issue_comments_issue_id_created_at_idx ON ai_issue_comments(issue_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_issue_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES ai_issues(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED','STATUS_CHANGED','PLAN_UPDATED','APPROVAL_REQUESTED','APPROVED','REJECTED','ASSIGNED','COMMENT_ADDED','COMPLETED','CLOSED')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_issue_activity_issue_id_created_at_idx ON ai_issue_activity(issue_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('ops','finance','marketing','tech','product') OR category IS NULL),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triage','accepted','converted','rejected','archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_ideas_status_idx ON ai_ideas(status);
CREATE INDEX IF NOT EXISTS ai_ideas_category_idx ON ai_ideas(category);
CREATE INDEX IF NOT EXISTS ai_ideas_created_at_idx ON ai_ideas(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_idea_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ai_ideas(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED','STATUS_CHANGED','CONVERTED_TO_ISSUE','CONVERTED_TO_TASK','COMMENT')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_idea_activity_idea_id_created_at_idx ON ai_idea_activity(idea_id, created_at DESC);
