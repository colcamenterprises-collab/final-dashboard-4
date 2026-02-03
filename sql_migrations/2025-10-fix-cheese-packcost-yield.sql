UPDATE "Item"
SET "packCost" = 349, yield = 82
WHERE brand ILIKE '%cheese%' OR sku ILIKE '%cheese%';
