/**
 * DAILY REPORT V2 — NEOBRUTALIST PDF BUILDER
 * A4 Portrait Layout
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import {
  applyNeobrutalistHeader,
  sectionBox,
  tableHeader,
  tableRow,
} from "./pdfStyles";

export async function buildDailyReportPDF(reportJson: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Load logo (optional)
      let logo: Buffer | undefined = undefined;
      const logoPath = path.join(
        process.cwd(),
        "server",
        "assets",
        "sbb-logo-yellow.png"
      );

      if (fs.existsSync(logoPath)) {
        logo = fs.readFileSync(logoPath);
      }

      // ------------------------------------------------------------
      // HEADER
      // ------------------------------------------------------------
      applyNeobrutalistHeader(doc, "Daily Report", logo);

      let y = 120;

      // ------------------------------------------------------------
      // SALES SUMMARY
      // ------------------------------------------------------------
      y = sectionBox(doc, "Sales Summary", y);

      const sales = reportJson.sales ?? {};
      y = tableHeader(doc, ["Field", "Value"], y);

      const salesRows = [
        ["Cash Sales", sales.cashSales],
        ["QR Sales", sales.qrSales],
        ["Grab Sales", sales.grabSales],
        ["Other Sales", sales.otherSales],
        ["Total Sales", sales.totalSales],
      ];

      salesRows.forEach((row) => (y = tableRow(doc, row, y)));

      // ------------------------------------------------------------
      // STOCK SUMMARY
      // ------------------------------------------------------------
      y = sectionBox(doc, "Stock Summary", y + 20);

      const stock = reportJson.stock ?? {};
      y = tableHeader(doc, ["Item", "End Count"], y);

      const stockRows = [
        ["Rolls", stock.rollsEnd],
        ["Meat (g)", stock.meatEnd],
      ];

      stockRows.forEach((row) => (y = tableRow(doc, row, y)));

      // Drinks as dynamic rows
      const drinkStock = stock.drinkStock ?? {};
      Object.keys(drinkStock).forEach((k) => {
        y = tableRow(doc, [k, drinkStock[k]], y);
      });

      // ------------------------------------------------------------
      // SHOPPING LIST
      // ------------------------------------------------------------
      y = sectionBox(doc, "Shopping List", y + 20);

      const list = reportJson.shoppingList?.itemsJson ?? [];
      if (list.length > 0) {
        y = tableHeader(doc, ["Item", "Qty", "Unit", "Notes"], y);
        list.forEach((item: any) => {
          y = tableRow(
            doc,
            [item.name, item.qty, item.unit, item.notes ?? ""],
            y
          );
        });
      } else {
        doc.font("Helvetica").fontSize(12).text("No items requested.", 50, y + 5);
        y += 25;
      }

      // ------------------------------------------------------------
      // MANAGER NOTES
      // ------------------------------------------------------------
      y = sectionBox(doc, "Notes", y + 20);

      const notes = reportJson.sales?.notes ?? "No notes provided.";
      doc.font("Helvetica").fontSize(12).text(notes, 50, y);

      // ------------------------------------------------------------
      // FOOTER
      // ------------------------------------------------------------
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(
          "Generated automatically by SBB Dashboard v4",
          40,
          doc.page.height - 40
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
