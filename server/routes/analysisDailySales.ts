import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

interface DailySalesRow {
  id: string;
  shift_date: string;
  completed_by: string;
  total_sales: number;
  cash_sales: number;
  qr_sales: number;
  grab_sales: number;
  other_sales: number;
  shopping_total: number;
  wages_total: number;
  others_total: number;
  total_expenses: number;
  rolls_end: number;
  meat_end_g: number;
  expected_cash_bank?: number;
  expected_qr_bank?: number;
  expected_total_bank?: number;
  payload?: any;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    // K-4.4: Accept month parameter to filter by selected month
    const month = req.query.month as string | undefined;
    
    let result;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      // K-4.4: Filter by month (YYYY-MM)
      // shiftDate is TEXT column with ISO format - use prefix matching
      const monthPrefix = `${month}%`;  // e.g., "2025-11%"
      console.log(`[K-4.4] Filtering daily-sales by month: ${month}, prefix: ${monthPrefix}`);
      
      result = await pool.query(`
        SELECT 
          id,
          "shiftDate" as shift_date,
          "completedBy" as completed_by,
          payload
        FROM daily_sales_v2
        WHERE "shiftDate" LIKE $1
        ORDER BY "shiftDate" DESC
      `, [monthPrefix]);
    } else {
      // Return all data (backwards compatible)
      result = await pool.query(`
        SELECT 
          id,
          "shiftDate" as shift_date,
          "completedBy" as completed_by,
          payload
        FROM daily_sales_v2
        ORDER BY "shiftDate" DESC
      `);
    }

    const rows: DailySalesRow[] = result.rows.map((row: any) => {
      const p = row.payload || {};
      const b = (p.bankingAuto) ? p.bankingAuto : {};
      
      const shopping = Array.isArray(p.expenses) 
        ? p.expenses.reduce((sum: number, e: any) => sum + (Number(e.cost) || 0), 0) 
        : 0;
      const wages = Array.isArray(p.wages) 
        ? p.wages.reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0) 
        : 0;
      const others = 0;

      return {
        id: row.id,
        shift_date: row.shift_date,
        completed_by: row.completed_by,
        total_sales: Number(p.totalSales || 0),
        cash_sales: Number(p.cashSales || 0),
        qr_sales: Number(p.qrSales || 0),
        grab_sales: Number(p.grabSales || 0),
        other_sales: Number(p.otherSales || p.aroiSales || 0),
        shopping_total: shopping,
        wages_total: wages,
        others_total: others,
        total_expenses: shopping + wages + others,
        rolls_end: Number(p.rollsEnd || 0),
        meat_end_g: Number(p.meatEnd || 0),
        expected_cash_bank: Number(b.expectedCashBank || 0),
        expected_qr_bank: Number(b.expectedQRBank || 0),
        expected_total_bank: Number(b.expectedTotalBank || 0),
      };
    });

    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching daily sales analysis:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/export.csv", async (req: Request, res: Response) => {
  try {
    const { date, id } = req.query;
    
    let result;
    if (id) {
      result = await pool.query(`
        SELECT id, "shiftDate" as shift_date, "completedBy" as completed_by, payload
        FROM daily_sales_v2
        WHERE id = $1
      `, [id]);
    } else if (date) {
      result = await pool.query(`
        SELECT id, "shiftDate" as shift_date, "completedBy" as completed_by, payload
        FROM daily_sales_v2
        WHERE "shiftDate" = $1
      `, [date]);
    } else {
      result = await pool.query(`
        SELECT id, "shiftDate" as shift_date, "completedBy" as completed_by, payload
        FROM daily_sales_v2
        ORDER BY "shiftDate" DESC
      `);
    }

    const rows = result.rows.map((row: any) => {
      const p = row.payload || {};
      const b = (p.bankingAuto) ? p.bankingAuto : {};
      
      const shopping = Array.isArray(p.expenses) 
        ? p.expenses.reduce((sum: number, e: any) => sum + (Number(e.cost) || 0), 0) 
        : 0;
      const wages = Array.isArray(p.wages) 
        ? p.wages.reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0) 
        : 0;

      return {
        shift_date: row.shift_date,
        completed_by: row.completed_by,
        total_sales: Number(p.totalSales || 0),
        cash_sales: Number(p.cashSales || 0),
        qr_sales: Number(p.qrSales || 0),
        grab_sales: Number(p.grabSales || 0),
        other_sales: Number(p.otherSales || p.aroiSales || 0),
        expected_cash_bank: Number(b.expectedCashBank || 0),
        expected_qr_bank: Number(b.expectedQRBank || 0),
        expected_total_bank: Number(b.expectedTotalBank || 0),
        shopping_total: shopping,
        wages_total: wages,
        total_expenses: shopping + wages,
        rolls_end: Number(p.rollsEnd || 0),
        meat_end_g: Number(p.meatEnd || 0),
      };
    });

    const headers = [
      "Date","Completed By","Total","Cash","QR","Grab","Other (Sales)",
      "Exp Cash","Exp QR","Exp Total",
      "Shopping","Wages","Tot Exp","Rolls","Meat (g)"
    ];
    
    const csvRows = rows.map((row: any) => [
      row.shift_date,
      row.completed_by,
      row.total_sales,
      row.cash_sales,
      row.qr_sales,
      row.grab_sales,
      row.other_sales,
      row.expected_cash_bank,
      row.expected_qr_bank,
      row.expected_total_bank,
      row.shopping_total,
      row.wages_total,
      row.total_expenses,
      row.rolls_end,
      row.meat_end_g
    ]);

    const csv = [headers, ...csvRows].map(r => r.join(",")).join("\n");
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="daily-sales-${date || id || 'all'}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
