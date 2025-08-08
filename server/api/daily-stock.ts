import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const router = express.Router();
const prisma = new PrismaClient();

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

router.post('/', async (req, res) => {
  try {
    const { salesFormId, meatGrams, burgerBuns, drinks, stockRequests } = req.body;

    // Save to DailyStock
    const stockForm = await prisma.dailyStock.create({
      data: {
        salesFormId: salesFormId || null,
        meatGrams: parseInt(meatGrams) || 0,
        burgerBuns: parseInt(burgerBuns) || 0,
        drinkStock: drinks || {},
        stockRequests: stockRequests || {},
      },
    });

    // Build email summary
    let emailBody = 'Daily Stock Form Submission\n\n';
    emailBody += `Meat: ${meatGrams} grams\n`;
    emailBody += `Burger Buns: ${burgerBuns}\n\n`;

    // Drinks with quantity > 0
    emailBody += 'DRINKS:\n';
    Object.entries(drinks || {}).forEach(([drink, qty]) => {
      if (qty > 0) {
        emailBody += `${drink}: ${qty}\n`;
      }
    });

    // Stock requests with quantity > 0
    emailBody += '\nSTOCK REQUESTS:\n';
    Object.entries(stockRequests || {}).forEach(([item, qty]) => {
      if (qty > 0) {
        emailBody += `${item}: ${qty}\n`;
      }
    });

    // Send email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'smashbrothersburgersth@gmail.com',
      subject: `Daily Stock Form - ${new Date().toLocaleDateString()}`,
      text: emailBody,
    });

    res.json({ success: true, id: stockForm.id });
  } catch (error) {
    console.error('Error saving stock form:', error);
    res.status(500).json({ error: 'Failed to save stock form' });
  }
});

// Get stock forms for library
router.get('/', async (req, res) => {
  try {
    const stockForms = await prisma.dailyStock.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(stockForms);
  } catch (error) {
    console.error('Error fetching stock forms:', error);
    res.status(500).json({ error: 'Failed to fetch stock forms' });
  }
});

export default router;