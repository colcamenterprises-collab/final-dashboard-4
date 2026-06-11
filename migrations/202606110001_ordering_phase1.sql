-- SBB Ordering OS Phase 1
-- Additive-only ordering tables. No existing business tables are modified.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ordering_menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_th TEXT,
  description_en TEXT,
  description_th TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ordering_menu_categories(id) ON DELETE RESTRICT,
  name_en TEXT NOT NULL,
  name_th TEXT,
  description_en TEXT,
  description_th TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sold_out BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES ordering_menu_items(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_th TEXT,
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= 0),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES ordering_modifier_groups(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_th TEXT,
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_venue_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_code TEXT NOT NULL UNIQUE,
  table_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN ('online','qr_table','tablet_counter','kiosk','ai_voice')),
  table_id UUID REFERENCES ordering_venue_tables(id) ON DELETE SET NULL,
  table_code TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  order_notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','payment_pending','paid','pay_at_counter','accepted','in_kitchen','ready','completed','cancelled','refunded')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending_manual_confirmation','paid','refunded')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pay_at_counter','cash','manual_qr_transfer')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ordering_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES ordering_menu_items(id) ON DELETE SET NULL,
  item_name_en TEXT NOT NULL,
  item_name_th TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES ordering_order_items(id) ON DELETE CASCADE,
  item_modifier_id UUID REFERENCES ordering_item_modifiers(id) ON DELETE SET NULL,
  modifier_group_name_en TEXT,
  modifier_name_en TEXT NOT NULL,
  modifier_name_th TEXT,
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ordering_orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pay_at_counter','cash','manual_qr_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','refunded','cancelled')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ordering_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordering_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ordering_orders(id) ON DELETE CASCADE,
  target TEXT NOT NULL DEFAULT 'loyverse',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','failed','manual_required')),
  payload JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ordering_menu_items_category_idx ON ordering_menu_items(category_id, sort_order);
CREATE INDEX IF NOT EXISTS ordering_orders_status_created_idx ON ordering_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ordering_orders_channel_created_idx ON ordering_orders(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS ordering_order_items_order_idx ON ordering_order_items(order_id);
CREATE INDEX IF NOT EXISTS ordering_status_events_order_idx ON ordering_status_events(order_id, created_at DESC);

INSERT INTO ordering_settings (key, value)
VALUES
  ('store_order_enabled', 'true'::jsonb),
  ('tablet_order_enabled', 'true'::jsonb),
  ('manual_qr_transfer_enabled', 'true'::jsonb),
  ('default_language', '"en"'::jsonb)
ON CONFLICT (key) DO NOTHING;
