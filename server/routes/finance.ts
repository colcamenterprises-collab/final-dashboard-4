import express from "express";
import { pool } from "../db";

const router = express.Router();

router.get("/summary", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT payload 
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC 
       LIMIT 1`
    );
    const financeSummary = result.rows[0]?.payload?.finance_summary;
    return res.json(financeSummary || {});
  } catch (err) {
    console.error("Finance summary error:", err);
    return res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

router.get("/summary/today", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT payload 
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC 
       LIMIT 1`
    );
    const payload = result.rows[0]?.payload || {};
    const fs = payload.finance_summary;
    if (!fs) return res.json({});
    
    res.json({
      sales: fs.sales || 0,
      netProfit: fs.netProfit || 0,
      primeCostPct: fs.primeCostPct || 0,
      directExpenses: fs.breakdown?.direct || 0,
      businessExpenses: fs.breakdown?.business || 0,
      stockExpenses: fs.breakdown?.stock || 0,
    });
  } catch (err) {
    console.error("Finance snapshot error:", err);
    return res.status(500).json({ error: "Failed to fetch finance snapshot" });
  }
});

export default router;