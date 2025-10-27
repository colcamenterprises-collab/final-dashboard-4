import { Router } from 'express';

export const adminTestEmailRouter = Router();

adminTestEmailRouter.post('/api/admin/test-daily-email', async (req, res) => {
  try {
    const { cronEmailService } = await import('../services/cronEmailService');
    const service = new cronEmailService.constructor();
    await service.sendDailyReviewEmail();
    res.json({ success: true, message: 'Daily Review email sent' });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
