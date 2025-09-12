import express from "express";
import { pool } from "../db";

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT payload 
       FROM daily_sales_v2 
       WHERE deleted_at IS NULL 
       AND payload ? 'finance_summary'
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (!result.rows.length) {
      return res.json({});
    }

    const financeSummary = result.rows[0].payload?.finance_summary;
    
    if (!financeSummary) {
      return res.json({});
    }

    return res.json(financeSummary);
  } catch (err) {
    console.error("Finance summary error:", err);
    return res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

router.get("/summary/today", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT payload 
       FROM daily_sales_v2 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (!result.rows.length) {
      return res.json({});
    }

    const payload = result.rows[0].payload || {};
    const financeSummary = payload.finance_summary;
    
    if (!financeSummary) {
      return res.json({});
    }

    // Create snapshot with key metrics
    const snapshot = {
      sales: financeSummary.sales || 0,
      netProfit: financeSummary.netProfit || 0,
      primeCostPct: financeSummary.primeCostPct || 0,
      topItem: null, // Could be extracted from POS data later
      varianceAlert: payload.balanced === false ? "Cash register not balanced" : null,
    };

    return res.json(snapshot);
  } catch (err) {
    console.error("Finance snapshot error:", err);
    return res.status(500).json({ error: "Failed to fetch finance snapshot" });
  }
});

// Manual trigger for finance calculations
router.post("/calculate", async (req, res) => {
  try {
    const { runDailyFinanceJob } = await import("../jobs/dailyFinanceJob");
    await runDailyFinanceJob();
    res.json({ ok: true, message: "Finance calculations updated" });
  } catch (err) {
    console.error("Finance calculation trigger error:", err);
    res.status(500).json({ error: "Failed to run finance calculations" });
  }
});

export default router;