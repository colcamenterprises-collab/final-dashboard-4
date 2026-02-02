import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/:id/variance-history", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.execute(sql`
      SELECT 
        date,
        waste_percentage,
        variance_amount
      FROM stock_variance_log
      WHERE ingredient_id = ${id}
        AND date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC
      LIMIT 7
    `);

    const rows = result.rows as Array<{ date: string; waste_percentage: number; variance_amount: number }>;

    if (rows.length === 0) {
      const mockWaste = 3 + Math.random() * 9;
      return res.json({
        ingredientId: id,
        avgWastePct: Number(mockWaste.toFixed(1)),
        dataPoints: 0,
        source: "mock"
      });
    }

    const avgWaste = rows.reduce((sum, r) => sum + (r.waste_percentage || 0), 0) / rows.length;

    res.json({
      ingredientId: id,
      avgWastePct: Number(avgWaste.toFixed(1)),
      dataPoints: rows.length,
      source: "database",
      history: rows
    });
  } catch (error: any) {
    const mockWaste = 3 + Math.random() * 9;
    res.json({
      ingredientId: req.params.id,
      avgWastePct: Number(mockWaste.toFixed(1)),
      dataPoints: 0,
      source: "mock-fallback",
      error: error.message
    });
  }
});

export default router;
