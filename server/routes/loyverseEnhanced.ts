import { Router } from 'express';

const router = Router();
const disabled = {
  success: false,
  disabled: true,
  liveSourceOfTruth: 'sbb_pos_core',
  message: 'Loyverse live API is retired. Historical Loyverse data remains read-only.',
};

router.get('/enhanced/test-connection', (_req, res) => res.status(410).json(disabled));
router.post('/enhanced/manual-sync', (_req, res) => res.status(410).json(disabled));
router.post('/enhanced/process-shift', (_req, res) => res.status(410).json(disabled));
router.post('/enhanced/schedule/start', (_req, res) => res.status(410).json(disabled));
router.post('/enhanced/schedule/stop', (_req, res) => res.json({ ...disabled, success: true }));
router.get('/enhanced/status', (_req, res) => res.json({ isProcessing: false, isScheduled: false, disabled: true, source: 'sbb_pos_core' }));
router.get('/enhanced/history', (_req, res) => res.json([]));
router.get('/enhanced/validation-stats', (_req, res) => res.json({ disabled: true }));
router.post('/enhanced/validation-stats/reset', (_req, res) => res.json({ success: true, disabled: true }));
router.get('/enhanced/health', (_req, res) => res.json({ success: true, apiHealth: { isHealthy: false, disabled: true }, liveSourceOfTruth: 'sbb_pos_core' }));
router.get('/enhanced/analysis/:shiftDate', (_req, res) => res.status(410).json(disabled));
router.get('/enhanced/ingredient-usage/:shiftDate', (_req, res) => res.status(410).json(disabled));
router.get('/enhanced/anomalies/:shiftDate', (_req, res) => res.status(410).json(disabled));
router.get('/enhanced/staff-comparison/:shiftDate', (_req, res) => res.status(410).json(disabled));

export default router;
