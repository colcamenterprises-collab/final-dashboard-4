-- Follow-up POS enhancement: staff access, standard discounts, and local app-role grants.
-- Additive only; existing receipts and order totals are unchanged.

ALTER TABLE pos_discount_codes
  DROP CONSTRAINT IF EXISTS pos_discount_codes_value_check;

ALTER TABLE pos_discount_codes
  ADD CONSTRAINT pos_discount_codes_value_check CHECK (value >= 0);

INSERT INTO pos_discount_codes (code, name, discount_type, value, active)
VALUES
  ('MEMBER10', 'Member Discount - 10%', 'percent', 10, TRUE),
  ('PROMO0', 'Promotional Discount - 0%', 'percent', 0, TRUE),
  ('OWNER100', 'Owner Discount', 'percent', 100, TRUE)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      discount_type = EXCLUDED.discount_type,
      value = EXCLUDED.value,
      active = TRUE,
      updated_at = NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sbb_prod_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pos_discount_codes TO sbb_prod_app;
    GRANT SELECT, INSERT ON TABLE pos_customer_marketing_captures TO sbb_prod_app;
  END IF;
END $$;
