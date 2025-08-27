import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

type SalesWithRelations = {
  id: string;
  shiftDate?: string;
  completedBy: string;
  submittedAtISO?: Date | null;
  cashSales: number;
  qrSales: number;
  grabSales: number;
  aroiSales: number;
  totalSales: number;
  startingCash: number;
  endingCash?: number;
  cashBanked?: number;
  qrTransfer?: number;
  shoppingTotal?: number;
  wagesTotal?: number;
  othersTotal?: number;
  totalExpenses: number;
  shopping: Array<{
    item: string;
    cost: number;
    shop: string;
  }>;
  wages: Array<{
    staff: string;
    amount: number;
    type: string;
  }>;
  others: Array<{
    label: string;
    amount: number;
  }>;
};

type StockData = {
  burgerBuns?: number;
  meatWeightG?: number;
  drinksJson?: any;
  purchasingJson?: any;
  notes?: string | null;
} | null;

export async function buildDailyReportPDF(opts: {
  sales: SalesWithRelations;
  stock?: StockData;
  outDir?: string;
}) {
  const { sales, stock } = opts;
  const dir = opts.outDir ?? path.join(process.cwd(), "tmp");
  fs.mkdirSync(dir, { recursive: true });
  
  const file = path.join(dir, `daily-report-${sales.id}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  // Header
  doc.fontSize(18).text("Smash Brothers Burgers — Daily Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10)
    .text(`Shift Date: ${sales.shiftDate || 'N/A'}`)
    .text(`Completed By: ${sales.completedBy}`)
    .text(`Submitted At: ${sales.submittedAtISO ? new Date(sales.submittedAtISO).toLocaleString() : 'N/A'}`);
  doc.moveDown();

  // Sales Section
  doc.fontSize(14).text("Sales");
  doc.fontSize(10)
    .text(`Cash: ฿${sales.cashSales.toLocaleString()}`)
    .text(`QR: ฿${sales.qrSales.toLocaleString()}`)
    .text(`Grab: ฿${sales.grabSales.toLocaleString()}`)
    .text(`Aroi Dee: ฿${sales.aroiSales.toLocaleString()}`)
    .text(`Total Sales: ฿${sales.totalSales.toLocaleString()}`, { underline: true });
  doc.moveDown();

  // Expenses Section
  doc.fontSize(14).text("Expenses");
  
  // Shopping
  doc.fontSize(12).text("Shopping");
  doc.fontSize(10);
  sales.shopping.forEach(item => 
    doc.text(`• ${item.item} — ฿${item.cost.toLocaleString()} (${item.shop})`)
  );
  doc.text(`Subtotal: ฿${(sales.shoppingTotal || 0).toLocaleString()}`, { underline: true }).moveDown(0.5);

  // Wages
  doc.fontSize(12).text("Wages");
  doc.fontSize(10);
  sales.wages.forEach(wage => 
    doc.text(`• ${wage.staff} — ฿${wage.amount.toLocaleString()} (${wage.type})`)
  );
  doc.text(`Subtotal: ฿${(sales.wagesTotal || 0).toLocaleString()}`, { underline: true }).moveDown(0.5);

  // Other Expenses
  doc.fontSize(12).text("Other Expenses");
  doc.fontSize(10);
  sales.others.forEach(other => 
    doc.text(`• ${other.label} — ฿${other.amount.toLocaleString()}`)
  );
  doc.text(`Subtotal: ฿${(sales.othersTotal || 0).toLocaleString()}`, { underline: true }).moveDown(0.5);

  doc.fontSize(12).text(`Total Expenses: ฿${sales.totalExpenses.toLocaleString()}`, { underline: true });
  doc.moveDown();

  // Banking Section
  doc.fontSize(14).text("Banking");
  doc.fontSize(10)
    .text(`Starting Cash: ฿${sales.startingCash.toLocaleString()}`)
    .text(`Ending Cash: ฿${(sales.endingCash || 0).toLocaleString()}`)
    .text(`Cash Banked: ฿${(sales.cashBanked || 0).toLocaleString()}`)
    .text(`QR Transfer: ฿${(sales.qrTransfer || 0).toLocaleString()}`);
  doc.moveDown();

  // Stock Section
  if (stock) {
    doc.fontSize(14).text("Stock (End of Shift)");
    doc.fontSize(10)
      .text(`Burger Buns: ${stock.burgerBuns || 0}`)
      .text(`Meat Remaining: ${stock.meatWeightG || 0} g`);
    
    if (stock.drinksJson) {
      doc.text(`Drinks: ${JSON.stringify(stock.drinksJson)}`);
    }
    
    if (stock.purchasingJson) {
      doc.text(`Purchasing Requests: ${JSON.stringify(stock.purchasingJson)}`);
    }
    
    if (stock.notes) {
      doc.text(`Notes: ${stock.notes}`);
    }
    
    doc.moveDown();
  }

  doc.end();
  await new Promise(resolve => stream.on("finish", resolve));
  return file;
}