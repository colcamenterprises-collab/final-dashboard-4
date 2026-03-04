import { Router, Request, Response } from "express";
import { db } from "../db";
import { stockBaseline, stockSnapshot, stockVariance } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const BUILT_IN_BASELINES = [
  { itemName: "Burger Buns", category: "Buns", expectedQty: "0", unit: "unit", warnThreshold: "5", criticalThreshold: "10" },
  { itemName: "Meat Patties", category: "Meat", expectedQty: "0", unit: "g", warnThreshold: "500", criticalThreshold: "1000" },
];

router.post("/baseline", async (req: Request, res: Response) => {
  try {
    const items: Array<{
      itemName: string;
      category: string;
      expectedQty: number;
      unit?: string;
      warnThreshold?: number;
      criticalThreshold?: number;
    }> = req.body.items || BUILT_IN_BASELINES.map(b => ({
      ...b,
      expectedQty: Number(b.expectedQty),
      warnThreshold: Number(b.warnThreshold),
      criticalThreshold: Number(b.criticalThreshold),
    }));

    const inserted = [];
    for (const item of items) {
      const [row] = await db.insert(stockBaseline).values({
        itemName: item.itemName,
        category: item.category,
        expectedQty: String(item.expectedQty),
        unit: item.unit || "unit",
        warnThreshold: item.warnThreshold != null ? String(item.warnThreshold) : null,
        criticalThreshold: item.criticalThreshold != null ? String(item.criticalThreshold) : null,
      }).returning();
      inserted.push(row);
    }
    return res.json({ ok: true, seeded: inserted.length, baselines: inserted });
  } catch (err: any) {
    console.error("[stock/baseline] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/baseline", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(stockBaseline).orderBy(desc(stockBaseline.createdAt));
    return res.json({ ok: true, baselines: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/snapshot", async (req: Request, res: Response) => {
  try {
    const { shiftId, shiftDate, items } = req.body;
    if (!shiftDate || !items?.length) {
      return res.status(400).json({ error: "shiftDate and items[] required" });
    }
    const inserted = [];
    for (const item of items) {
      const [row] = await db.insert(stockSnapshot).values({
        shiftId: shiftId || null,
        shiftDate,
        itemName: item.itemName,
        category: item.category || "Other",
        actualQty: String(item.actualQty),
        unit: item.unit || "unit",
        source: item.source || "form2",
      }).returning();
      inserted.push(row);
    }
    return res.json({ ok: true, snapshotted: inserted.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/variance/compute", async (req: Request, res: Response) => {
  try {
    const { shiftId, shiftDate, buns, meatGrams } = req.body;
    if (!shiftDate) return res.status(400).json({ error: "shiftDate required" });

    const variances = [];

    if (buns !== undefined && buns !== null) {
      const bunsVariance = Number(buns);
      const absBuns = Math.abs(bunsVariance);
      let severity = "ok";
      if (absBuns > 10) severity = "critical";
      else if (absBuns > 5) severity = "warn";

      const [row] = await db.insert(stockVariance).values({
        shiftId: shiftId || null,
        shiftDate,
        itemName: "Burger Buns",
        category: "Buns",
        expectedQty: "0",
        actualQty: String(buns),
        varianceQty: String(bunsVariance),
        unit: "unit",
        severity,
      }).returning();
      variances.push(row);
    }

    if (meatGrams !== undefined && meatGrams !== null) {
      const meatVariance = Number(meatGrams);
      const absMeat = Math.abs(meatVariance);
      let severity = "ok";
      if (absMeat > 1000) severity = "critical";
      else if (absMeat > 500) severity = "warn";

      const [row] = await db.insert(stockVariance).values({
        shiftId: shiftId || null,
        shiftDate,
        itemName: "Meat Patties",
        category: "Meat",
        expectedQty: "0",
        actualQty: String(meatGrams),
        varianceQty: String(meatVariance),
        unit: "g",
        severity,
      }).returning();
      variances.push(row);
    }

    return res.json({ ok: true, variances });
  } catch (err: any) {
    console.error("[variance/compute] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/variance", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(stockVariance).orderBy(desc(stockVariance.createdAt));
    return res.json({ ok: true, variances: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
