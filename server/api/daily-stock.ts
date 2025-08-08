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

    // Email only values > 0
    const posDrinks = Object.entries(data.drinkStock).filter(([, n]) => (n as number) > 0);
    const posReqs = Object.entries(data.stockRequests).filter(([, n]) => (n as number) > 0);

    const lines: string[] = [
      `Daily Stock Submission`,
      `Submitted: ${new Date(saved.createdAt).toLocaleString()}`,
      `Linked Sales ID: ${salesFormId || '-'}`,
      ``,
      `Counts`,
      `- Meat (g): ${data.meatGrams}`,
      `- Burger Buns: ${data.burgerBuns}`,
      ``,
      `Drinks (>0):`,
      ...(posDrinks.length ? posDrinks.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
      ``,
      `Stock Requests (>0):`,
      ...(posReqs.length ? posReqs.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
    ];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD 
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'smashbrothersburgersth@gmail.com',
      subject: `Daily Stock Submission ${new Date(saved.createdAt).toLocaleDateString()}`,
      text: lines.join('\n'),
    });

    return res.status(200).json({ success: true, id: saved.id });
  } catch (err) {
    console.error('[daily-stock] save/email error', err);
    return res.status(500).json({ error: 'Failed to save stock submission' });
  }
});

export default router;