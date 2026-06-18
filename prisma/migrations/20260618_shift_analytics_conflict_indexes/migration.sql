-- Runtime fix: align shift analytics ON CONFLICT targets with actual unique indexes.
-- These are additive indexes on derived analytics cache tables only.
-- They make computeShiftAll idempotent under the existing
-- ON CONFLICT (shift_date, COALESCE(sku, name)) statements.

CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_shift_item_shift_sku_or_name
  ON analytics_shift_item (shift_date, COALESCE(sku, name));

CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_shift_modifier_shift_sku_or_name
  ON analytics_shift_modifier (shift_date, COALESCE(sku, name));
