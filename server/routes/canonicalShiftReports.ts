import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";

const router = Router();

function ownerOnly(req: Request, res: Response, next: NextFunction) {
  attachSessionUser(req);
  const user = (req as any).user || getPinSessionUser(req);
  if (!user || user.role !== "owner") return res.status(403).json({ error: "Owner access required" });
  (req as any).user = user;
  next();
}

router.use(ownerOnly);

const n = (value: unknown) => Number(value ?? 0) || 0;
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

router.get("/history", async (req, res) => {
  try {
    if (!pool) throw new Error("Database unavailable");
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 365);
    const result = await pool.query(`
      WITH shifts AS (
        SELECT ps.*,
          CASE WHEN EXTRACT(HOUR FROM ps.opened_at AT TIME ZONE 'Asia/Bangkok') < 3
            THEN ((ps.opened_at AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day')::date
            ELSE (ps.opened_at AT TIME ZONE 'Asia/Bangkok')::date END AS shift_date
        FROM pos_shifts ps WHERE ps.status='closed'
        ORDER BY ps.opened_at DESC LIMIT $1
      ), forms AS (
        SELECT DISTINCT ON (COALESCE(shift_date,NULLIF("shiftDate",'')::date))
          COALESCE(shift_date,NULLIF("shiftDate",'')::date) AS shift_date, *
        FROM daily_sales_v2 WHERE "deletedAt" IS NULL
        ORDER BY COALESCE(shift_date,NULLIF("shiftDate",'')::date), "createdAt" DESC
      )      SELECT s.*, f.id AS form_id, f."completedBy", f.payload,
             COALESCE(f."cashSales", NULLIF(f.payload->>'cashSales','')::numeric, 0) AS form_cash,
             COALESCE(f."totalSales", NULLIF(f.payload->>'totalSales','')::numeric, 0) AS form_total,
             COALESCE(NULLIF(f.payload->'refunds'->>'totalAmount','')::numeric, 0) AS cash_refunds,
             COALESCE(m.paid_in,0) AS paid_in,
             COALESCE(m.paid_out,0) AS paid_out
      FROM shifts s
      LEFT JOIN forms f ON f.shift_date=s.shift_date
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE 0 END),0) paid_in,
               COALESCE(SUM(CASE WHEN movement_type='cash_out' THEN amount ELSE 0 END),0) paid_out
        FROM pos_shift_movements WHERE shift_id=s.id
      ) m ON true
      ORDER BY s.opened_at DESC`, [limit]);

    const reports = result.rows.map((row: any) => {
      const expenses = Array.isArray(row.payload?.expenses) ? row.payload.expenses : [];
      const wages = Array.isArray(row.payload?.wages) ? row.payload.wages : [];
      const expenseTotal = expenses.reduce((sum: number, item: any) => sum + n(item?.cost), 0);
      const wageTotal = wages.reduce((sum: number, item: any) => sum + n(item?.amount), 0);
      const paidOut = n(row.paid_out) || round(expenseTotal + wageTotal);
      const cashPayments = n(row.form_cash);
      const expectedCash = round(n(row.starting_float) + cashPayments + n(row.paid_in) - n(row.cash_refunds) - paidOut);
      const actualCash = n(row.closing_cash);
      const difference = round(actualCash - expectedCash);
      return {
        shiftId: row.id,
        shiftDate: row.shift_date,
        store: "Smash Bros Burgers (Rawai)",
        pos: "Smash Brothers - Rawai (Main POS)",
        openedAt: row.opened_at,
        openedBy: row.opened_by || row.staff_name,
        closedAt: row.closed_at,
        closedBy: row.closed_by || row.staff_name,
        cashierName: row.staff_name,
        startingCash: n(row.starting_float),
        cashPayments,
        cashRefunds: n(row.cash_refunds),
        paidIn: n(row.paid_in),
        paidOut,
        expectedCash,
        actualCash,
        difference,
        cashBanked: n(row.cash_banked),
        totalSales: n(row.form_total),        expenseTotal: round(expenseTotal),
        wageTotal: round(wageTotal),
        expenses: expenses.map((item: any) => ({ item: item?.item || "Expense", shop: item?.shop || null, category: item?.category || null, amount: n(item?.cost) })),
        wages: wages.map((item: any) => ({ staff: item?.staff || "Staff", type: item?.type || "WAGES", amount: n(item?.amount) })),
        balanceStatus: Math.abs(difference) <= 0.005 ? "BALANCED" : "VARIANCE",
        source: "SBB inbuilt POS + Daily Sales & Stock V2",
      };
    });

    res.json({ ok: true, source: "canonical_sbb_shift_report", reports });
  } catch (error: any) {
    console.error("[canonical-shift-reports]", error?.message);
    res.status(500).json({ ok: false, error: "Unable to load shift reports" });
  }
});

export default router;
