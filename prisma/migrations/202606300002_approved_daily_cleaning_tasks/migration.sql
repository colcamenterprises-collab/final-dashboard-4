-- Daily Cleaning approved 5-task checklist update.
-- Upstream sources: owner-approved Daily Cleaning inspection task list in Codex task 2026-06-30.
-- Rebuild command: apply this migration; task definitions are idempotently upserted by task_id.
-- Determinism: active Daily Cleaning tasks are exactly the five task_id values listed below after each run.

INSERT INTO daily_cleaning_task_definitions (id, task_id, task_name, standard, module_type, task_type, frequency, photo_required, active, sort_order)
VALUES
  ('clean_daily_floors_under_benches', 'floors-under-benches', 'Floors & Under Benches', '["Floors are mopped, under benches are clean, and no food scraps or rubbish remain."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 10),
  ('clean_daily_grill_extraction_system', 'grill-extraction-system', 'Grill & Extraction System', '["Grill, splashback, extraction hood and extraction filters/fans are clean and free from grease."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 20),
  ('clean_daily_benches_food_prep_areas', 'benches-food-prep-areas', 'Benches & Food Prep Areas', '["All benches, food preparation areas and equipment are cleaned and sanitised."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 30),
  ('clean_daily_outside_wash_area', 'outside-wash-area', 'Outside & Wash Area', '["Outside area is clean, rubbish removed, and sink/wash area is clean and tidy."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 40),
  ('clean_daily_kitchen_ready_tomorrow', 'kitchen-ready-for-tomorrow', 'Kitchen Ready for Tomorrow', '["Kitchen is clean, organised and ready for the next shift."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 50)
ON CONFLICT (task_id) DO UPDATE SET
  task_name = EXCLUDED.task_name,
  standard = EXCLUDED.standard,
  module_type = EXCLUDED.module_type,
  task_type = EXCLUDED.task_type,
  frequency = EXCLUDED.frequency,
  photo_required = TRUE,
  active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

UPDATE daily_cleaning_task_definitions
SET active = FALSE,
    updated_at = NOW()
WHERE module_type = 'daily_cleaning'
  AND task_id NOT IN (
    'floors-under-benches',
    'grill-extraction-system',
    'benches-food-prep-areas',
    'outside-wash-area',
    'kitchen-ready-for-tomorrow'
  );
