// server/services/jussi/runJussiDaily.js
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
const TZ = process.env.TZ || 'Asia/Bangkok';

// --- email utils (safe no-op if SMTP not set) ---
function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransporter({ host, port, secure: port === 465, auth: { user, pass } });
}
async function maybeSendEmail({ to, subject, text, html }) {
  const t = buildTransport();
  if (!t) {
    console.log('[jussi] SMTP not configured, skipping email send.');
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, text, html });
  return { skipped: false };
}

function fmtMoney(cents) { return `฿${(cents/100).toFixed(2)}`; }

function renderPlain({ restaurant, shiftDate, sales, analytics, expenses }) {
  const lines = [];
  lines.push(`Jussi — Daily Ops Report`);
  lines.push(`${restaurant.name} — ${format(shiftDate, 'yyyy-MM-dd')} (17:00–03:00 ${TZ})`);
  lines.push('');

  if (sales) {
    lines.push(`Sales: ${fmtMoney(sales.totalSales)} (receipts ${sales.receiptsCount})`);
    lines.push(`  Cash ${fmtMoney(sales.cash)} | Card ${fmtMoney(sales.card)} | QR ${fmtMoney(sales.qr)} | Delivery ${fmtMoney(sales.delivery)} | Other ${fmtMoney(sales.other)}`);
  } else {
    lines.push(`Sales: (no DailySales row)`);
  }
  lines.push('');

  const topQty = analytics?.top5ByQty || [];
  const topRev = analytics?.top5ByRevenue || [];
  lines.push('Top 5 by Qty:');
  if (topQty.length) topQty.forEach((x,i)=>lines.push(`  ${i+1}. ${x.skuOrName} — ${x.qty}`));
  else lines.push('  (none)');
  lines.push('');
  lines.push('Top 5 by Revenue:');
  if (topRev.length) topRev.forEach((x,i)=>lines.push(`  ${i+1}. ${x.skuOrName} — ${fmtMoney(x.revenue)}`));
  else lines.push('  (none)');
  lines.push('');

  if (analytics?.variance) {
    lines.push('Variance (Expected – Count):');
    lines.push(`  Buns: ${analytics.variance.buns ?? 0}`);
    lines.push(`  Meat: ${analytics.variance.meatGrams ?? 0} g`);
    lines.push(`  Drinks: ${analytics.variance.drinks ?? 0}`);
  } else {
    lines.push('Variance: (no stock submitted)');
  }
  lines.push('');

  const expSum = (expenses || []).reduce((a, e) => a + (e.costCents || 0), 0);
  lines.push(`Expenses total: ${fmtMoney(expSum)} (${(expenses || []).length} entries)`);
  if (expenses?.length) {
    lines.push('  Sample:');
    expenses.slice(0, 5).forEach(e => lines.push(`   • ${e.item} — ${fmtMoney(e.costCents)}${e.supplier ? ` (${e.supplier})` : ''}`));
  }

  lines.push('');
  lines.push('Actions:');
  const flags = analytics?.flags || [];
  if (flags.length) flags.forEach(f => lines.push(`  - ${f}`));
  else lines.push('  - No critical flags. Maintain standard ops.');

  return lines.join('\n');
}

async function runForRestaurant(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return;

  // Find latest DailySales row
  const sales = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { shiftDate: 'desc' }
  });
  if (!sales) {
    const subject = `[Jussi] ${restaurant.name} — No sales found`;
    const text = `No DailySales row exists for ${restaurant.name}. Run analytics first.`;
    await prisma.job.create({ data: { restaurantId, type: 'EMAIL_SUMMARY', status: 'FAILED', payload: { reason: 'NO_SALES' } } });
    await maybeSendEmail({ to: restaurant.email, subject, text, html: `<pre>${text}</pre>` });
    return;
  }

  const shiftDate = sales.shiftDate;
  const [analytics, expenses] = await Promise.all([
    prisma.analyticsDaily.findUnique({ where: { restaurantId_shiftDate: { restaurantId, shiftDate } } }),
    prisma.expense.findMany({ where: { restaurantId, shiftDate }, orderBy: { createdAt: 'desc' } })
  ]);

  const text = renderPlain({ restaurant, shiftDate, sales, analytics, expenses });
  const subject = `[Jussi] ${restaurant.name} — ${format(shiftDate, 'yyyy-MM-dd')}`;
  const to = (process.env.DAILY_REPORT_TO || '').trim() || restaurant.email || null;

  if (to) await maybeSendEmail({ to, subject, text, html: `<pre>${text}</pre>` });

  await prisma.job.create({
    data: {
      restaurantId,
      type: 'EMAIL_SUMMARY',
      status: 'SUCCESS',
      payload: { restaurantId, shiftDate, totals: sales.totalSales, receipts: sales.receiptsCount, hasAnalytics: !!analytics, expenses: expenses.length }
    }
  });

  console.log(`[jussi] sent for ${restaurant.name} ${format(shiftDate, 'yyyy-MM-dd')} -> ${to || 'no-recipient'}`);
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true, email: true } });
  for (const r of restaurants) {
    try { await runForRestaurant(r.id); }
    catch (e) {
      console.error('[jussi] failed', r.id, e?.message || e);
      await prisma.job.create({ data: { restaurantId: r.id, type: 'EMAIL_SUMMARY', status: 'FAILED', payload: { error: String(e?.message || e) } } });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });