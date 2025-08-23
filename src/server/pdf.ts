import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const currency = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(n) || 0);

export async function generateDailyReportPDF(salesId: string) {
  const sales = await prisma.dailySales.findUnique({ where: { id: salesId } });
  if (!sales) throw new Error("DailySales not found");

  const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});
  const list  = await prisma.shoppingList.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});
  const expenses = await prisma.expense?.findMany?.({ where: { salesFormId: salesId } }).catch(() => null) || [];

  const reportsDir = path.join(process.cwd(), "public", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `${salesId}.pdf`);

  const doc = new PDFDocument({ margin: 36 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Header
  doc.fontSize(18).text("Smash Brothers Burgers – Daily Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Date/Time (BKK): ${new Date(sales.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}`);
  doc.text(`Staff: ${sales.completedBy || "-"}`);
  doc.moveDown();

  // Sales & Banking
  doc.fontSize(14).text("Sales & Banking");
  doc.fontSize(10);
  doc.text(`Starting Cash: ${currency(sales.startingCash)}`);
  doc.text(`Closing Cash: ${currency(sales.closingCash)}`);
  doc.text(`Total Sales (net): ${currency(sales.totalSales)}`);
  doc.text(`Total Expenses: ${currency(sales.totalExpenses)}`);
  doc.text(`Banked – Cash: ${currency(sales.bankCash)}`);
  doc.text(`Banked – QR: ${currency(sales.bankQr)}`);
  doc.moveDown();

  // Expenses
  doc.fontSize(14).text("Expenses");
  if (expenses.length) {
    expenses.forEach((e:any) => {
      doc.fontSize(10).text(`• ${e.vendor||"-"} | ${e.category||"-"} | ${currency(e.amount)}${e.notes?` | ${e.notes}`:""}`);
    });
  } else {
    doc.fontSize(10).text("No expenses recorded.");
  }
  doc.moveDown();

  // Stock Snapshot
  doc.fontSize(14).text("Stock Snapshot");
  if (stock) {
    doc.fontSize(10).text(`Rolls (pcs): ${stock.rollsCount}`);
    doc.text(`Meat (grams): ${stock.meatWeightGrams}`);
  } else {
    doc.fontSize(10).text("No stock form found for this shift.");
  }
  doc.moveDown();

  // Shopping List
  doc.fontSize(14).text("Shopping List");
  if (list) {
    doc.fontSize(10).text(`Rolls: ${list.rollsCount}`);
    doc.text(`Meat (grams): ${list.meatWeightGrams}`);
    const drinks = (list.drinksCounts as any[]) || [];
    if (drinks.length) {
      doc.text("Drinks:");
      drinks.forEach(d => doc.text(`  - ${d.name}: ${d.qty}`));
    }
    const items = (list.items as any[]) || [];
    if (items.length) {
      doc.text("Requested Items:");
      items.forEach((it:any)=> doc.text(`  - ${it.name} (${it.unit}) × ${it.qty}`));
    } else {
      doc.text("No requested items.");
    }
  } else {
    doc.fontSize(10).text("No shopping list generated.");
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  const pdfPath = `/reports/${salesId}.pdf`;
  await prisma.dailySales.update({ where: { id: salesId }, data: { pdfPath } });
  return pdfPath;
}