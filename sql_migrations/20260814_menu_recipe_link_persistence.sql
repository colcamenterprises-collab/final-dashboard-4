BEGIN;

-- Canonical one-to-one link between an ordering menu item and a costing recipe.
-- This is deliberately separate from the legacy V3 ingredient mapping table.
CREATE TABLE IF NOT EXISTS public.ordering_menu_item_recipe_links (
  menu_item_id UUID PRIMARY KEY
    REFERENCES public.ordering_menu_items(id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL
    REFERENCES public.recipes(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ordering_menu_item_recipe_links_recipe_id_idx
  ON public.ordering_menu_item_recipe_links(recipe_id);

COMMIT;
