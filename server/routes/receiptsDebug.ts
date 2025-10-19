import { Router } from "express";
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = Router();
const TZ = "Asia/Bangkok";

function window(dateISO: string) {
  const d = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  return {
    fromISO: d.plus({ hours: 18 }).toUTC().toISO(),
    toISO: d.plus({ days: 1, hours: 3 }).toUTC().toISO(),
    label: d.toISODate()!,
  };
}

/** GET /api/receipts/debug/items?date=YYYY-MM-DD&limit=50 */
router.get("/debug/items", async (req, res) => {
  try {
    const { date, limit } = req.query as { date: string; limit?: string };
    if (!date) return res.status(400).json({ ok:false, error:"date required" });
    const w = window(date);
    const fromUTC = w.fromISO!;
    const toUTC = w.toISO!;
    const rows = await prisma.$queryRaw<
      { item_name: string; qty: number }[]
    >`
      SELECT ri.name AS item_name,
             SUM(ri.qty)::int AS qty
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri."receiptId"
      WHERE COALESCE(r."closedAtUTC", r."createdAtUTC") >= ${fromUTC}::timestamptz
        AND COALESCE(r."closedAtUTC", r."createdAtUTC") <  ${toUTC}::timestamptz
      GROUP BY ri.name
      ORDER BY qty DESC
      LIMIT ${Number(limit ?? 50)}
    `;
    res.json({ ok:true, date: w.label, fromUTC, toUTC, items: rows });
  } catch(e:any) {
    console.error(e);
    res.status(500).json({ ok:false, error:e?.message || "debug failed" });
  }
});

export default router;
