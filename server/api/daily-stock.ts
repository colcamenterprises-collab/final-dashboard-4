import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const router = express.Router();
const prisma = new PrismaClient();

function toInt(v: any, def = 0) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

// GET handler for retrieving stock forms
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.dailyStock.findMany({ 
      orderBy: { createdAt: 'desc' }, 
      take: 20 
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching stock forms:', error);
    return res.status(500).json({ error: 'Failed to fetch stock forms' });
  }
});

// POST handler for creating stock forms
router.post('/', async (req, res) => {
  try {
    const {
      salesFormId = null,
      meatGrams,
      burgerBuns,
      drinks = {},
      stockRequests = {},
    } = req.body || {};

    const data = {
      salesFormId: salesFormId || null,
      meatGrams: toInt(meatGrams),
      burgerBuns: toInt(burgerBuns),
      drinkStock: Object.fromEntries(Object.entries(drinks).map(([k, v]) => [k, toInt(v)])),
      stockRequests: Object.fromEntries(Object.entries(stockRequests).map(([k, v]) => [k, toInt(v)])),
      status: 'submitted' as const,
    };

    const saved = await prisma.dailyStock.create({ data });

    // Send combined email if linked to sales form
    if (salesFormId) {
      try {
        await fetch(`${process.env.PUBLIC_BASE_URL || 'http://localhost:5000'}/api/forms/${salesFormId}/email`, { method: 'POST' });
      } catch (e: any) {
        console.error('post-save email failed', e?.message || e);
      }
    }

    return res.status(200).json({ success: true, id: saved.id });
  } catch (err) {
    console.error('[daily-stock] save/email error', err);
    return res.status(500).json({ error: 'Failed to save stock submission' });
  }
});

export default router;