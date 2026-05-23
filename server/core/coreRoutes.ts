import { Router } from 'express';
import { getShiftDateForNow, SHIFT_WINDOW } from './shiftWindow';
import { getPosStatus } from './posStatusService';
import { getShiftVerification } from './shiftVerificationService';
import { getStockStatus } from './stockVarianceService';
import { getReconciliation } from './reconciliationService';
import { getAlerts } from './alertsService';

const router = Router();

router.get('/today', async (_req, res) => res.json({ shiftDate: getShiftDateForNow(), shiftWindow: SHIFT_WINDOW }));
router.get('/shift/:shiftDate', async (req, res) => res.json(await getShiftVerification(req.params.shiftDate)));
router.get('/stock-status/:shiftDate', async (req, res) => res.json(await getStockStatus(req.params.shiftDate)));
router.get('/reconciliation/:shiftDate', async (req, res) => res.json(await getReconciliation(req.params.shiftDate)));
router.get('/alerts', async (_req, res) => res.json(await getAlerts()));
router.get('/dashboard', async (_req, res) => {
  const shiftDate = getShiftDateForNow();
  const [pos, shift, alerts] = await Promise.all([getPosStatus(), getShiftVerification(shiftDate), getAlerts()]);
  res.json({ shiftDate, shiftWindow: SHIFT_WINDOW, pos, shift, alerts });
});

export default router;
