import { Router, Request, Response } from "express";
import { db } from "../db";
import { loyverse_receipts } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/receipts/count?date=YYYY-MM-DD
// Returns the count of POS receipts stored for a given shift date (fast — DB only, no external call)
router.get("/count", async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }
  try {
    const [row] = await db.select().from(loyverse_receipts).where(eq(loyverse_receipts.shiftDate, date));
    const count = row ? ((row.data as any)?.receipts?.length ?? 0) : 0;
    return res.json({ ok: true, date, count });
  } catch (err: any) {
    console.error("[receiptCount] error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
