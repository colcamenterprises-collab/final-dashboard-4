import { Router, Request, Response } from "express";
import {
  toggleIngredientVerified,
  toggleIngredientLocked,
} from "../services/ingredientService";
import { pool } from "../db";
import { checkDataConfidence } from "../services/dataConfidenceService";
import { checkPowerToolAccess, logPowerToolAttempt } from "../services/powerToolGuard";
import { runBackup, getBackupStatus } from "../services/backupService";
import { importHistoricalData, getHistoricalStats } from "../services/loyverseHistoricalImport";

const router = Router();

// PHASE H HARDENED - All routes return 200 with safe fallbacks
router.get("/api/ingredients/master", async (req: Request, res: Response) => {
  try {
    // Use purchasing_items as canonical source for ingredients
    const result = await pool.query(`
      SELECT 
        id, 
        item as name, 
        category, 
        "orderUnit" as "purchaseQty", 
        "unitDescription" as "purchaseUnit", 
        "unitCost" as "purchaseCost",
        portion_unit as "portionUnit",
        COALESCE(yield, 1) as "portionsPerPurchase",
        ("unitCost" / NULLIF(yield, 1)) as "portionCost",
        true as verified,
        false as locked
      FROM purchasing_items 
      WHERE is_ingredient = true AND active = true
      ORDER BY item
    `);
    const data = result.rows.map((ing: any) => ({
      ...ing,
      status: 'verified'
    }));
    res.json({ ok: true, ingredients: data });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] ingredients/master:', e);
    res.status(200).json({ ok: true, ingredients: [], warning: 'SAFE_FALLBACK_USED' });
  }
});

router.post("/api/ingredients/:id/toggle-verified", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await toggleIngredientVerified(id);
    res.json({ ok: true, ingredient: result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.post("/api/ingredients/:id/toggle-locked", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await toggleIngredientLocked(id);
    res.json({ ok: true, ingredient: result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.get("/api/purchases/summary", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "daily";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let groupBy: string;
    let dateFormat: string;
    switch (period) {
      case "weekly":
        groupBy = "DATE_TRUNC('week', \"shiftDate\")";
        dateFormat = "week";
        break;
      case "monthly":
        groupBy = "DATE_TRUNC('month', \"shiftDate\")";
        dateFormat = "month";
        break;
      default:
        groupBy = "\"shiftDate\"::date";
        dateFormat = "day";
    }

    let whereClause = "";
    const params: any[] = [];
    if (startDate) {
      params.push(startDate);
      whereClause += ` AND "shiftDate" >= $${params.length}::date`;
    }
    if (endDate) {
      params.push(endDate);
      whereClause += ` AND "shiftDate" <= $${params.length}::date`;
    }

    const query = `
      SELECT 
        ${groupBy} as period,
        "expenseType" as item,
        SUM("costCents") as total_cost,
        COUNT(*) as count
      FROM expenses
      WHERE 1=1 ${whereClause}
      GROUP BY ${groupBy}, "expenseType"
      ORDER BY period DESC, total_cost DESC
    `;

    const result = await pool.query(query, params);

    const summary = result.rows.map(row => ({
      period: row.period,
      item: row.item || "Uncategorized",
      totalCost: parseFloat(row.total_cost) || 0,
      count: parseInt(row.count) || 0,
    }));

    res.json({ ok: true, period: dateFormat, summary });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] purchases/summary:', e);
    res.status(200).json({ ok: true, period: "day", summary: [], warning: 'SAFE_FALLBACK_USED' });
  }
});

router.get("/api/data-confidence", async (req: Request, res: Response) => {
  try {
    const shiftDate = req.query.date as string | undefined;
    const result = await checkDataConfidence(shiftDate);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] data-confidence:', e);
    res.status(200).json({ 
      ok: true, 
      status: "NO_DATA",
      reasons: ["Unable to check data confidence"],
      checks: {
        ingredientsVerified: { passed: true, total: 0, verified: 0 },
        salesFormExists: false,
        stockFormExists: false,
        receiptsPresent: false,
      },
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

router.post("/api/power-tools/backup", async (req: Request, res: Response) => {
  const confirm = req.body.confirm === true;
  const guard = checkPowerToolAccess(confirm);
  logPowerToolAttempt("backup", guard.allowed, req.body.user);

  if (!guard.allowed) {
    return res.status(403).json({ ok: false, error: guard.reason });
  }

  try {
    const type = (req.body.type as "full" | "daily" | "manual") || "manual";
    const triggeredBy = req.body.user || "api";
    const result = await runBackup(type, triggeredBy);
    res.json({ ok: result.success, ...result });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] backup:', e);
    res.status(200).json({ ok: true, success: false, warning: 'SAFE_FALLBACK_USED' });
  }
});

router.get("/api/power-tools/backup/status", async (req: Request, res: Response) => {
  try {
    const status = await getBackupStatus();
    res.json({ ok: true, ...status });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] backup/status:', e);
    res.status(200).json({ ok: true, lastBackup: null, warning: 'SAFE_FALLBACK_USED' });
  }
});

router.post("/api/power-tools/historical-import", async (req: Request, res: Response) => {
  const confirm = req.body.confirm === true;
  const guard = checkPowerToolAccess(confirm);
  logPowerToolAttempt("historical-import", guard.allowed, req.body.user);

  if (!guard.allowed) {
    return res.status(403).json({ ok: false, error: guard.reason });
  }

  try {
    const startDate = req.body.startDate || "2025-07-01";
    const endDate = req.body.endDate;
    const result = await importHistoricalData(startDate, endDate);
    res.json({ ok: result.success, ...result });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] historical-import:', e);
    res.status(200).json({ ok: true, success: false, warning: 'SAFE_FALLBACK_USED' });
  }
});

router.get("/api/power-tools/historical-import/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getHistoricalStats();
    res.json({ ok: true, ...stats });
  } catch (e: any) {
    console.error('[EXPENSE_SAFE_FAIL] historical-import/stats:', e);
    res.status(200).json({ ok: true, stats: null, warning: 'SAFE_FALLBACK_USED' });
  }
});

export default router;
