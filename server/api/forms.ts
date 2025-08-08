import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

function money(n?: number | null) {
  return `฿${(n ?? 0).toFixed(2)}`;
}

async function fetchJoined() {
  const sales = await prisma.dailySales.findMany({ orderBy: { createdAt: 'desc' } });
  const stock = await prisma.dailyStock.findMany({
    where: { salesFormId: { in: sales.map(s => s.id) } }
  });
  const stockBySalesId = new Map(stock.map(s => [s.salesFormId!, s]));
  return sales.map(s => ({ sales: s, stock: stockBySalesId.get(s.id) || null }));
}

export async function listForms(req: Request, res: Response) {
  try {
    const rows = await fetchJoined();
    const data = rows.map(({ sales, stock }) => ({
      id: sales.id,
      createdAt: sales.createdAt,
      completedBy: sales.completedBy,
      totalSales: sales.totalSales ?? (sales.cashSales + sales.qrSales + sales.grabSales + sales.aroiDeeSales),
      hasStock: !!stock,
      meatGrams: stock?.meatGrams ?? null,
      burgerBuns: stock?.burgerBuns ?? null,
    }));
    res.json(data);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  } finally {
    await prisma.$disconnect();
  }
}

export async function getForm(req: Request, res: Response) {
  try {
    const id = String(req.query.id || req.params.id);
    const sales = await prisma.dailySales.findUnique({ where: { id } });
    if (!sales) return res.status(404).json({ error: 'Not found' });
    const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: id } });
    res.json({ sales, stock });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  } finally {
    await prisma.$disconnect();
  }
}

function buildTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { 
      user: process.env.GMAIL_USER, 
      pass: process.env.GMAIL_APP_PASSWORD 
    },
  });
}

export async function emailForm(req: Request, res: Response) {
  try {
    const id = String(req.query.id || req.params.id);
    const sales = await prisma.dailySales.findUnique({ where: { id } });
    if (!sales) return res.status(404).json({ error: 'Not found' });
    const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: id } });

    const totalSales = sales.totalSales ?? (sales.cashSales + sales.qrSales + sales.grabSales + sales.aroiDeeSales);
    const lines: string[] = [
      `Daily Submission`,
      `Form ID: ${sales.id}`,
      `Date: ${new Date(sales.createdAt).toLocaleString('en-TH')}`,
      `Completed By: ${sales.completedBy}`,
      ``,
      `SALES`,
      `- Cash: ${money(sales.cashSales)}`,
      `- QR: ${money(sales.qrSales)}`,
      `- Grab: ${money(sales.grabSales)}`,
      `- Aroi Dee: ${money(sales.aroiDeeSales)}`,
      `Total Sales: ${money(totalSales)}`,
      ``,
      `EXPENSES`,
      `- Total Expenses: ${money(sales.totalExpenses)}`,
      ``,
      `BANKING`,
      `- Closing Cash: ${money(sales.closingCash)}`,
      `- Cash Banked: ${money(sales.cashBanked)}`,
      `- QR Transfer: ${money(sales.qrTransferred)}`,
    ];

    if (stock) {
      lines.push(
        ``,
        `STOCK`,
        `- Meat (g): ${stock.meatGrams}`,
        `- Burger Buns: ${stock.burgerBuns}`,
        ``,
        `DRINKS (>0)`,
        ...Object.entries(stock.drinkStock || {})
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `PURCHASE REQUESTS (>0)`,
        ...Object.entries(stock.stockRequests || {})
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => `- ${k}: ${v}`)
      );
    } else {
      lines.push(``, `STOCK: Not submitted yet`);
    }

    const transporter = buildTransporter();
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'smashbrothersburgersth@gmail.com',
      subject: `Daily Submission – ${new Date(sales.createdAt).toLocaleDateString('en-TH')}`,
      text: lines.join('\n'),
      replyTo: 'smashbrothersburgersth@gmail.com',
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[emailForm] ', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || 'email failed' });
  } finally {
    await prisma.$disconnect();
  }
}