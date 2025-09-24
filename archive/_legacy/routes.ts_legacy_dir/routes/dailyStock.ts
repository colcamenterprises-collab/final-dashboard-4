import { Router } from "express";
import { pool } from "../db";

const r = Router();

r.get("/", async (req, res) => {
  const { salesId } = req.query;
  
  if (!salesId) {
    return res.status(400).json({ error: "salesId query parameter is required" });
  }

  try {
    // Check if we have a DailyStock table and look for records related to this sales ID
    const stockRow = await pool.query(`
      SELECT * FROM "DailyStock" 
      WHERE "salesId" = $1 
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `, [salesId]);

    if (stockRow.rows.length === 0) {
      return res.status(404).json({ error: "Stock data not found for this sales record" });
    }

    res.json(stockRow.rows[0]);
  } catch (error: any) {
    console.error("Error fetching stock data:", error);
    // If DailyStock table doesn't exist, return 404
    if (error.code === '42P01') { // relation does not exist
      return res.status(404).json({ error: "Stock data not available" });
    }
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

export default r;