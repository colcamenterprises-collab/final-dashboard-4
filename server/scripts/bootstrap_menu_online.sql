-- Tables already exist, just ensure required columns are present
-- Add slug column to menu_items_online if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items_online' AND column_name='slug') THEN
    ALTER TABLE menu_items_online ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Keep updated_at current on updates
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_menu_cat_updated ON menu_categories_online;
CREATE TRIGGER t_menu_cat_updated BEFORE UPDATE ON menu_categories_online
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS t_menu_item_updated ON menu_items_online;
CREATE TRIGGER t_menu_item_updated BEFORE UPDATE ON menu_items_online
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
