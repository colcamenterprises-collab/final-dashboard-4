import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

router.get("/summary", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT payload
    FROM "daily_sales_v2"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `) as unknown as Array<{ payload: any }>;
  const payload = rows?.[0]?.payload || {};
  return res.json(payload.finance_summary || {});
});

router.get("/summary/today", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT payload
    FROM "daily_sales_v2"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `) as unknown as Array<{ payload: any }>;
  const fs = rows?.[0]?.payload?.finance_summary;
  if (!fs) return res.json({});
  return res.json({
    sales: fs.sales,
    netProfit: fs.netProfit,
    primeCostPct: fs.primeCostPct,
    directExpenses: fs.breakdown?.direct || 0,
    businessExpenses: fs.breakdown?.business || 0,
    stockExpenses: fs.breakdown?.stock || 0,
  });
});

export default router;