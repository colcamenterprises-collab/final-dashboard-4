import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { db } from '../lib/prisma';

function currency(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n || 0);
}

export async function generateDailyReportPDF(salesId: string) {
  const sales = await db().dailySalesV2.findUnique({ where: { id: salesId } });
  if (!sales) throw new Error("DailySales not found");

  const stock = await db().dailyStock.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});
  const list  = await db().shoppingList.findFirst({ where: { salesFormId: salesId }, orderBy: { createdAt: "desc" }});

  const reportsDir = path.join(process.cwd(), "public", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `${salesId}.pdf`);

  const doc = new PDFDocument({ margin: 36 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).text("Smash Brothers Burgers - Daily Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(10).text(`Date: ${sales.createdAt.toISOString()}`);
  doc.text(`Completed by: ${sales.completedBy || ""}`);
  doc.moveDown();

  doc.fontSize(14).text("Sales Summary");
  doc.fontSize(10);
  doc.text(`Starting Cash: ${currency(Number(sales.startingCash || 0))}`);
  doc.text(`Closing Cash: ${currency(Number(sales.closingCash || 0))}`);
  doc.text(`Total Sales: ${currency(Number(sales.totalSales || 0))}`);
  doc.text(`Total Expenses: ${currency(Number(sales.totalExpenses || 0))}`);
  doc.text(`Banked (Cash): ${currency(Number(sales.bankCash || 0))}`);
  doc.text(`Banked (QR): ${currency(Number(sales.bankQr || 0))}`);
  doc.moveDown();

  if (stock) {
    doc.fontSize(14).text("End-of-Shift Stock");
    doc.fontSize(10);
    doc.text(`Rolls: ${stock.rollsCount}`);
    doc.text(`Meat (grams): ${stock.meatWeightGrams}`);
    doc.moveDown();
  }

  if (list) {
    doc.fontSize(14).text("Shopping List");
    doc.fontSize(10);
    doc.text(`Rolls: ${list.rollsCount}`);
    doc.text(`Meat (grams): ${list.meatWeightGrams}`);
    (list.drinksCounts as any[]).forEach(d => doc.text(`Drink - ${d.name}: ${d.qty}`));
    doc.moveDown();
    (list.items as any[]).forEach((it: any) => {
      doc.text(`- ${it.name} (${it.unit}) x ${it.qty}`);
    });
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  const pdfPath = `/reports/${salesId}.pdf`;
  await db().dailySalesV2.update({ where: { id: salesId }, data: { pdfPath } });
  return pdfPath;
}