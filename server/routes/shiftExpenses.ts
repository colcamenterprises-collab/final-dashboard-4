import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

interface ShiftExpenseLineItem {
  date: string;
  supplier: string;
  category: string;
  description: string;
  amount: number;
  shiftDate: string;
}

// GET /api/shift-expenses - Extract individual expense line items from Daily Sales & Stock forms
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Default to current month if not specified
    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    
    // Fetch all Daily Sales & Stock forms for the specified month
    const { rows } = await db.execute(sql`
      SELECT 
        "shiftDate",
        payload,
        "createdAt"
      FROM daily_sales_v2
      WHERE payload IS NOT NULL
        AND EXTRACT(YEAR FROM TO_DATE("shiftDate", 'YYYY-MM-DD')) = ${targetYear}
        AND EXTRACT(MONTH FROM TO_DATE("shiftDate", 'YYYY-MM-DD')) = ${targetMonth}
      ORDER BY "shiftDate" DESC
    `);
    
    const lineItems: ShiftExpenseLineItem[] = [];
    
    // Extract individual line items from each form
    for (const row of rows) {
      const payload = row.payload as any;
      const shiftDate = row.shiftDate as string;
      
      // Extract shopping expenses
      if (payload.expenses && Array.isArray(payload.expenses)) {
        for (const expense of payload.expenses) {
          lineItems.push({
            date: shiftDate,
            supplier: String(expense.shop || 'Unknown'),
            category: 'Shopping',
            description: String(expense.item || 'Unknown Item'),
            amount: Number(expense.cost || 0),
            shiftDate: shiftDate
          });
        }
      }
      
      // Extract wage expenses
      if (payload.wages && Array.isArray(payload.wages)) {
        for (const wage of payload.wages) {
          lineItems.push({
            date: shiftDate,
            supplier: 'Staff Wages',
            category: 'Wages',
            description: `${String(wage.staff || 'Unknown')} (Wages)`,
            amount: Number(wage.amount || 0),
            shiftDate: shiftDate
          });
        }
      }
    }
    
    return res.json(lineItems);
    
  } catch (error) {
    console.error('Shift expenses error:', error);
    return res.status(500).json({ error: 'Failed to fetch shift expenses' });
  }
});

export default router;
