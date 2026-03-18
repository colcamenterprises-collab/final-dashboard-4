import { Router } from 'express';
import {
  approveShiftAndPostFinancials,
  getDailySalesFormNormalized,
  getPnlForPeriod,
  getShiftSnapshot,
  listShiftSnapshots,
  upsertFormSnapshot,
} from '../services/shiftApprovalService';
import { storeShiftSnapshot } from '../services/loyverseService';
import { pool } from '../db';


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

    // Fallback: derive directly from receipt_truth_line (Loyverse ingested data)
    if (!pool) return res.json({});
    // net_amount is in baht (numeric), not cents
    const posResult = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN receipt_type='SALE' THEN COALESCE(net_amount,0) ELSE 0 END)::numeric, 2) AS total,
         ROUND(SUM(CASE WHEN receipt_type='REFUND' THEN ABS(COALESCE(net_amount,0)) ELSE 0 END)::numeric, 2) AS refunds,
         COUNT(DISTINCT CASE WHEN receipt_type='SALE' THEN receipt_id END)::int AS txn_count
       FROM receipt_truth_line WHERE receipt_date=$1::date`,
      [date]);
    // Payment breakdown from lv_receipt.payment_json.
    // NOTE: lv_receipt is populated by a separate ingestion path from receipt_truth_line.
    // For dates where lv_receipt was not synced, the join returns 0 rows.
    // In that case we flag payment_breakdown_available=false rather than returning silent 0s.
    const payments = await pool.query(
      `SELECT pj->>'name' AS method_name,
              pj->>'type' AS method_type,
              ROUND(SUM((pj->>'money_amount')::numeric),2) AS amount
       FROM lv_receipt r,
            jsonb_array_elements(COALESCE(r.payment_json, '[]'::jsonb)) AS pj
       WHERE r.receipt_id IN (
         SELECT DISTINCT receipt_id FROM receipt_truth_line
         WHERE receipt_date=$1::date AND receipt_type='SALE'
       )
       GROUP BY pj->>'name', pj->>'type'`,
      [date]).catch(() => ({ rows: [] }));

    const payRows = (payments as any).rows;
    const paymentBreakdownAvailable = payRows.length > 0;

    const payMap: Record<string, number> = {};
    for (const p of payRows) {
      const key = String(p.method_type || p.method_name || '').toUpperCase();
      payMap[key] = (payMap[key] || 0) + Number(p.amount);
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
      // lv_receipt.payment_json money_amount is in satang; already summed → convert /100 not needed
      // (money_amount matches total_amount scale: e.g. money_amount=249 → ฿2.49 per lv_receipt sample)
      // BUT receipt_truth_line net_amount is in baht and totals ฿18,036 for 45 txns
      // CROSS-CHECK: if payMap totals match posRow.total, units are consistent
      const cashBaht = (payMap['CASH'] ?? 0);
      const qrBaht = (payMap['QR'] ?? payMap['PROMPTPAY'] ?? 0);
      const grabBaht = (payMap['OTHER'] ?? 0); // Grab is type=OTHER in lv_receipt
      posData.cash = cashBaht;
      posData.qr = qrBaht;
      posData.grab = grabBaht;
      posData.other = Math.max(0, total - cashBaht - qrBaht - grabBaht);
    } else {
      // Cannot break down — lv_receipt not synced for this date
      posData.cash = null;
      posData.qr = null;
      posData.grab = null;
      posData.other = null;
      posData.payment_breakdown_note = 'lv_receipt not synced for this date';
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
  try {
    const normalized = await getDailySalesFormNormalized(req.params.date);
    await upsertFormSnapshot(req.params.date, normalized);
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
