-- Preserve the recipe yield used by immutable ingredient snapshots.
-- Existing snapshots are frozen to the recipe yield present at this migration;
-- all new snapshots capture yield at insert time and no longer depend on later recipe edits.

ALTER TABLE ordering_order_item_cost_snapshots
  ADD COLUMN IF NOT EXISTS recipe_yield NUMERIC(14,4);

ALTER TABLE ordering_modifier_cost_snapshots
  ADD COLUMN IF NOT EXISTS recipe_yield NUMERIC(14,4);

UPDATE ordering_order_item_cost_snapshots s
SET recipe_yield = COALESCE(r.yield_quantity, 1)
FROM recipes r
WHERE s.recipe_id = r.id
  AND s.recipe_yield IS NULL;

UPDATE ordering_modifier_cost_snapshots s
SET recipe_yield = COALESCE(r.yield_quantity, 1)
FROM recipes r
WHERE s.recipe_id = r.id
  AND s.recipe_yield IS NULL;

CREATE OR REPLACE FUNCTION freeze_cost_snapshot_recipe_yield()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.recipe_id IS NOT NULL AND NEW.recipe_yield IS NULL THEN
    SELECT COALESCE(r.yield_quantity, 1)
      INTO NEW.recipe_yield
      FROM recipes r
     WHERE r.id = NEW.recipe_id;
    NEW.recipe_yield := COALESCE(NEW.recipe_yield, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordering_order_item_cost_snapshot_yield_bi
  ON ordering_order_item_cost_snapshots;
CREATE TRIGGER ordering_order_item_cost_snapshot_yield_bi
BEFORE INSERT ON ordering_order_item_cost_snapshots
FOR EACH ROW EXECUTE FUNCTION freeze_cost_snapshot_recipe_yield();

DROP TRIGGER IF EXISTS ordering_modifier_cost_snapshot_yield_bi
  ON ordering_modifier_cost_snapshots;
CREATE TRIGGER ordering_modifier_cost_snapshot_yield_bi
BEFORE INSERT ON ordering_modifier_cost_snapshots
FOR EACH ROW EXECUTE FUNCTION freeze_cost_snapshot_recipe_yield();
