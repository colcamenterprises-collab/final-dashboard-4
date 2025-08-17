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

    const result = await prisma.dailySales.create({
      data: {
        completedBy,
        shiftDate: req.body.shiftDate ? new Date(req.body.shiftDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
        startingCash: Math.round(parseFloat(startingCash) * 100) || 0,
        cashSales: Math.round(parseFloat(cashSales) * 100) || 0,
        qrSales: Math.round(parseFloat(qrSales) * 100) || 0,
        grabSales: Math.round(parseFloat(grabSales) * 100) || 0,
        aroiSales: Math.round(parseFloat(aroiDeeSales) * 100) || 0,
        totalSales: Math.round(parseFloat(totalSales) * 100) || 0,
        totalExpenses: Math.round(parseFloat(totalExpenses) * 100) || 0,
        closingCash: Math.round(parseFloat(closingCash) * 100) || 0,
        cashBanked: Math.round(parseFloat(cashBanked) * 100) || 0,
        qrTransfer: Math.round(parseFloat(qrTransferred) * 100) || 0,
        notes: notes || null,
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