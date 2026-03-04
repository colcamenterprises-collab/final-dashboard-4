import { Router, Request, Response } from "express";
import { db } from "../db";
import { shiftReview } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { shiftId, managerName, cashBanked, scanQrActual, refundReviewed, refundFindings, signedOff } = req.body;
    if (!shiftId || !managerName) {
      return res.status(400).json({ error: "shiftId and managerName are required" });
    }
    const [row] = await db.insert(shiftReview).values({
      shiftId,
      managerName,
      cashBanked: cashBanked != null ? String(cashBanked) : null,
      scanQrActual: scanQrActual != null ? String(scanQrActual) : null,
      refundReviewed: refundReviewed || false,
      refundFindings: refundFindings || null,
      signedOff: signedOff || false,
      signedAt: signedOff ? new Date() : null,
    }).returning();
    return res.json({ ok: true, review: row });
  } catch (err: any) {
    console.error("[shift-review] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { shiftId } = req.query as Record<string, string>;
    if (!shiftId) return res.status(400).json({ error: "shiftId required" });
    const rows = await db
      .select()
      .from(shiftReview)
      .where(eq(shiftReview.shiftId, shiftId))
      .orderBy(desc(shiftReview.createdAt));
    return res.json({ ok: true, reviews: rows });
  } catch (err: any) {
    console.error("[shift-review GET] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
