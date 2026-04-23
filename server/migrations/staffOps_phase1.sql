-- Phase 1: Staff Operations Architecture Migration
-- Safe: additive only. No existing tables are modified.

-- Enums (safe with IF NOT EXISTS via DO block)
DO $$ BEGIN
  CREATE TYPE staff_roster_status AS ENUM ('draft','published','active','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_attendance_status AS ENUM ('expected','present','late','absent','sick','left_early','replaced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_break_type AS ENUM ('main','short','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cleaning_task_type AS ENUM ('daily','weekly','monthly','deep','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cleaning_task_frequency AS ENUM ('daily','weekly','fortnightly','monthly','quarterly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_cleaning_task_status AS ENUM ('pending','in_progress','completed','skipped','reassigned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deep_cleaning_status AS ENUM ('pending','in_progress','completed','overdue','rolled_over');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_change_type AS ENUM ('create','update','delete','reassign','replace','override','attendance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. operations_settings
CREATE TABLE IF NOT EXISTS operations_settings (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  default_max_staff_per_shift INTEGER NOT NULL DEFAULT 5,
  break_main_minutes INTEGER NOT NULL DEFAULT 45,
  break_short_minutes INTEGER NOT NULL DEFAULT 15,
  break_short_count INTEGER NOT NULL DEFAULT 2,
  allow_prep_shift BOOLEAN NOT NULL DEFAULT TRUE,
  default_shift_mode TEXT NOT NULL DEFAULT 'standard',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_settings_location_unique UNIQUE (business_location_id)
);
CREATE INDEX IF NOT EXISTS ops_settings_location_idx ON operations_settings (business_location_id);

-- 2. operating_hours
CREATE TABLE IF NOT EXISTS operating_hours (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TEXT,
  close_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT op_hours_location_day_unique UNIQUE (business_location_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS op_hours_location_idx ON operating_hours (business_location_id);

-- 3. work_areas
CREATE TABLE IF NOT EXISTS work_areas (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS work_areas_location_idx ON work_areas (business_location_id);

-- 4. shift_templates
CREATE TABLE IF NOT EXISTS shift_templates (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  template_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_prep_shift BOOLEAN NOT NULL DEFAULT FALSE,
  max_staff INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_templates_location_idx ON shift_templates (business_location_id);

-- 5. staff_members
CREATE TABLE IF NOT EXISTS staff_members (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  full_name TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  primary_role TEXT NOT NULL DEFAULT 'staff',
  secondary_roles JSONB DEFAULT '[]',
  can_cashier BOOLEAN NOT NULL DEFAULT FALSE,
  can_burgers BOOLEAN NOT NULL DEFAULT FALSE,
  can_side_orders BOOLEAN NOT NULL DEFAULT FALSE,
  can_prep BOOLEAN NOT NULL DEFAULT FALSE,
  can_cleaning BOOLEAN NOT NULL DEFAULT TRUE,
  custom_capabilities JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_members_location_idx ON staff_members (business_location_id);

-- 6. staff_availability
CREATE TABLE IF NOT EXISTS staff_availability (
  id SERIAL PRIMARY KEY,
  staff_member_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  default_start_time TEXT,
  default_end_time TEXT,
  can_prep_start BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_avail_member_day_unique UNIQUE (staff_member_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS staff_avail_member_idx ON staff_availability (staff_member_id);

-- 7. shift_rosters
CREATE TABLE IF NOT EXISTS shift_rosters (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  shift_date DATE NOT NULL,
  shift_name TEXT NOT NULL,
  template_id INTEGER,
  shift_start_time TEXT NOT NULL,
  shift_end_time TEXT NOT NULL,
  max_staff INTEGER NOT NULL DEFAULT 5,
  is_custom_shift BOOLEAN NOT NULL DEFAULT FALSE,
  status staff_roster_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_rosters_location_idx ON shift_rosters (business_location_id);
CREATE INDEX IF NOT EXISTS shift_rosters_date_idx ON shift_rosters (shift_date);

-- 8. shift_staff_assignments
CREATE TABLE IF NOT EXISTS shift_staff_assignments (
  id SERIAL PRIMARY KEY,
  shift_roster_id INTEGER NOT NULL,
  staff_member_id INTEGER NOT NULL,
  is_prep_starter BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_start_time TEXT NOT NULL,
  scheduled_end_time TEXT NOT NULL,
  primary_station TEXT,
  secondary_station TEXT,
  flex_station TEXT,
  is_off_day BOOLEAN NOT NULL DEFAULT FALSE,
  shift_notes TEXT,
  original_assignment_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_assign_roster_idx ON shift_staff_assignments (shift_roster_id);
CREATE INDEX IF NOT EXISTS shift_assign_staff_idx ON shift_staff_assignments (staff_member_id);

-- 9. shift_breaks
CREATE TABLE IF NOT EXISTS shift_breaks (
  id SERIAL PRIMARY KEY,
  shift_staff_assignment_id INTEGER NOT NULL,
  break_type staff_break_type NOT NULL DEFAULT 'main',
  planned_start_time TEXT NOT NULL,
  planned_end_time TEXT NOT NULL,
  actual_start_time TEXT,
  actual_end_time TEXT,
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_breaks_assignment_idx ON shift_breaks (shift_staff_assignment_id);

-- 10. cleaning_task_templates
CREATE TABLE IF NOT EXISTS cleaning_task_templates (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  task_name TEXT NOT NULL,
  area_name TEXT NOT NULL,
  task_type cleaning_task_type NOT NULL DEFAULT 'daily',
  default_frequency cleaning_task_frequency,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cleaning_tmpl_location_idx ON cleaning_task_templates (business_location_id);

-- 11. shift_cleaning_tasks
CREATE TABLE IF NOT EXISTS shift_cleaning_tasks (
  id SERIAL PRIMARY KEY,
  shift_roster_id INTEGER NOT NULL,
  cleaning_task_template_id INTEGER NOT NULL,
  assigned_staff_id INTEGER,
  status shift_cleaning_task_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  notes TEXT,
  manager_override BOOLEAN NOT NULL DEFAULT FALSE,
  reassigned_from_staff_id INTEGER,
  reassigned_to_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_clean_roster_idx ON shift_cleaning_tasks (shift_roster_id);

-- 12. deep_cleaning_tasks
CREATE TABLE IF NOT EXISTS deep_cleaning_tasks (
  id SERIAL PRIMARY KEY,
  business_location_id INTEGER NOT NULL DEFAULT 1,
  task_name TEXT NOT NULL,
  area_name TEXT NOT NULL,
  frequency cleaning_task_frequency NOT NULL DEFAULT 'monthly',
  due_date DATE NOT NULL,
  assigned_staff_id INTEGER,
  status deep_cleaning_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  notes TEXT,
  rollover_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deep_clean_location_idx ON deep_cleaning_tasks (business_location_id);
CREATE INDEX IF NOT EXISTS deep_clean_due_date_idx ON deep_cleaning_tasks (due_date);

-- 13. shift_attendance_logs
CREATE TABLE IF NOT EXISTS shift_attendance_logs (
  id SERIAL PRIMARY KEY,
  shift_roster_id INTEGER NOT NULL,
  shift_staff_assignment_id INTEGER NOT NULL,
  staff_member_id INTEGER NOT NULL,
  attendance_status staff_attendance_status NOT NULL DEFAULT 'expected',
  replacement_staff_id INTEGER,
  lateness_minutes INTEGER,
  clock_in_time TEXT,
  clock_out_time TEXT,
  absence_reason TEXT,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attendance_roster_idx ON shift_attendance_logs (shift_roster_id);
CREATE INDEX IF NOT EXISTS attendance_staff_idx ON shift_attendance_logs (staff_member_id);

-- 14. shift_change_log
CREATE TABLE IF NOT EXISTS shift_change_log (
  id SERIAL PRIMARY KEY,
  shift_roster_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  change_type shift_change_type NOT NULL,
  before_json JSONB,
  after_json JSONB,
  changed_by TEXT NOT NULL DEFAULT 'system',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS shift_changelog_roster_idx ON shift_change_log (shift_roster_id);
CREATE INDEX IF NOT EXISTS shift_changelog_at_idx ON shift_change_log (changed_at);
