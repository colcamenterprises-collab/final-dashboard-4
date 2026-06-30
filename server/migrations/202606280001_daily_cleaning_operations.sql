-- Daily Cleaning & Operations records are additive operational verification data.
-- Upstream sources: manager-submitted cleaning task photos and statuses.
-- Rebuild command: not applicable; records are source evidence captured at shift close.
-- Determinism: task definitions are idempotently seeded by task_id; record upserts are keyed by sales_id + task_id.

CREATE TABLE IF NOT EXISTS daily_cleaning_task_definitions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  task_name TEXT NOT NULL,
  standard JSONB NOT NULL DEFAULT '[]'::jsonb,
  module_type TEXT NOT NULL DEFAULT 'daily_cleaning',
  task_type TEXT NOT NULL DEFAULT 'cleaning',
  frequency TEXT NOT NULL DEFAULT 'daily',
  photo_required BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_cleaning_records (
  cleaning_record_id TEXT PRIMARY KEY,
  sales_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  store TEXT NOT NULL,
  manager TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  comments TEXT,
  follow_up_action TEXT,
  assigned_to TEXT,
  follow_up_status TEXT,
  cleaning_score INTEGER NOT NULL DEFAULT 0,
  module_type TEXT NOT NULL DEFAULT 'daily_cleaning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_cleaning_records_status_check CHECK (status IN ('Pass', 'Requires Attention')),
  CONSTRAINT daily_cleaning_records_attention_comments_check CHECK (status <> 'Requires Attention' OR NULLIF(BTRIM(COALESCE(comments, '')), '') IS NOT NULL),
  CONSTRAINT daily_cleaning_records_attention_follow_up_check CHECK (status <> 'Requires Attention' OR NULLIF(BTRIM(COALESCE(follow_up_action, '')), '') IS NOT NULL),
  CONSTRAINT daily_cleaning_records_attention_assigned_check CHECK (status <> 'Requires Attention' OR NULLIF(BTRIM(COALESCE(assigned_to, '')), '') IS NOT NULL),
  CONSTRAINT daily_cleaning_records_follow_status_check CHECK (follow_up_status IS NULL OR follow_up_status IN ('Open', 'Closed')),
  CONSTRAINT daily_cleaning_records_score_check CHECK (cleaning_score >= 0 AND cleaning_score <= 100),
  CONSTRAINT daily_cleaning_records_sales_task_unique UNIQUE (sales_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_cleaning_records_shift_date ON daily_cleaning_records (shift_date);
CREATE INDEX IF NOT EXISTS idx_daily_cleaning_records_sales_id ON daily_cleaning_records (sales_id);

INSERT INTO daily_cleaning_task_definitions (id, task_id, task_name, standard, module_type, task_type, frequency, sort_order)
VALUES
  ('clean_daily_grill', 'clean-grill', 'Clean grill', '["Grill surface cleaned","Grease removed","Area left safe for next shift"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 10),
  ('clean_daily_fryer', 'clean-fryer', 'Clean fryer', '["Fryer exterior cleaned","Basket area cleaned","Oil or grease spills removed"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 20),
  ('clean_daily_prep_benches', 'clean-prep-benches', 'Clean prep benches', '["Benches cleared","Food contact surfaces sanitised","No food residue remains"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 30),
  ('clean_daily_grease_traps', 'empty-grease-traps', 'Empty grease traps', '["Grease trap checked","Waste disposed safely","Area wiped down"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 40),
  ('clean_daily_sinks', 'clean-sinks', 'Clean sinks', '["Sink basins cleaned","Taps and splashbacks wiped","No food debris remains"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 50),
  ('clean_daily_kitchen_floor', 'mop-kitchen-floor', 'Mop kitchen floor', '["Floor swept","Floor mopped","No grease or standing water remains"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 60),
  ('clean_daily_dining_area', 'clean-dining-area', 'Clean dining area', '["Tables cleaned","Customer floor cleaned","Front counter wiped"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 70),
  ('clean_daily_rubbish_bins', 'empty-rubbish-bins', 'Empty rubbish bins', '["Bins emptied","Bin liners replaced","Bin area left clean"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 80),
  ('clean_daily_bathrooms', 'clean-bathrooms', 'Clean bathrooms', '["Toilets and sinks cleaned","Supplies checked","Floor cleaned"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 90),
  ('clean_daily_secure_premises', 'lock-secure-premises', 'Lock and secure premises', '["Equipment switched off as required","Doors locked","Premises secured"]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', 100)
ON CONFLICT (task_id) DO UPDATE SET
  task_name = EXCLUDED.task_name,
  standard = EXCLUDED.standard,
  module_type = EXCLUDED.module_type,
  task_type = EXCLUDED.task_type,
  frequency = EXCLUDED.frequency,
  active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();


UPDATE daily_cleaning_task_definitions
SET active = FALSE,
    updated_at = NOW()
WHERE active = TRUE
  AND task_id NOT IN (
    'clean-grill',
    'clean-fryer',
    'clean-prep-benches',
    'empty-grease-traps',
    'clean-sinks',
    'mop-kitchen-floor',
    'clean-dining-area',
    'empty-rubbish-bins',
    'clean-bathrooms',
    'lock-secure-premises'
  );
