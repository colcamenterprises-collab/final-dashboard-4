BEGIN;

-- A menu item has one optional costing recipe. Earlier environments created
-- the link table without this column, so links could be posted but not read back.
ALTER TABLE public.menu_item_recipes_v3
  ADD COLUMN IF NOT EXISTS recipe_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'menu_item_recipes_v3_recipe_id_fkey'
       AND conrelid = 'public.menu_item_recipes_v3'::regclass
  ) THEN
    ALTER TABLE public.menu_item_recipes_v3
      ADD CONSTRAINT menu_item_recipes_v3_recipe_id_fkey
      FOREIGN KEY (recipe_id) REFERENCES public.recipes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Keeps a menu product to one live linked recipe while preserving any historic
-- ingredient rows that pre-date recipe linking.
CREATE UNIQUE INDEX IF NOT EXISTS menu_item_recipes_v3_one_recipe_per_item
  ON public.menu_item_recipes_v3 ("itemId")
  WHERE recipe_id IS NOT NULL;

COMMIT;
