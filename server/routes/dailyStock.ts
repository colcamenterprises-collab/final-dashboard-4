import { Router } from "express";
import { pool } from "../db";

const r = Router();

r.get("/", async (req, res) => {
  const { salesId } = req.query;

  if (!salesId) {
    return res.json({ ok: true, source: "daily_stock_v2", rows: [], blockers: [{ code: "MISSING_SALES_ID", message: "salesId query parameter is required for record lookup", where: "/api/daily-stock", canonical_source: "daily_stock_v2", auto_build_attempted: false }] });
  }

  try {
    const stockRow = await pool.query(`
      SELECT * FROM daily_stock_v2
      WHERE "salesId" = $1
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [salesId]);

    if (stockRow.rows.length === 0) {
      return res.json({ ok: true, source: "daily_stock_v2", rows: [], blockers: [{ code: "STOCK_DATA_NOT_FOUND", message: "Stock data not found for this sales record", where: "/api/daily-stock", canonical_source: "daily_stock_v2", auto_build_attempted: false }] });
    }

    res.json({ ok: true, source: "daily_stock_v2", data: stockRow.rows[0], rows: stockRow.rows });
  } catch (error: any) {
    console.error("Error fetching stock data:", error);
    // If DailyStock table doesn't exist, return 404
    if (error.code === '42P01') { // relation does not exist
      return res.json({ ok: false, source: "daily_stock_v2", rows: [], blockers: [{ code: "MISSING_DAILY_STOCK_SOURCE", message: "daily_stock_v2 table not available", where: "/api/daily-stock", canonical_source: "daily_stock_v2", auto_build_attempted: false }] });
    }
    res.status(200).json({ ok: false, source: "daily_stock_v2", rows: [], blockers: [{ code: "DAILY_STOCK_READ_FAILED", message: error?.message || "Failed to fetch stock data", where: "/api/daily-stock", canonical_source: "daily_stock_v2", auto_build_attempted: false }] });
  }
});

export default r;
