import { Router } from 'express';
import { db } from '../lib/prisma.js';

const router = Router();
const prisma = db();

// SECURITY KEY
const EXPORT_KEY = process.env.EXPORT_KEY;

router.use((req, res, next) => {
  if (!EXPORT_KEY) {
    return res.status(500).json({ success: false, error: "EXPORT_KEY not set" });
  }
  if (req.query.key !== EXPORT_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
});

router.get('/daily-sales-v2', async (req, res) => {
  try {
    const data = await prisma.dailySalesV2.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/daily-stock-v2', async (req, res) => {
  try {
    const data = await prisma.dailyStockV2.findMany({
      orderBy: { createdAt: 'desc' },
      include: { sales: true }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pos/shift-reports', async (req, res) => {
  try {
    const data = await prisma.posShiftReport.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pos/receipts', async (req, res) => {
  try {
    const data = await prisma.posReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        modifiers: true
      }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const data = await prisma.expense.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
