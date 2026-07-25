-- Reusable modifier/upsell groups with many-to-many menu item assignment.
-- Existing single-item links are preserved and copied into the assignment table.

ALTER TABLE ordering_modifier_groups
  ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'modifier',
  ADD COLUMN IF NOT EXISTS selection_mode TEXT NOT NULL DEFAULT 'multiple',
  ADD COLUMN IF NOT EXISTS min_selections INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_selections INTEGER,
  ADD COLUMN IF NOT EXISTS prompt_text TEXT;

CREATE TABLE IF NOT EXISTS ordering_modifier_group_items (
  modifier_group_id UUID NOT NULL REFERENCES ordering_modifier_groups(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES ordering_menu_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (modifier_group_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_modifier_group_items_item
  ON ordering_modifier_group_items(menu_item_id, sort_order);

INSERT INTO ordering_modifier_group_items(modifier_group_id, menu_item_id)
SELECT id, menu_item_id
FROM ordering_modifier_groups
WHERE menu_item_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE ordering_item_modifiers
  ADD COLUMN IF NOT EXISTS recipe_id INTEGER REFERENCES recipes(id),
  ADD COLUMN IF NOT EXISTS added_menu_item_id UUID REFERENCES ordering_menu_items(id),
  ADD COLUMN IF NOT EXISTS requires_group_id UUID REFERENCES ordering_modifier_groups(id);
