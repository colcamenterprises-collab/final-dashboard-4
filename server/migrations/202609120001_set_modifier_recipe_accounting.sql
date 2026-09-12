-- Set + modifier recipe accounting layer.
-- Additive only: no order/menu rows are rewritten and no live selling behaviour changes.
--
-- Existing POS set sales already record the burger/set parent plus zero-revenue child rows
-- (`is_set_component=true`, `parent_order_item_id=<parent>`). Accounting must consume BOTH.
-- Modifier recipes use a signed usage multiplier so additions and removals affect theoretical
-- ingredient usage without mutating the base recipe.

ALTER TABLE pos_modifier_costing_config
  ADD COLUMN IF NOT EXISTS usage_multiplier NUMERIC(14,4) NOT NULL DEFAULT 1;

COMMENT ON COLUMN pos_modifier_costing_config.usage_multiplier IS
'Signed recipe consumption effect. Use 1 for additions and -1 for removals (for example No Cheese).';

ALTER TABLE ordering_modifier_cost_snapshots
  ADD COLUMN IF NOT EXISTS usage_multiplier NUMERIC(14,4) NOT NULL DEFAULT 1;

COMMENT ON COLUMN ordering_modifier_cost_snapshots.usage_multiplier IS
'Immutable sale-time signed modifier recipe multiplier copied from pos_modifier_costing_config.';

-- Freeze the modifier usage direction at sale time. This keeps historical usage stable if a
-- modifier is reconfigured later. A zero value is treated as the safe default (+1) by reporting;
-- configuration UIs should expose only +1 (addition) and -1 (removal).
CREATE OR REPLACE FUNCTION freeze_modifier_usage_multiplier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_multiplier NUMERIC(14,4);
BEGIN
  IF NEW.item_modifier_id IS NOT NULL THEN
    SELECT c.usage_multiplier
      INTO v_multiplier
      FROM pos_modifier_costing_config c
     WHERE c.item_modifier_id = NEW.item_modifier_id;
    NEW.usage_multiplier := COALESCE(NULLIF(v_multiplier, 0), NULLIF(NEW.usage_multiplier, 0), 1);
  ELSE
    NEW.usage_multiplier := COALESCE(NULLIF(NEW.usage_multiplier, 0), 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordering_modifier_cost_snapshot_usage_bi
  ON ordering_modifier_cost_snapshots;
CREATE TRIGGER ordering_modifier_cost_snapshot_usage_bi
BEFORE INSERT ON ordering_modifier_cost_snapshots
FOR EACH ROW EXECUTE FUNCTION freeze_modifier_usage_multiplier();

-- Expose the actual recorded set structure as an accounting/read-model layer. Revenue remains
-- on the parent order line; component rows carry zero revenue but independently carry recipe cost
-- and ingredient usage. This is intentionally a view over immutable order facts, not duplicated
-- menu/recipe data.
CREATE OR REPLACE VIEW reporting_set_component_lines AS
SELECT
  child.order_id,
  child.parent_order_item_id AS set_parent_order_item_id,
  parent.menu_item_id AS set_menu_item_id,
  parent.item_name_en AS set_name,
  parent.quantity AS set_quantity,
  child.id AS component_order_item_id,
  child.menu_item_id AS component_menu_item_id,
  child.item_name_en AS component_name,
  child.quantity AS component_quantity,
  child.source_sku AS component_sku,
  child.line_total AS component_revenue,
  child.created_at
FROM ordering_order_items child
JOIN ordering_order_items parent ON parent.id = child.parent_order_item_id
WHERE COALESCE(child.is_set_component, FALSE) = TRUE;

COMMENT ON VIEW reporting_set_component_lines IS
'Canonical recorded set expansion for accounting/reporting. Parent carries sale revenue; each child is an independently costed/consumed set component such as fries or the selected drink.';
