import { Router, Request, Response } from "express";
import { db } from "../db";
import { refundLogs } from "../../shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router = Router();

router.post("/log", async (req: Request, res: Response) => {
  try {
    const { shiftId, shiftDate, amount, reason, platform, loggedBy, notes } = req.body;
    if (!amount || !reason || !loggedBy) {
      return res.status(400).json({ error: "amount, reason, and loggedBy are required" });
    }
    const [row] = await db.insert(refundLogs).values({
      shiftId: shiftId || null,
      shiftDate: shiftDate || null,
      amount: String(amount),
      reason,
      platform: platform || "cash",
      loggedBy,
      notes: notes || null,
    }).returning();
    return res.json({ ok: true, refund: row });
  } catch (err: any) {
    console.error("[refunds/log] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { shiftId, from, to } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (shiftId) conditions.push(eq(refundLogs.shiftId, shiftId));
    if (from) conditions.push(gte(refundLogs.shiftDate, from));
    if (to) conditions.push(lte(refundLogs.shiftDate, to));

    const rows = await db
      .select()
      .from(refundLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(refundLogs.createdAt));

    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter(r => r.shiftDate === today || (r.createdAt && String(r.createdAt).startsWith(today)));
    const todayCount = todayRows.length;
    const todayTotal = todayRows.reduce((s, r) => s + Number(r.amount || 0), 0);

    return res.json({ ok: true, refunds: rows, todayCount, todayTotal });
  } catch (err: any) {
    console.error("[refunds] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
