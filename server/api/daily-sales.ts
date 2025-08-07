import express from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      completedBy,
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
      notes,
      totalSales,
      totalExpenses,
    } = req.body;

    const result = await prisma.dailySales.create({
      data: {
        completedBy,
        startingCash: parseFloat(startingCash) || 0,
        cashSales: parseFloat(cashSales) || 0,
        qrSales: parseFloat(qrSales) || 0,
        grabSales: parseFloat(grabSales) || 0,
        aroiDeeSales: parseFloat(aroiDeeSales) || 0,
        totalSales: parseFloat(totalSales) || 0,
        shopping,
        wages,
        totalExpenses: parseFloat(totalExpenses) || 0,
        closingCash: parseFloat(closingCash) || 0,
        cashBanked: parseFloat(cashBanked) || 0,
        qrTransferred: parseFloat(qrTransferred) || 0,
        amountBanked: parseFloat(amountBanked) || null,
        notes: notes || '',
      },
    });

    res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save sales form' });
  }
});

export default router;