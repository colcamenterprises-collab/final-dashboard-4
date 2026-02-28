CREATE TABLE IF NOT EXISTS daily_sales_stock_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "salesId" UUID NOT NULL,
  actor TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "changedFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_stock_audit_sales_id
  ON daily_sales_stock_audit ("salesId", "createdAt" DESC);
