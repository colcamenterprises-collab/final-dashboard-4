-- Fix sale-time costing so the canonical menu -> recipe link used by Back Office
-- is also used by the immutable POS cost snapshot trigger.
--
-- Existing snapshots are deliberately NOT rewritten. This changes only future
-- snapshot capture and preserves historical accounting immutability.

CREATE OR REPLACE FUNCTION capture_order_item_cost_snapshot(p_order_item_id UUID, p_origin TEXT DEFAULT 'sale_time')
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_cfg RECORD;
  v_link RECORD;
  v_recipe RECORD;
  v_mode TEXT := 'unconfigured';
  v_recipe_id BIGINT := NULL;
  v_status TEXT := 'missing';
  v_unit_cost NUMERIC(14,4) := NULL;
  v_recipe_name TEXT := NULL;
  v_ingredients JSONB := '[]'::jsonb;
BEGIN
  SELECT i.id,i.menu_item_id,i.source_sku,i.quantity INTO v_item
  FROM ordering_order_items i WHERE i.id=p_order_item_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Back Office persists the canonical relationship here.
  SELECT l.recipe_id INTO v_link
  FROM ordering_menu_item_recipe_links l
  WHERE l.menu_item_id=v_item.menu_item_id;

  -- Legacy/direct costing configuration remains supported. Direct costing
  -- intentionally overrides a recipe link when explicitly configured.
  SELECT * INTO v_cfg
  FROM pos_item_costing_config
  WHERE menu_item_id=v_item.menu_item_id;

  IF FOUND AND v_cfg.costing_mode='direct' THEN
    v_mode := 'direct';
    v_status := 'direct';
    v_unit_cost := v_cfg.direct_unit_cost;
  ELSE
    v_recipe_id := COALESCE(v_link.recipe_id, CASE WHEN v_cfg.costing_mode='recipe' THEN v_cfg.recipe_id ELSE NULL END);

    IF v_recipe_id IS NOT NULL THEN
      v_mode := 'recipe';
      BEGIN
        EXECUTE 'SELECT id,name,cost_per_serving,COALESCE(ingredients,''[]''::jsonb) ingredients FROM recipes WHERE id=$1'
          INTO v_recipe USING v_recipe_id;

        IF v_recipe.id IS NULL THEN
          v_status := 'missing';
        ELSE
          v_recipe_name := v_recipe.name;
          v_ingredients := COALESCE(v_recipe.ingredients,'[]'::jsonb);
          v_unit_cost := v_recipe.cost_per_serving;
          IF v_unit_cost IS NULL OR jsonb_typeof(v_ingredients) <> 'array' OR jsonb_array_length(v_ingredients)=0 THEN
            v_status := 'partial';
            v_unit_cost := NULL;
          ELSE
            v_status := 'complete';
          END IF;
        END IF;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        v_status := 'partial';
        v_unit_cost := NULL;
      END;
    END IF;
  END IF;

  INSERT INTO ordering_order_item_cost_snapshots(
    order_item_id,menu_item_id,source_sku,costing_mode,costing_status,recipe_id,recipe_name,unit_cost,quantity,total_cost,ingredient_snapshot,snapshot_origin
  )
  VALUES(
    v_item.id,v_item.menu_item_id,v_item.source_sku,v_mode,v_status,v_recipe_id,v_recipe_name,v_unit_cost,v_item.quantity,
    CASE WHEN v_unit_cost IS NULL THEN NULL ELSE v_unit_cost*v_item.quantity END,v_ingredients,p_origin
  )
  ON CONFLICT(order_item_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION capture_order_item_cost_snapshot(UUID,TEXT) IS
'Captures immutable sale-time item cost. Canonical ordering_menu_item_recipe_links is the recipe source; explicit direct costing remains supported. Existing snapshots are never rewritten.';
