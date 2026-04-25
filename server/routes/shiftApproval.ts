import { Router } from 'express';
import {
  approveShiftAndPostFinancials,
  getDailySalesFormNormalized,
  getPnlForPeriod,
  getShiftSnapshot,
  listShiftSnapshots,
  upsertFormSnapshot,
} from '../services/shiftApprovalService';
import { storeShiftSnapshot, fetchShiftReport } from '../services/loyverseService';
import { pool } from '../db';

function classifyPaymentByName(name: string): 'cash' | 'qr' | 'grab' | 'other' {
  const key = String(name).toLowerCase();
  if (key.includes('cash')) return 'cash';
  if (key.includes('qr') || key.includes('promptpay') || key.includes('transfer')) return 'qr';
  if (key.includes('grab')) return 'grab';
  return 'other';
}


const router = Router();

function attachAuth(req: any, _res: any, next: any) {
  req.userRole = String(req.headers['x-user-role'] || 'admin');
  req.userId = String(req.headers['x-user-id'] || 'dashboard');
  next();
}

function requireManager(req: any, res: any, next: any) {
  const role = String(req.userRole || req.headers['x-user-role'] || '');
  if (role !== 'manager' && role !== 'admin') {
    return res.status(403).json({ error: 'Manager role required' });
  }
  next();
}

router.use(attachAuth);

router.get('/pos-shift/:date', async (req, res) => {
  const date = req.params.date;
  try {
    // Primary: ShiftSnapshot (pre-computed, set via /sync or approval)
    const snapshot = await getShiftSnapshot(date);
    if (snapshot?.pos_data && Object.keys(snapshot.pos_data).length > 0) {
      return res.json({ ...snapshot.pos_data, source: 'snapshot' });
    }

    // Fallback tier 1: call Loyverse API directly for authoritative shift report data.
    // This gives correct cash_payments, paid_out/expenses, and classifies payments by name
    // (so QR codes, Grab etc. are correctly bucketed regardless of lv_receipt type field).
    //
    // Shift date vs receipt date: shifts open at 17:00 BKK and can close after midnight,
    // so receipts for a shift opened on day D may be stored under receipt_date = D+1.
    // We try the given date first; if the shift report comes back empty we try D-1
    // (the shift that opened the evening before and closed in the early hours of `date`).
    try {
      let report = await fetchShiftReport(date);

      // If the shift-window for `date` returned nothing, try the previous calendar day
      // (covers the common case where receipt_date is the close-date of an overnight shift)
      if (report.total === 0) {
        const { DateTime: DT } = await import('luxon');
        const prevDate = DT.fromISO(date, { zone: 'Asia/Bangkok' })
          .minus({ days: 1 })
          .toFormat('yyyy-MM-dd');
        const prevReport = await fetchShiftReport(prevDate);
        if (prevReport.total > 0) {
          report = prevReport;
        }
      }

      let txn_count = 0;
      if (pool) {
        const txnResult = await pool.query(
          `SELECT COUNT(DISTINCT receipt_id)::int AS txn_count
           FROM receipt_truth_line WHERE receipt_date=$1::date AND receipt_type='SALE'`,
          [date]).catch(() => ({ rows: [] }));
        txn_count = Number((txnResult as any).rows[0]?.txn_count || 0);
      }
      return res.json({ ...report, txn_count, source: 'loyverse_api' });
    } catch (apiErr) {
      console.warn('[pos-shift] Loyverse API call failed, falling back to receipt_truth_line:', (apiErr as Error)?.message);
    }

    // Fallback tier 2: derive from receipt_truth_line + lv_receipt (offline / no token).
    // Uses payment method NAME for classification so QR codes are not mis-bucketed as Grab.
    if (!pool) return res.json({});
    const posResult = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN receipt_type='SALE' THEN COALESCE(net_amount,0) ELSE 0 END)::numeric, 2) AS total,
         ROUND(SUM(CASE WHEN receipt_type='REFUND' THEN ABS(COALESCE(net_amount,0)) ELSE 0 END)::numeric, 2) AS refunds,
         COUNT(DISTINCT CASE WHEN receipt_type='SALE' THEN receipt_id END)::int AS txn_count
       FROM receipt_truth_line WHERE receipt_date=$1::date`,
      [date]);

    const payments = await pool.query(
      `SELECT pj->>'name' AS method_name,
              ROUND(SUM((pj->>'money_amount')::numeric),2) AS amount
       FROM lv_receipt r,
            jsonb_array_elements(COALESCE(r.payment_json, '[]'::jsonb)) AS pj
       WHERE r.receipt_id IN (
         SELECT DISTINCT receipt_id FROM receipt_truth_line
         WHERE receipt_date=$1::date AND receipt_type='SALE'
       )
       GROUP BY pj->>'name'`,
      [date]).catch(() => ({ rows: [] }));

    const payRows = (payments as any).rows;
    const paymentBreakdownAvailable = payRows.length > 0;

    // Classify by method name — not type — so "SCAN (QR Code)" → qr, "GRAB" → grab
    const buckets: Record<string, number> = { cash: 0, qr: 0, grab: 0, other: 0 };
    for (const p of payRows) {
      const bucket = classifyPaymentByName(String(p.method_name || ''));
      buckets[bucket] = (buckets[bucket] || 0) + Number(p.amount);
    }

    const posRow = posResult.rows[0] || {};
    const total = Number(posRow.total || 0);
    const refunds = Number(posRow.refunds || 0);

    const posData: Record<string, any> = {
      total,
      refunds,
      txn_count: Number(posRow.txn_count || 0),
      payment_breakdown_available: paymentBreakdownAvailable,
      source: 'receipt_truth_line',
    };

    if (paymentBreakdownAvailable) {
      posData.cash = buckets.cash;
      posData.qr = buckets.qr;
      posData.grab = buckets.grab;
      posData.other = buckets.other;
    } else {
      posData.cash = null;
      posData.qr = null;
      posData.grab = null;
      posData.other = null;
      posData.payment_breakdown_note = 'lv_receipt not synced for this date';
    }

    // Add expenses from the loyverse_shifts cache (paid_out) when API is unavailable.
    // Try the given date first; if no shift data, try the previous day (overnight shift).
    const expQuery = `
      SELECT COALESCE((data->'shifts'->0->>'paid_out')::numeric, 0) AS exp,
             COALESCE((data->'shifts'->0->>'cash_payments')::numeric, 0) AS cash_from_shift
      FROM loyverse_shifts
      WHERE shift_date = $1::date
      LIMIT 1`;
    const expRow = await pool.query(expQuery, [date]).then((r: any) => r.rows[0]).catch(() => null);
    if (expRow) {
      posData.exp = Number(expRow.exp || 0);
      posData.exp_cash = Number(expRow.exp || 0);
    } else {
      posData.exp = 0;
      posData.exp_cash = 0;
    }

    return res.json(posData);
  } catch (error) {
    console.error('[shiftApproval.pos-shift] error', error);
    res.status(500).json({ error: 'Failed to fetch POS shift data' });
  }
});


router.post('/pos-shift/:date/sync', requireManager, async (req, res) => {
  try {
    await storeShiftSnapshot(req.params.date);
    const snapshot = await getShiftSnapshot(req.params.date);
    res.json({ success: true, pos_data: snapshot?.pos_data ?? {} });
  } catch (error) {
    console.error('[shiftApproval.pos-shift-sync] error', error);
    res.status(500).json({ error: 'Failed to sync POS shift data' });
  }
});

router.get('/daily-sales-v2/:date', async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date parameter. Expected YYYY-MM-DD.' });
  }
  try {
    const normalized = await getDailySalesFormNormalized(date);
    await upsertFormSnapshot(date, normalized);
    res.json(normalized);
  } catch (error) {
    console.error('[shiftApproval.daily-sales-v2] error', error);
    res.status(500).json({ error: 'Failed to fetch daily sales form data' });
  }
});

router.post('/approve-shift', requireManager, async (req: any, res) => {
  try {
    const { date, cash_banked, qr_banked, notes } = req.body || {};
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    await approveShiftAndPostFinancials({
      date,
      cashBanked: Number(cash_banked ?? 0),
      qrBanked: Number(qr_banked ?? 0),
      notes: String(notes ?? ''),
      completedBy: String(req.userId || 'unknown'),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[shiftApproval.approve-shift] error', error);
    res.status(500).json({ error: 'Failed to approve shift' });
  }
});

router.get('/shift-snapshots', async (_req, res) => {
  try {
    const rows = await listShiftSnapshots();
    res.json(rows);
  } catch (error) {
    console.error('[shiftApproval.shift-snapshots] error', error);
    res.status(500).json({ error: 'Failed to list shift snapshots' });
  }
});


router.get('/latest-valid-shift', async (_req, res) => {
  try {
    const snapshots = await listShiftSnapshots();
    const validSnapshot = snapshots.find((row: any) => {
      const posTotal = Number(row?.pos_data?.total ?? 0);
      const formTotal = Number(row?.form_data?.total ?? 0);
      return posTotal > 0 || formTotal > 0;
    });

    if (validSnapshot?.date) {
      return res.json({
        ok: true,
        date: validSnapshot.date,
        source: 'shift-snapshots',
      });
    }

    if (!pool) {
      return res.status(404).json({ ok: false, error: 'No valid shift found' });
    }

    const fallbackResult = await pool.query(
      `
        WITH candidate_dates AS (
          SELECT shift_date::date AS shift_date, 'daily_sales_v2'::text AS source
          FROM daily_sales_v2
          WHERE shift_date IS NOT NULL
          UNION ALL
          SELECT receipt_date::date AS shift_date, 'receipt_truth_line'::text AS source
          FROM receipt_truth_line
          WHERE receipt_date IS NOT NULL
        )
        SELECT shift_date::text AS date, source
        FROM candidate_dates
        WHERE shift_date < CURRENT_DATE
        ORDER BY shift_date DESC,
                 CASE source
                   WHEN 'receipt_truth_line' THEN 1
                   WHEN 'daily_sales_v2' THEN 2
                   ELSE 9
                 END ASC
        LIMIT 1
      `,
    );

    const fallback = fallbackResult.rows[0];
    if (!fallback?.date) {
      return res.status(404).json({ ok: false, error: 'No valid shift found' });
    }

    return res.json({
      ok: true,
      date: fallback.date,
      source: fallback.source,
    });
  } catch (error) {
    console.error('[shiftApproval.latest-valid-shift] error', error);
    res.status(500).json({ error: 'Failed to resolve latest valid shift' });
  }
});

router.get('/pnl/:period', async (req, res) => {
  try {
    const data = await getPnlForPeriod(req.params.period);
    res.json(data);
  } catch (error: any) {
    console.error('[shiftApproval.pnl] error', error);
    res.status(400).json({ error: error?.message || 'Failed to compute P&L' });
  }
});

export default router;
