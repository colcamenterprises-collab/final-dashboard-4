import { db } from '../lib/prisma';
import { generateDailyReportPDF } from './pdf';
import { sendReportEmail } from './email';

function currency(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n || 0);
}

export async function generateAndEmailDailyReport(salesId: string) {
  const sales = await db().dailySalesV2.findUnique({ where: { id: salesId }});
  if (!sales) throw new Error("DailySales not found");

  const stock = await db().dailyStock.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});
  const list  = await db().shoppingList.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});

  const pdfPath = await generateDailyReportPDF(salesId);
  const to = process.env.REPORT_TO || process.env.GMAIL_USER || "";

  const html = `
    <h2>Daily Report</h2>
    <p>Date: ${sales.createdAt.toISOString()}</p>
    <p>Total Sales: ${currency(Number(sales.totalSales || 0))}</p>
    <p>Total Expenses: ${currency(Number(sales.totalExpenses || 0))}</p>
    <h3>Shopping List</h3>
    <ul>
      <li>Rolls: ${list?.rollsCount}</li>
      <li>Meat: ${list?.meatWeightGrams}g</li>
    </ul>
  `;

  await sendReportEmail({
    to,
    subject: "Daily Report - Smash Brothers Burgers",
    html,
    attachments: [{ path: `.${pdfPath}`, filename: pdfPath.split("/").pop() }]
  });

  return pdfPath;
}