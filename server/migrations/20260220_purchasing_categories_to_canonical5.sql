-- Canonicalize purchasing_items.category to the 5 allowed supplier categories.
-- Safe + deterministic: no deletes, idempotent UPDATE mapping.

BEGIN;

UPDATE purchasing_items
SET category = CASE
  WHEN category IS NULL THEN 'Shelf Items'
  WHEN btrim(category) = '' THEN 'Shelf Items'

  WHEN lower(btrim(category)) = 'fresh food' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'vegetables' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'dairy' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'meat' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'chicken' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'bread' THEN 'Fresh Items'

  WHEN lower(btrim(category)) = 'frozen food' THEN 'Frozen Items'

  WHEN lower(btrim(category)) = 'kitchen supplies' THEN 'Kitchen Items'

  WHEN lower(btrim(category)) = 'drinks' THEN 'Shelf Items'
  WHEN lower(btrim(category)) = 'sauces' THEN 'Shelf Items'
  WHEN lower(btrim(category)) = 'seasonings' THEN 'Shelf Items'

  WHEN category IN ('Fresh Items', 'Frozen Items', 'Shelf Items', 'Packaging', 'Kitchen Items') THEN category

  ELSE 'Shelf Items'
END
WHERE category IS DISTINCT FROM CASE
  WHEN category IS NULL THEN 'Shelf Items'
  WHEN btrim(category) = '' THEN 'Shelf Items'

  WHEN lower(btrim(category)) = 'fresh food' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'vegetables' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'dairy' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'meat' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'chicken' THEN 'Fresh Items'
  WHEN lower(btrim(category)) = 'bread' THEN 'Fresh Items'

  WHEN lower(btrim(category)) = 'frozen food' THEN 'Frozen Items'

  WHEN lower(btrim(category)) = 'kitchen supplies' THEN 'Kitchen Items'

  WHEN lower(btrim(category)) = 'drinks' THEN 'Shelf Items'
  WHEN lower(btrim(category)) = 'sauces' THEN 'Shelf Items'
  WHEN lower(btrim(category)) = 'seasonings' THEN 'Shelf Items'

  WHEN category IN ('Fresh Items', 'Frozen Items', 'Shelf Items', 'Packaging', 'Kitchen Items') THEN category

  ELSE 'Shelf Items'
END;

COMMIT;
