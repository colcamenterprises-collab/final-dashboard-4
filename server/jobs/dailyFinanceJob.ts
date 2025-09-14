import { db } from "../db";
import { sql } from "drizzle-orm";
import { getExpenseTotalsForShiftDate } from "../utils/expenseLedger";
import { calculateFinance } from "../utils/financeCalculations";

export async function runDailyFinanceJob() {
  console.log("▶ Running Daily Finance Job…");

  const result = await db.execute(sql`
    SELECT id, "createdAt", payload
    FROM "daily_sales_v2"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `) as unknown as Array<{ id: string; createdAt: string; payload: any }>;

  if (!result?.length) {
    console.log("No daily_sales_v2 rows found.");
    return;
  }

  const row = result[0];
  const shiftDate = new Date(row.createdAt);
  const payload = row.payload || {};

  const sales = Number(payload.totalSales) || 0;
  const cogs = Number(payload.cogs) || 0;
  const labor = Array.isArray(payload.wages)
    ? payload.wages.reduce((acc: number, w: any) => acc + (Number(w?.amount) || 0), 0)
    : 0;

  const totals = await getExpenseTotalsForShiftDate(shiftDate);

  const finance = calculateFinance({
    sales,
    cogs,
    labor,
    totals,
  });

  await db.execute(sql`
    UPDATE "daily_sales_v2"
    SET payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{finance_summary}',
      ${JSON.stringify(finance)}::jsonb,
      true
    )
    WHERE id = ${row.id}
  `);

  console.log("✔ Daily Finance Job complete");
}