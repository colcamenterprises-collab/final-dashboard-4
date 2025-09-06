// 🚫 LEGACY ENDPOINT — DO NOT USE
// Archived. Use server/forms/dailySalesV2.ts instead.

import express from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

router.post('/', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      completedBy,
      createdAt,
      startingCash,
      cashSales,
      qrSales,
      grabSales,
      aroiDeeSales,
      shopping,
      wages,
      closingCash,
      cashBanked,
      qrTransferred,
      amountBanked,
      totalSales,
      totalExpenses,
      notes,
    } = req.body;

    // Create the basic daily sales record with just the fields sent from Form 1
    const result = await prisma.dailySales.create({
      data: {
        completedBy: req.body.completedBy,
        shiftDate: req.body.shiftDate ? new Date(req.body.shiftDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
        startingCash: Math.round(parseFloat(req.body.cashStart || 0) * 100),
        cashSales: Math.round(parseFloat(req.body.cashSales || 0) * 100),
        qrSales: Math.round(parseFloat(req.body.qrSales || 0) * 100),
        grabSales: Math.round(parseFloat(req.body.grabSales || 0) * 100),
        aroiSales: Math.round(parseFloat(req.body.aroiDeeSales || 0) * 100),
        totalSales: Math.round(parseFloat(req.body.totalSales || 0) * 100),
        status: 'submitted'
      },
    });

    res.status(200).json({ ok: true, shiftId: result.id });
  } catch (err) {
    console.error('[daily-sales] Error saving form:', err);
    res.status(500).json({ error: 'Failed to save form' });
  }
});

export default router;