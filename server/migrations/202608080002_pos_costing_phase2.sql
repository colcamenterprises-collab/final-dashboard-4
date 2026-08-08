-- Phase 2: SBB POS costing bridge + immutable sale-time snapshots.
-- Additive only. Live sales remain sourced from ordering_* tables.

CREATE TABLE IF NOT EXISTS pos_item_costing_config (
  menu_item_id UUID PRIMARY KEY REFERENCES ordering_menu_items(id) ON DELETE CASCADE,
  costing_mode TEXT NOT NULL DEFAULT 'unconfigured' CHECK (costing_mode IN ('recipe','direct','unconfigured')),
  recipe_id BIGINT,
  direct_unit_cost NUMERIC(14,4),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((costing_mode='recipe' AND recipe_id IS NOT NULL AND direct_unit_cost IS NULL)
      OR (costing_mode='direct' AND direct_unit_cost IS NOT NULL AND recipe_id IS NULL)
      OR (costing_mode='unconfigured' AND recipe_id IS NULL AND direct_unit_cost IS NULL))
);

CREATE TABLE IF NOT EXISTS pos_modifier_costing_config (
  item_modifier_id UUID PRIMARY KEY REFERENCES ordering_item_modifiers(id) ON DELETE CASCADE,
  costing_mode TEXT NOT NULL DEFAULT 'unconfigured' CHECK (costing_mode IN ('recipe','direct','unconfigured')),
  recipe_id BIGINT,
  direct_unit_cost NUMERIC(14,4),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((costing_mode='recipe' AND recipe_id IS NOT NULL AND direct_unit_cost IS NULL)
      OR (costing_mode='direct' AND direct_unit_cost IS NOT NULL AND recipe_id IS NULL)
      OR (costing_mode='unconfigured' AND recipe_id IS NULL AND direct_unit_cost IS NULL))
);

CREATE TABLE IF NOT EXISTS ordering_order_item_cost_snapshots (
  order_item_id UUID PRIMARY KEY REFERENCES ordering_order_items(id) ON DELETE CASCADE,
  menu_item_id UUID,
  source_sku TEXT,
  costing_mode TEXT NOT NULL,
  costing_status TEXT NOT NULL CHECK (costing_status IN ('complete','partial','missing','direct')),
  recipe_id BIGINT,
  recipe_name TEXT,
  unit_cost NUMERIC(14,4),
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  total_cost NUMERIC(14,4),
  ingredient_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_origin TEXT NOT NULL DEFAULT 'sale_time' CHECK (snapshot_origin IN ('sale_time','phase2_backfill')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_modifier_cost_snapshots (
  order_item_modifier_id UUID PRIMARY KEY REFERENCES ordering_order_item_modifiers(id) ON DELETE CASCADE,
  item_modifier_id UUID,
  costing_mode TEXT NOT NULL,
  costing_status TEXT NOT NULL CHECK (costing_status IN ('complete','partial','missing','direct')),
  recipe_id BIGINT,
  recipe_name TEXT,
  unit_cost NUMERIC(14,4),
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  total_cost NUMERIC(14,4),
  ingredient_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_origin TEXT NOT NULL DEFAULT 'sale_time' CHECK (snapshot_origin IN ('sale_time','phase2_backfill')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ordering_order_item_cost_snapshots_menu_idx ON ordering_order_item_cost_snapshots(menu_item_id);
CREATE INDEX IF NOT EXISTS ordering_modifier_cost_snapshots_modifier_idx ON ordering_modifier_cost_snapshots(item_modifier_id);

CREATE OR REPLACE FUNCTION capture_order_item_cost_snapshot(p_order_item_id UUID, p_origin TEXT DEFAULT 'sale_time')
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_cfg RECORD;
  v_recipe RECORD;
  v_status TEXT := 'missing';
  v_unit_cost NUMERIC(14,4) := NULL;
  v_recipe_name TEXT := NULL;
  v_ingredients JSONB := '[]'::jsonb;
BEGIN
  SELECT i.id,i.menu_item_id,i.source_sku,i.quantity INTO v_item
  FROM ordering_order_items i WHERE i.id=p_order_item_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cfg FROM pos_item_costing_config WHERE menu_item_id=v_item.menu_item_id;
  IF NOT FOUND OR v_cfg.costing_mode='unconfigured' THEN
    v_status := 'missing';
    INSERT INTO ordering_order_item_cost_snapshots(order_item_id,menu_item_id,source_sku,costing_mode,costing_status,quantity,snapshot_origin)
    VALUES(v_item.id,v_item.menu_item_id,v_item.source_sku,'unconfigured',v_status,v_item.quantity,p_origin)
    ON CONFLICT(order_item_id) DO NOTHING;
    RETURN;
  END IF;

  IF v_cfg.costing_mode='direct' THEN
    v_status := 'direct';
    v_unit_cost := v_cfg.direct_unit_cost;
  ELSE
    BEGIN
      EXECUTE 'SELECT id,name,cost_per_serving,COALESCE(ingredients,''[]''::jsonb) ingredients FROM recipes WHERE id=$1'
        INTO v_recipe USING v_cfg.recipe_id;
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

  INSERT INTO ordering_order_item_cost_snapshots(
    order_item_id,menu_item_id,source_sku,costing_mode,costing_status,recipe_id,recipe_name,unit_cost,quantity,total_cost,ingredient_snapshot,snapshot_origin)
  VALUES(
    v_item.id,v_item.menu_item_id,v_item.source_sku,v_cfg.costing_mode,v_status,v_cfg.recipe_id,v_recipe_name,v_unit_cost,v_item.quantity,
    CASE WHEN v_unit_cost IS NULL THEN NULL ELSE v_unit_cost*v_item.quantity END,v_ingredients,p_origin)
  ON CONFLICT(order_item_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION capture_modifier_cost_snapshot(p_modifier_row_id UUID, p_origin TEXT DEFAULT 'sale_time')
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_mod RECORD;
  v_cfg RECORD;
  v_recipe RECORD;
  v_status TEXT := 'missing';
  v_unit_cost NUMERIC(14,4) := NULL;
  v_recipe_name TEXT := NULL;
  v_ingredients JSONB := '[]'::jsonb;
BEGIN
  SELECT m.id,m.item_modifier_id,m.quantity INTO v_mod
  FROM ordering_order_item_modifiers m WHERE m.id=p_modifier_row_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cfg FROM pos_modifier_costing_config WHERE item_modifier_id=v_mod.item_modifier_id;
  IF NOT FOUND OR v_cfg.costing_mode='unconfigured' THEN
    INSERT INTO ordering_modifier_cost_snapshots(order_item_modifier_id,item_modifier_id,costing_mode,costing_status,quantity,snapshot_origin)
    VALUES(v_mod.id,v_mod.item_modifier_id,'unconfigured','missing',v_mod.quantity,p_origin)
    ON CONFLICT(order_item_modifier_id) DO NOTHING;
    RETURN;
  END IF;

  IF v_cfg.costing_mode='direct' THEN
    v_status := 'direct';
    v_unit_cost := v_cfg.direct_unit_cost;
  ELSE
    BEGIN
      EXECUTE 'SELECT id,name,cost_per_serving,COALESCE(ingredients,''[]''::jsonb) ingredients FROM recipes WHERE id=$1'
        INTO v_recipe USING v_cfg.recipe_id;
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

  INSERT INTO ordering_modifier_cost_snapshots(
    order_item_modifier_id,item_modifier_id,costing_mode,costing_status,recipe_id,recipe_name,unit_cost,quantity,total_cost,ingredient_snapshot,snapshot_origin)
  VALUES(
    v_mod.id,v_mod.item_modifier_id,v_cfg.costing_mode,v_status,v_cfg.recipe_id,v_recipe_name,v_unit_cost,v_mod.quantity,
    CASE WHEN v_unit_cost IS NULL THEN NULL ELSE v_unit_cost*v_mod.quantity END,v_ingredients,p_origin)
  ON CONFLICT(order_item_modifier_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION trg_capture_order_item_cost_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM capture_order_item_cost_snapshot(NEW.id,'sale_time');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_capture_modifier_cost_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM capture_modifier_cost_snapshot(NEW.id,'sale_time');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordering_order_items_cost_snapshot_ai ON ordering_order_items;
CREATE TRIGGER ordering_order_items_cost_snapshot_ai AFTER INSERT ON ordering_order_items
FOR EACH ROW EXECUTE FUNCTION trg_capture_order_item_cost_snapshot();

DROP TRIGGER IF EXISTS ordering_order_item_modifiers_cost_snapshot_ai ON ordering_order_item_modifiers;
CREATE TRIGGER ordering_order_item_modifiers_cost_snapshot_ai AFTER INSERT ON ordering_order_item_modifiers
FOR EACH ROW EXECUTE FUNCTION trg_capture_modifier_cost_snapshot();

COMMENT ON TABLE ordering_order_item_cost_snapshots IS 'Immutable cost basis captured when SBB POS order lines are created. Later recipe price changes do not rewrite history.';
COMMENT ON TABLE ordering_modifier_cost_snapshots IS 'Immutable modifier cost basis captured when modifier selections are sold.';
