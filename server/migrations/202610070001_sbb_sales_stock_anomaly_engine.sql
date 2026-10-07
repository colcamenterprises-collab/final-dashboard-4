-- SBB sales, physical stock and anomaly engine.
-- Additive only. Financial/order facts are not rewritten.

CREATE TABLE IF NOT EXISTS sbb_inventory_item_config (
  ingredient_key text PRIMARY KEY,
  ingredient_name text NOT NULL,
  unit text NOT NULL,
  group_name text NOT NULL DEFAULT 'Other',
  tolerance_quantity numeric(14,4) NOT NULL DEFAULT 0,
  material_tolerance_quantity numeric(14,4),
  active boolean NOT NULL DEFAULT true,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tolerance_quantity >= 0),
  CHECK (material_tolerance_quantity IS NULL OR material_tolerance_quantity >= tolerance_quantity)
);

CREATE TABLE IF NOT EXISTS sbb_inventory_physical_count (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL,
  shift_key text NOT NULL DEFAULT '',
  ingredient_key text NOT NULL,
  ingredient_name text NOT NULL,
  quantity numeric(14,4) NOT NULL,
  unit text NOT NULL,
  counted_by integer NOT NULL,
  counted_by_name text NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_date, shift_key, ingredient_key)
);

CREATE TABLE IF NOT EXISTS sbb_inventory_physical_count_audit (
  id bigserial PRIMARY KEY,
  physical_count_id uuid NOT NULL REFERENCES sbb_inventory_physical_count(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  shift_key text NOT NULL DEFAULT '',
  ingredient_key text NOT NULL,
  ingredient_name text NOT NULL,
  unit text NOT NULL,
  previous_quantity numeric(14,4),
  new_quantity numeric(14,4) NOT NULL,
  changed_by integer NOT NULL,
  changed_by_name text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sbb_physical_count_date_idx
  ON sbb_inventory_physical_count (business_date, shift_key);
CREATE INDEX IF NOT EXISTS sbb_physical_count_audit_lookup_idx
  ON sbb_inventory_physical_count_audit (business_date, shift_key, ingredient_key, changed_at DESC);

CREATE TABLE IF NOT EXISTS sbb_inventory_movement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL,
  shift_key text NOT NULL DEFAULT '',
  ingredient_key text NOT NULL,
  ingredient_name text NOT NULL,
  quantity numeric(14,4) NOT NULL,
  unit text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('STOCK_IN','TRANSFER_IN','TRANSFER_OUT','WASTE','ADJUSTMENT')),
  source_type text NOT NULL DEFAULT 'manual',
  source_id text,
  note text,
  recorded_by integer,
  recorded_by_name text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sbb_inventory_movement_date_idx
  ON sbb_inventory_movement (business_date, shift_key, ingredient_key);

COMMENT ON TABLE sbb_inventory_physical_count IS
'Independent owner/manager physical counts. Staff forms are deliberately not authoritative here.';
COMMENT ON TABLE sbb_inventory_physical_count_audit IS
'Append-only before/after evidence for every physical count save.';
COMMENT ON TABLE sbb_inventory_movement IS
'Auditable SBB ingredient movements used by expected-closing reconciliation.';
