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
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        startingCash: parseFloat(startingCash) || 0,
        cashSales: parseFloat(cashSales) || 0,
        qrSales: parseFloat(qrSales) || 0,
        grabSales: parseFloat(grabSales) || 0,
        aroiDeeSales: parseFloat(aroiDeeSales) || 0,
        totalSales: parseFloat(totalSales) || 0,
        shoppingExpenses: shopping || [],
        wages: wages || [],
        totalExpenses: parseFloat(totalExpenses) || 0,
        closingCash: parseFloat(closingCash) || 0,
        cashBanked: parseFloat(cashBanked) || 0,
        qrTransferred: parseFloat(qrTransferred) || 0,
        amountBanked: parseFloat(amountBanked) || 0,
        notes: notes || '',
      },
    });

    res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error('[daily-sales] Error saving form:', err);
    res.status(500).json({ error: 'Failed to save form' });
  }
});

export default router;