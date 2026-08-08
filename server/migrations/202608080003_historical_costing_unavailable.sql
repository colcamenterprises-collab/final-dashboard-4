-- Historical Loyverse COGS/profit/margin were not maintained reliably.
-- Preserve factual transaction fields, but make cost-derived fields explicitly unknown.
ALTER TABLE historical_item_sales ALTER COLUMN cost_of_goods DROP NOT NULL;
ALTER TABLE historical_item_sales ALTER COLUMN gross_profit DROP NOT NULL;

UPDATE historical_item_sales
SET cost_of_goods = NULL,
    gross_profit = NULL,
    margin_pct = NULL
WHERE source = 'loyverse_csv';

COMMENT ON COLUMN historical_item_sales.cost_of_goods IS 'NULL for Loyverse archive because historical ingredient costs were not maintained reliably.';
COMMENT ON COLUMN historical_item_sales.gross_profit IS 'NULL when source COGS is unavailable; never infer profit from incomplete historical costing.';
COMMENT ON COLUMN historical_item_sales.margin_pct IS 'NULL when source COGS is unavailable.';
