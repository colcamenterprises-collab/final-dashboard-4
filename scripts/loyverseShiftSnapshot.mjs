// scripts/loyverseShiftSnapshot.mjs
// Reads existing Loyverse data for a shift window and summarizes it.
// Tables used: receipts, receipt_items, receipt_payments
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Convert BKK "YYYY-MM-DD HH:mm:ss" -> UTC Date
function bkkToUTC(bkkStr) {
  return new Date(bkkStr.replace(' ', 'T') + '+07:00');
}
// Convert satang (int) -> THB string
const toTHB = (n) => (Number(n || 0) / 100).toFixed(2);

async function main() {
  const startBkk = process.argv[2] || '2025-08-09 18:00:00';
  const endBkk   = process.argv[3] || '2025-08-10 03:00:00';
  const startUtc = bkkToUTC(startBkk);
  const endUtc   = bkkToUTC(endBkk);

  console.log('\n=== Window ===');
  console.log({ BKK: { start: startBkk, end: endBkk }, UTC: { start: startUtc, end: endUtc } });

  // 1) Receipts summary (LOYVERSE only)
  const [rSum] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM("total"),0)::bigint AS total_satang
    FROM receipts
    WHERE provider = 'LOYVERSE'
      AND "createdAtUTC" BETWEEN ${startUtc} AND ${endUtc};
  `;
  console.log('\n=== Receipts Summary ===');
  console.log({ count: rSum?.count ?? 0, totalTHB: toTHB(rSum?.total_satang ?? 0) });

  // 2) Payments breakdown
  const pay = await prisma.$queryRaw`
    SELECT rp.method,
           COUNT(*)::int AS count,
           COALESCE(SUM(rp.amount),0)::bigint AS total_satang
    FROM receipt_payments rp
    JOIN receipts r ON r.id = rp."receiptId"
    WHERE r.provider = 'LOYVERSE'
      AND r."createdAtUTC" BETWEEN ${startUtc} AND ${endUtc}
    GROUP BY rp.method
    ORDER BY rp.method;
  `;
  console.log('\n=== Payments Breakdown (THB) ===');
  for (const row of pay) {
    console.log(`${row.method?.toString?.() ?? 'UNKNOWN'}  -> count=${row.count}  total=${toTHB(row.total_satang)}`);
  }

  // 3) Top items
  const items = await prisma.$queryRaw`
    SELECT
      ri.name AS item_name,
      SUM(ri.qty)::numeric AS qty,
      COALESCE(SUM(ri.total),0)::bigint AS revenue_satang
    FROM receipt_items ri
    JOIN receipts r ON r.id = ri."receiptId"
    WHERE r.provider = 'LOYVERSE'
      AND r."createdAtUTC" BETWEEN ${startUtc} AND ${endUtc}
    GROUP BY ri.name
    ORDER BY qty DESC NULLS LAST
    LIMIT 50;
  `;
  console.log('\n=== Top Items (qty, THB) ===');
  for (const row of items) {
    console.log(`${row.item_name}  -> qty=${row.qty}  revenue=${toTHB(row.revenue_satang)}`);
  }

  // 4) Top modifiers
  const mods = await prisma.$queryRaw`
    WITH src AS (
      SELECT ri.modifiers
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri."receiptId"
      WHERE r.provider = 'LOYVERSE'
        AND r."createdAtUTC" BETWEEN ${startUtc} AND ${endUtc}
    ), flat AS (
      SELECT jsonb_array_elements(COALESCE(src.modifiers, '[]'::jsonb)) AS mod FROM src
    )
    SELECT
      mod->>'name' AS modifier_name,
      COUNT(*)::int AS lines,
      COALESCE(SUM( (mod->>'price')::bigint ),0)::bigint AS revenue_satang
    FROM flat
    GROUP BY modifier_name
    ORDER BY lines DESC NULLS LAST
    LIMIT 50;
  `;
  console.log('\n=== Top Modifiers (lines, THB) ===');
  for (const row of mods) {
    console.log(`${row.modifier_name ?? '(none)'}  -> lines=${row.lines}  revenue=${toTHB(row.revenue_satang)}`);
  }

  // 5) Sample receipts
  const sample = await prisma.$queryRaw`
    SELECT id, "receiptNumber", channel, "createdAtUTC", "total"
    FROM receipts
    WHERE provider='LOYVERSE'
      AND "createdAtUTC" BETWEEN ${startUtc} AND ${endUtc}
    ORDER BY "createdAtUTC" DESC
    LIMIT 5;
  `;
  console.log('\n=== Sample Receipts (latest 5) ===');
  for (const r of sample) {
    const when = r.createdAtUTC?.toISOString?.() ?? '';
    console.log(`${r.receiptNumber}  ${r.channel}  ${when}  totalTHB=${toTHB(r.total)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
