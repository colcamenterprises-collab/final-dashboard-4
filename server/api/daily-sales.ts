import express from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      shiftDate,
      completedBy,
      startingCash,
      cashSales,
      qrSales,
      grabSales,
      aroiDeeSales,
      discounts,
      refunds,
      amountBanked,
      notes,
      shoppingExpenses,
      wageExpenses,
    } = req.body;

    const result = await prisma.dailySales.create({
      data: {
        shiftDate: new Date(shiftDate),
        completedBy,
        startingCash: parseFloat(startingCash),
        cashSales: parseFloat(cashSales) || 0,
        qrSales: parseFloat(qrSales) || 0,
        grabSales: parseFloat(grabSales) || 0,
        aroiDeeSales: parseFloat(aroiDeeSales) || 0,
        discounts: parseFloat(discounts) || 0,
        refunds: parseFloat(refunds) || 0,
        amountBanked: parseFloat(amountBanked) || 0,
        notes: notes || '',
        shoppingExpenses,
        wageExpenses,
      },
    });

    res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save sales form' });
  }
});

export default router;