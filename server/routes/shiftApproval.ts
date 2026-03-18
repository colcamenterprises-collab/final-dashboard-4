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
    // Payment breakdown from lv_receipt.payment_json (array of {name, amount})
    // Join via receipt_truth_line to get the date filter
    const payments = await pool.query(
      `SELECT pj->>'name' AS method_name, ROUND(SUM((pj->>'amount')::numeric),2) AS amount
       FROM lv_receipt r,
            jsonb_array_elements(COALESCE(r.payment_json, '[]'::jsonb)) AS pj
       WHERE r.receipt_id IN (
         SELECT DISTINCT receipt_id FROM receipt_truth_line
         WHERE receipt_date=$1::date AND receipt_type='SALE'
       )
       AND (r.raw_json->>'refund_for') IS NULL
       GROUP BY pj->>'name'`,
      [date]).catch(() => ({ rows: [] }));

    const payMap: Record<string, number> = {};
    for (const p of (payments as any).rows) {
      payMap[String(p.method_name || '').toLowerCase()] = Number(p.amount);
    }

    const posRow = posResult.rows[0] || {};
    const posData = {
      total: Number(posRow.total || 0),
      refunds: Number(posRow.refunds || 0),
      txn_count: Number(posRow.txn_count || 0),
      cash: payMap['cash'] ?? 0,
      qr: payMap['qr code'] ?? payMap['promptpay'] ?? payMap['qr'] ?? 0,
      grab: payMap['grab food'] ?? payMap['grab'] ?? 0,
      other: 0,
      source: 'receipt_truth_line',
    };
    // Compute other = total - cash - qr - grab
    posData.other = Math.max(0, posData.total - posData.cash - posData.qr - posData.grab - posData.refunds);

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
