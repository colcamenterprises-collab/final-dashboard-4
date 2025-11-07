-- Create tables if missing (keep names as-is)
CREATE TABLE IF NOT EXISTS menu_categories_online (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  position   INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items_online (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  sku         TEXT,
  description TEXT,
  price       DOUBLE PRECISION NOT NULL DEFAULT 0,
  image_url   TEXT,
  position    INT  NOT NULL DEFAULT 0,
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  category_id TEXT NOT NULL REFERENCES menu_categories_online(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns (safe; no-op if already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items_online' AND column_name='image_url') THEN
    ALTER TABLE menu_items_online ADD COLUMN image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items_online' AND column_name='position') THEN
    ALTER TABLE menu_items_online ADD COLUMN position INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items_online' AND column_name='available') THEN
    ALTER TABLE menu_items_online ADD COLUMN available BOOLEAN NOT NULL DEFAULT TRUE;
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
