import { Router } from "express";
import { pool } from "../db";
import reportingUnifiedRouter from "./reportingUnified";
import { resolveExactReportingRange } from "../reporting/unifiedLedger";

const router = Router();
const n = (value: unknown) => Number(value ?? 0) || 0;

router.use("/unified", reportingUnifiedRouter);

router.get("/shift-review", async (req, res) => {
  try {
    if (!pool) throw new Error("Database unavailable");
    const range = resolveExactReportingRange({
      fromDate: String(req.query.fromDate || ""),
      fromTime: String(req.query.fromTime || ""),
      toDate: String(req.query.toDate || ""),
      toTime: String(req.query.toTime || ""),
      timezone: String(req.query.timezone || "Asia/Bangkok"),
    });

    const [posResult, formResult, shiftsResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN order_mode='direct' AND payment_method='cash' THEN total ELSE 0 END),0) cash_sales,
           COALESCE(SUM(CASE WHEN order_mode='direct' AND payment_method='manual_qr_transfer' THEN total ELSE 0 END),0) qr_sales,
           COALESCE(SUM(CASE WHEN order_mode='grab' OR payment_method='grab' THEN total ELSE 0 END),0) grab_sales,
           COALESCE(SUM(CASE WHEN NOT((order_mode='direct' AND payment_method IN('cash','manual_qr_transfer')) OR order_mode='grab' OR payment_method='grab') THEN total ELSE 0 END),0) other_sales,
           COUNT(*)::int receipt_count,
           COALESCE(SUM(total),0) total_sales
         FROM ordering_orders
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz
           AND status <> 'cancelled'
           AND payment_status='paid'`,
        [range.fromInstant, range.toInstant],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int form_count,
           COALESCE(SUM("cashSales"),0) cash_sales,
           COALESCE(SUM("qrSales"),0) qr_sales,
           COALESCE(SUM("grabSales"),0) grab_sales,
           COALESCE(SUM("aroiSales"),0) other_sales,
           COALESCE(SUM("totalSales"),0) total_sales
         FROM daily_sales_v2
         WHERE "deletedAt" IS NULL
           AND ((COALESCE("shiftDate"::date,shift_date) + time '17:00') AT TIME ZONE 'Asia/Bangkok') >= $1::timestamptz
           AND ((COALESCE("shiftDate"::date,shift_date) + time '17:00') AT TIME ZONE 'Asia/Bangkok') < $2::timestamptz`,
        [range.fromInstant, range.toInstant],
      ),
      pool.query(
        `SELECT id,staff_name,opened_at,closed_at,status
         FROM pos_shifts
         WHERE opened_at < $2::timestamptz
           AND COALESCE(closed_at,NOW()) > $1::timestamptz
         ORDER BY opened_at`,
        [range.fromInstant, range.toInstant],
      ),
    ]);

    const pos = posResult.rows[0] || {};
    const forms = formResult.rows[0] || {};
    const formCount = n(forms.form_count);
    const row = (key: string, label: string, posValue: unknown, formValue: unknown) => {
      const pv = n(posValue);
      const fv = formCount ? n(formValue) : null;
      const delta = fv == null ? null : Number((pv - fv).toFixed(2));
      return { key, label, pos: pv, dailySales: fv, delta, status: fv == null ? "missing" : Math.abs(delta) <= 0.01 ? "match" : "flag" };
    };
    const rows = [
      row("cashSales", "Cash Sales (฿)", pos.cash_sales, forms.cash_sales),
      row("qrSales", "QR / Scan Sales (฿)", pos.qr_sales, forms.qr_sales),
      row("grabSales", "Grab Sales (฿)", pos.grab_sales, forms.grab_sales),
      row("otherSales", "Other Sales (฿)", pos.other_sales, forms.other_sales),
      row("totalSales", "Total Sales (฿)", pos.total_sales, forms.total_sales),
    ];

    res.json({
      ok: true,
      source: "sbb_pos_core_vs_daily_sales_v2",
      filters: range,
      shiftCount: shiftsResult.rowCount || 0,
      shifts: shiftsResult.rows,
      pos: { receiptCount: n(pos.receipt_count), totalSales: n(pos.total_sales) },
      dailySales: { formCount, totalSales: formCount ? n(forms.total_sales) : null },
      rows,
      allMatched: formCount > 0 && rows.every(item => item.status === "match"),
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "sbb_pos_core_vs_daily_sales_v2", error: error.message });
  }
});

export default router;
