import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import stockData from '../../data/stock_items_by_category.json';

const prisma = new PrismaClient();

function money(n?: number | null) {
  return `฿${(n ?? 0).toFixed(2)}`;
}

// Helper to preserve display order from JSON
function orderDrinks(map: Record<string, number>) {
  const order: string[] = (stockData as any)?.Drinks || Object.keys(map).sort();
  const index = new Map(order.map((k, i) => [k, i]));
  return Object.entries(map)
    .map(([k, v]) => [k, Number(v) || 0] as [string, number])
    .sort((a, b) => (index.get(a[0]) ?? 999) - (index.get(b[0]) ?? 999));
}

async function fetchJoined() {
  const sales = await prisma.dailySales.findMany({ orderBy: { createdAt: 'desc' } });
  const stock = await prisma.dailyStock.findMany({ where: { salesFormId: { in: sales.map(s => s.id) } } });
  const byId = new Map(stock.map(s => [s.salesFormId!, s]));
  const rows = sales
    .filter(s => byId.has(s.id))
    .map(s => {
      const st = byId.get(s.id)!;
      return { sales: s, stock: st };
    });
  return rows;
}

export async function listForms(req: Request, res: Response) {
  try {
    const sales = await prisma.dailySales.findMany({ orderBy: { createdAt: 'desc' } });
    const stock = await prisma.dailyStock.findMany({
      where: { salesFormId: { in: sales.map(s => s.id) } }
    });

    const stockById = new Map(stock.map(s => [s.salesFormId!, s]));

    const rows = sales
      .filter(s => stockById.has(s.id)) // completed forms only
      .map(s => {
        const st = stockById.get(s.id)!;

        // shopping summary
        const shopEntries = Object.entries(st.stockRequests || {}).filter(([, v]) => (Number(v) || 0) >= 1);

        // drinks (all)
        const drinksAll: Record<string, number> = Object.fromEntries(
          Object.entries(st.drinkStock || {}).map(([k, v]) => [k, Number(v) || 0])
        );
        const drinksOrdered = orderDrinks(drinksAll);

        return {
          id: s.id,
          createdAt: s.createdAt,
          completedBy: s.completedBy,
          totalSales:
            s.totalSales ??
            (Number(s.cashSales || 0) + Number(s.qrSales || 0) + Number(s.grabSales || 0) + Number(s.aroiDeeSales || 0)),
          meatGrams: st.meatGrams,
          burgerBuns: st.burgerBuns,

          // NEW
          drinks: Object.fromEntries(drinksOrdered),
          shoppingListCount: shopEntries.length,
          shoppingPreview: shopEntries.slice(0, 5).map(([k, v]) => `${k} × ${v}`),
        };
      });

    res.json(rows);
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
    if (!sales) return res.status(404).json({ error: 'Form not found' });
    
    const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: id } });
    
    // Return in the expected format per specification
    const response = {
      shift: {
        id: sales.id,
        date: sales.shiftDate,
        completedBy: sales.completedBy
      },
      stock: stock ? {
        rolls: stock.bunsCount || stock.burgerBuns || 0,
        meatGrams: stock.meatGrams || stock.meatWeightG || 0,
        requisition: stock.purchasingJson || {}
      } : {
        rolls: 0,
        meatGrams: 0,
        requisition: {}
      }
    };
    
    res.json(response);
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
  const id = String(req.query.id || req.params.id);
  try {
    const sales = await prisma.dailySales.findUnique({ where: { id } });
    if (!sales) return res.status(404).json({ error: 'Not found' });
    const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: id } });

    const totalSales =
      sales.totalSales ??
      (Number(sales.cashSales || 0) +
       Number(sales.qrSales || 0) +
       Number(sales.grabSales || 0) +
       Number(sales.aroiDeeSales || 0));

    const lines: string[] = [
      `Daily Submission`,
      `Form ID: ${sales.id}`,
      `Date: ${new Date(sales.createdAt).toLocaleString('en-TH')}`,
      `Completed By: ${sales.completedBy || '-'}`,
      ``,
      `SALES`,
      `- Cash: ฿${(sales.cashSales || 0).toFixed(2)}`,
      `- QR: ฿${(sales.qrSales || 0).toFixed(2)}`,
      `- Grab: ฿${(sales.grabSales || 0).toFixed(2)}`,
      `- Aroi Dee: ฿${(sales.aroiDeeSales || 0).toFixed(2)}`,
      `Total Sales: ฿${(totalSales || 0).toFixed(2)}`,
      ``,
      `EXPENSES`,
      `- Total Expenses: ฿${(sales.totalExpenses || 0).toFixed(2)}`,
      ``,
      `BANKING`,
      `- Closing Cash: ฿${(sales.closingCash || 0).toFixed(2)}`,
      `- Cash Banked: ฿${(sales.cashBanked || 0).toFixed(2)}`,
      `- QR Transfer: ฿${(sales.qrTransferred || 0).toFixed(2)}`,
    ];

    if (stock) {
      const allDrinks = Object.entries(stock.drinkStock || {}).map(([k, v]) => [k, Number(v) || 0] as [string, number]);
      allDrinks.sort((a, b) => a[1] - b[1]);

      const shopPos = Object.entries(stock.stockRequests || {}).filter(([, n]) => (Number(n) || 0) > 0);

      lines.push(
        ``,
        `END-OF-SHIFT STOCK`,
        `- Meat (g): ${stock.meatGrams}`,
        `- Burger Buns: ${stock.burgerBuns}`,
        ``,
        `DRINKS (all)`,
        ...(allDrinks.length ? allDrinks.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
        ``,
        `SHOPPING LIST`,
        ...(shopPos.length ? shopPos.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
      );
    } else {
      lines.push(``, `STOCK: Not submitted yet`);
    }

    // Build HTML (keep existing text body as fallback)
    const html = buildHtmlEmail({ sales, stock, totalSales });

    const transporter = buildTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_TO || 'colcamenterprises@gmail.com,smashbrothersburgersth@gmail.com',
      subject: `Daily Submission – ${new Date(sales.createdAt).toLocaleDateString('en-TH')}`,
      text: lines.join('\n'),  // keep plaintext fallback
      html,
      replyTo: 'smashbrothersburgersth@gmail.com',
      attachments: [
        { filename: 'logo-email.png', path: './public/logo-email.png', cid: 'logo', contentType: 'image/png' }
      ]
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[emailForm] ', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || 'email failed' });
  } finally {
    await prisma.$disconnect();
  }
}

export async function sendCombinedEmail(prisma: PrismaClient, salesId: string) {
  const sales = await prisma.dailySales.findUnique({ where: { id: salesId } });
  if (!sales) throw new Error('Sales not found');
  const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: salesId } });

  const totalSales =
    sales.totalSales ??
    (Number(sales.cashSales || 0) +
     Number(sales.qrSales || 0) +
     Number(sales.grabSales || 0) +
     Number(sales.aroiDeeSales || 0));

  const lines: string[] = [
    `Daily Submission`,
    `Form ID: ${sales.id}`,
    `Date: ${new Date(sales.createdAt).toLocaleString('en-TH')}`,
    `Completed By: ${sales.completedBy || '-'}`,
    ``,
    `SALES`,
    `- Cash: ฿${(sales.cashSales || 0).toFixed(2)}`,
    `- QR: ฿${(sales.qrSales || 0).toFixed(2)}`,
    `- Grab: ฿${(sales.grabSales || 0).toFixed(2)}`,
    `- Aroi Dee: ฿${(sales.aroiDeeSales || 0).toFixed(2)}`,
    `Total Sales: ฿${(totalSales || 0).toFixed(2)}`,
    ``,
    `EXPENSES`,
    `- Total Expenses: ฿${(sales.totalExpenses || 0).toFixed(2)}`,
    ``,
    `BANKING`,
    `- Closing Cash: ฿${(sales.closingCash || 0).toFixed(2)}`,
    `- Cash Banked: ฿${(sales.cashBanked || 0).toFixed(2)}`,
    `- QR Transfer: ฿${(sales.qrTransferred || 0).toFixed(2)}`,
  ];

  if (stock) {
    const allDrinks = Object.entries(stock.drinkStock || {}).map(([k, v]) => [k, Number(v) || 0] as [string, number]);
    allDrinks.sort((a, b) => a[1] - b[1]);

    const shopPos = Object.entries(stock.stockRequests || {}).filter(([, n]) => (Number(n) || 0) > 0);

    lines.push(
      ``,
      `END-OF-SHIFT STOCK`,
      `- Meat (g): ${stock.meatGrams}`,
      `- Burger Buns: ${stock.burgerBuns}`,
      ``,
      `DRINKS (all)`,
      ...(allDrinks.length ? allDrinks.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
      ``,
      `SHOPPING LIST`,
      ...(shopPos.length ? shopPos.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
    );
  } else {
    lines.push(``, `STOCK: Not submitted yet`);
  }

  // Build HTML using the same function as emailForm
  const html = buildHtmlEmail({ sales, stock, totalSales });
  const textBody = lines.join('\n');

  const transporter = buildTransporter();
  await transporter.verify();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.SMTP_TO || 'colcamenterprises@gmail.com,smashbrothersburgersth@gmail.com',
    subject: `Daily Submission – ${new Date(sales.createdAt).toLocaleDateString('en-TH')}`,
    text: textBody,
    html: html,
    replyTo: 'smashbrothersburgersth@gmail.com',
    attachments: [{ filename: 'logo-email.png', path: './public/logo-email.png', cid: 'logo', contentType: 'image/png' }]
  });
}

function htmlRow(label: string, val: string) {
  return `<tr><td style="font:400 14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;">
    <span style="color:#555">${label}:</span> ${val}
  </td></tr>`;
}

function htmlSection(title: string) {
  return `<tr><td style="font:600 14px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;padding:16px 0 6px;border-top:1px solid #eee">${title}</td></tr>`;
}

function buildHtmlEmail({ sales, stock, totalSales }: any) {
  const fmt = (n?: number) => `฿${(Number(n || 0)).toFixed(2)}`;
  const drinkLines = stock
    ? Object.entries(stock.drinkStock || {})
        .map(([k, v]) => [k, Number(v) || 0] as [string, number])
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' • ')
    : '';

  const shopLines = stock
    ? Object.entries(stock.stockRequests || {})
        .filter(([, n]) => (Number(n) || 0) > 0)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join('<br/>') || '• none'
    : '• none';

  return `
  <div style="background:#f9f9f9;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:10px;padding:24px">
      <tr>
        <td style="display:flex;align-items:center;gap:12px">
          <img src="cid:logo" width="40" height="40" alt="SBB" style="display:block;border-radius:999px"/>
          <div style="font:700 18px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111">Daily Submission</div>
        </td>
      </tr>

      ${htmlSection('Meta')}
      ${htmlRow('Form ID', sales.id)}
      ${htmlRow('Date', new Date(sales.createdAt).toLocaleString('en-TH'))}
      ${htmlRow('Completed By', sales.completedBy || '-')}

      ${htmlSection('Sales')}
      ${htmlRow('Cash', fmt(sales.cashSales))}
      ${htmlRow('QR', fmt(sales.qrSales))}
      ${htmlRow('Grab', fmt(sales.grabSales))}
      ${htmlRow('Aroi Dee', fmt(sales.aroiDeeSales))}
      ${htmlRow('<b>Total Sales</b>', `<b>${fmt(totalSales)}</b>`)}

      ${htmlSection('Expenses')}
      ${htmlRow('Total Expenses', fmt(sales.totalExpenses))}

      ${htmlSection('Banking')}
      ${htmlRow('Closing Cash', fmt(sales.closingCash))}
      ${htmlRow('Cash Banked', fmt(sales.cashBanked))}
      ${htmlRow('QR Transfer', fmt(sales.qrTransferred))}

      ${stock ? `
      ${htmlSection('End-of-Shift Stock')}
      ${htmlRow('Meat (g)', String(stock.meatGrams))}
      ${htmlRow('Burger Buns', String(stock.burgerBuns))}

      ${htmlSection('Drinks (all)')}
      <tr><td style="font:400 14px/1.8 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111">${drinkLines}</td></tr>

      ${htmlSection('Shopping List')}
      <tr><td style="font:400 14px/1.8 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111">${shopLines}</td></tr>
      ` : ''}
    </table>
  </div>`;
}