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
  try {
    const snapshot = await getShiftSnapshot(req.params.date);
    res.json(snapshot?.pos_data ?? {});
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
