-- Recipes & Costing Fixes: additive-only columns for pricing persistence and recipe-to-menu sync.
-- Upstream sources: recipes, menu_items_v3, menu_item_recipes_v3.
-- Rebuild/sync command: save each LIVE recipe through /api/recipes/:id after applying this migration.
-- Determinism: menu item linkage is keyed by menu_item_recipes_v3.recipe_id; repeated saves update the same linked item.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS delivery_partner_margin_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS direct_margin_percent NUMERIC(5,2);

ALTER TABLE menu_item_recipes_v3
  ADD COLUMN IF NOT EXISTS recipe_id INTEGER REFERENCES recipes(id);

CREATE UNIQUE INDEX IF NOT EXISTS menu_item_recipes_v3_recipe_id_unique
  ON menu_item_recipes_v3(recipe_id)
  WHERE recipe_id IS NOT NULL;
