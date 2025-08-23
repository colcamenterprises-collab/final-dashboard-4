import { PrismaClient } from "@prisma/client";
import { generateDailyReportPDF } from "./pdf";
import { sendDailyReportEmail } from "../../server/lib/email";

const prisma = new PrismaClient();

const currency = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(n) || 0);

export async function generateAndEmailDailyReport(salesId: string) {
  // Pull staff forms only
  const sales = await prisma.dailySales.findUnique({ where: { id: salesId } });
  if (!sales) throw new Error("DailySales not found");

  const stock = await prisma.dailyStock.findFirst({
    where: { salesFormId: salesId },
    orderBy: { createdAt: "desc" }
  });

  const list = await prisma.shoppingList.findFirst({
    where: { salesFormId: salesId },
    orderBy: { createdAt: "desc" }
  });

  // Build staff-only HTML
  const dateStr = new Date(sales.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
  const expenses = await prisma.expense?.findMany?.({ where: { salesFormId: salesId } }).catch(() => null) || [];

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6">
      <h2>Smash Brothers Burgers – Daily Report</h2>
      <p><strong>Date/Time (BKK):</strong> ${dateStr}</p>
      <p><strong>Staff:</strong> ${sales.completedBy || "-"}</p>

      <h3>Sales & Banking</h3>
      <ul>
        <li>Starting Cash: ${currency(sales.startingCash)}</li>
        <li>Closing Cash: ${currency(sales.closingCash)}</li>
        <li>Total Sales (net): ${currency(sales.totalSales)}</li>
        <li>Total Expenses: ${currency(sales.totalExpenses)}</li>
        <li>Banked – Cash: ${currency(sales.bankCash)}</li>
        <li>Banked – QR: ${currency(sales.bankQr)}</li>
      </ul>

      <h3>Expenses</h3>
      ${expenses.length ? `
        <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;">
          <thead><tr><th>Vendor</th><th>Category</th><th>Amount</th><th>Notes</th></tr></thead>
          <tbody>
            ${expenses.map((e:any)=>`
              <tr>
                <td>${e.vendor||"-"}</td>
                <td>${e.category||"-"}</td>
                <td>${currency(e.amount)}</td>
                <td>${e.notes||""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      ` : `<p>No expenses recorded.</p>`}

      <h3>Stock Snapshot</h3>
      ${stock ? `
        <ul>
          <li>Rolls (pcs): ${stock.rollsCount}</li>
          <li>Meat (grams): ${stock.meatWeightGrams}</li>
        </ul>
      ` : `<p>No stock form found for this shift.</p>`}

      <h3>Shopping List</h3>
      ${list ? `
        <ul>
          <li>Rolls: ${list.rollsCount}</li>
          <li>Meat (grams): ${list.meatWeightGrams}</li>
        </ul>
        ${Array.isArray(list.drinksCounts) && list.drinksCounts.length ? `
          <p><strong>Drinks</strong></p>
          <ul>${(list.drinksCounts as any[]).map(d=>`<li>${d.name}: ${d.qty}</li>`).join("")}</ul>` : "" }
        ${Array.isArray(list.items) && list.items.length ? `
          <p><strong>Requested Items</strong></p>
          <ul>${(list.items as any[]).map((it:any)=>`<li>${it.name} (${it.unit}) × ${it.qty}</li>`).join("")}</ul>` : "<p>No requested items.</p>"}
      ` : "<p>No shopping list generated.</p>"}

      <p style="margin-top:16px">
        <a href="${sales.pdfPath || "#"}" target="_blank">View Daily Report (PDF)</a> &nbsp;|&nbsp;
        <a href="/shopping-list" target="_blank">View Shopping List</a>
      </p>
    </div>
  `;

  // Generate PDF and email
  const pdfPath = await generateDailyReportPDF(salesId); // staff-only PDF
  const to = (process.env.REPORT_TO || `${process.env.GMAIL_USER||""}`).split(",").map(s=>s.trim()).filter(Boolean);
  if (!to.length) throw new Error("No REPORT_TO or GMAIL_USER configured.");

  await sendDailyReportEmail({
    pdfPath: `.${pdfPath}`,
    salesData: {
      id: salesId,
      shiftDate: new Date(sales.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }),
      completedBy: sales.completedBy || "-",
      totalSales: sales.totalSales || 0,
      totalExpenses: sales.totalExpenses || 0
    },
    to: to[0] // Use first email address
  });

  return pdfPath;
}