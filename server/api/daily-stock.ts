import express from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

router.post('/', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      salesFormId,
      meatWeight,
      burgerBunsStock,
      drinkStock,
      freshFood,
      frozenFood,
      shelfItems,
      kitchenSupplies,
      packaging,
    } = req.body;

    if (!salesFormId) {
      return res.status(400).json({ error: 'Sales form ID is required' });
    }

    const result = await prisma.dailyStock.create({
      data: {
        salesFormId,
        meatWeight: parseInt(meatWeight) || 0,
        burgerBunsStock: parseInt(burgerBunsStock) || 0,
        drinkStock: drinkStock || {},
        freshFood: freshFood || {},
        frozenFood: frozenFood || {},
        shelfItems: shelfItems || {},
        kitchenSupplies: kitchenSupplies || {},
        packaging: packaging || {},
      },
    });

    res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error('[daily-stock] Error saving form:', err);
    res.status(500).json({ error: 'Failed to save stock form' });
  }
});

router.get('/:salesFormId', async (req, res) => {
  try {
    const { salesFormId } = req.params;
    
    const stockForm = await prisma.dailyStock.findUnique({
      where: { salesFormId },
      include: { salesForm: true },
    });

    if (!stockForm) {
      return res.status(404).json({ error: 'Stock form not found' });
    }

    res.status(200).json(stockForm);
  } catch (err) {
    console.error('[daily-stock] Error fetching form:', err);
    res.status(500).json({ error: 'Failed to fetch stock form' });
  }
});

export default router;