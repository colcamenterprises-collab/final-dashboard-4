import express from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      shiftDate,
      cashSales,
      qrSales,
      grabSales,
      aroiDeeSales,
      discounts,
      refunds,
      amountBanked,
      notes,
      expenses,
    } = req.body;

    const result = await prisma.dailySales.create({
      data: {
        shiftDate: new Date(shiftDate),
        cashSales: parseFloat(cashSales),
        qrSales: parseFloat(qrSales),
        grabSales: parseFloat(grabSales),
        aroiDeeSales: parseFloat(aroiDeeSales),
        discounts: parseFloat(discounts),
        refunds: parseFloat(refunds),
        amountBanked: parseFloat(amountBanked),
        notes,
        expenses,
      },
    });

    res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save sales form' });
  }
});

export default router;