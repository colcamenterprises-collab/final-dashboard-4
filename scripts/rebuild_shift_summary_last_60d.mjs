import { db } from "../server/db.js";
import { sql } from "drizzle-orm";
import { extractSummary } from "../server/services/summaryExtract.js";

const res = await db.execute(sql.raw(`
  SELECT id, "shiftDate", payload, "completedBy", "createdAt"
  FROM daily_sales_v2
  WHERE "createdAt" >= NOW() - INTERVAL '60 days'
    AND "deletedAt" IS NULL
  ORDER BY "createdAt" ASC
`));
const rows = res.rows || [];
let up = 0;

for (const r of rows) {
  const p = r.payload || {};
  const pick = extractSummary(p);
  await db.execute(sql.raw(`
    INSERT INTO daily_shift_summary AS s
      (id, shift_date, completed_by, created_at,
       total_sales, cash_sales, qr_sales, grab_sales, other_sales,
       shopping_total, wages_total, others_total, total_expenses,
       rolls_end, meat_end_g, deleted_at)
    VALUES
      ($1,$2,$3,$4,
       $5,$6,$7,$8,$9,
       $10,$11,$12,$13,
       $14,$15,NULL)
    ON CONFLICT (id) DO UPDATE SET
       shift_date      = EXCLUDED.shift_date,
       completed_by    = EXCLUDED.completed_by,
       created_at      = EXCLUDED.created_at,
       total_sales     = EXCLUDED.total_sales,
       cash_sales      = EXCLUDED.cash_sales,
       qr_sales        = EXCLUDED.qr_sales,
       grab_sales      = EXCLUDED.grab_sales,
       other_sales     = EXCLUDED.other_sales,
       shopping_total  = EXCLUDED.shopping_total,
       wages_total     = EXCLUDED.wages_total,
       others_total    = EXCLUDED.others_total,
       total_expenses  = EXCLUDED.total_expenses,
       rolls_end       = EXCLUDED.rolls_end,
       meat_end_g      = EXCLUDED.meat_end_g,
       deleted_at      = NULL
  `), [
    r.id,
    r.shiftDate,
    r.completedBy,
    r.createdAt,
    pick.totalSales, pick.cashSales, pick.qrSales, pick.grabSales, pick.otherSales,
    pick.shoppingTotal, pick.wagesTotal, pick.othersTotal, pick.totalExpenses,
    pick.rollsEnd, pick.meatEnd
  ]);
  up++;
}
console.log(`Backfill complete: ${up} rows updated`);
process.exit(0);
