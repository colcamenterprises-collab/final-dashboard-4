// PATCH 5 — SHIFT REPORT PDF EXPORT
// STRICT: No modification to other modules.

import PDFDocument from "pdfkit";
import { db } from "../lib/prisma";
import { Readable } from "stream";

function sectionHeader(doc: any, label: string) {
  doc.moveDown(0.6);
  doc.fontSize(14).fillColor("#000000").text(label);
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke("#ff6a00");
  doc.moveDown(0.6);
}

export async function generateShiftReportPDF(id: string) {
  const prisma = db();
  const report = await prisma.shift_report_v2.findUnique({
    where: { id },
  });

  if (!report) return null;

  const doc = new PDFDocument({ margin: 40 });

  const stream = new Readable({
    read() {},
  });

  doc.on("data", (chunk: Buffer) => stream.push(chunk));
  doc.on("end", () => stream.push(null));

  // HEADER
  doc.fontSize(22).fillColor("#000000").text("Smash Brothers Burgers");
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor("#333333").text("Shift Report");
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(
      `Shift Date: ${new Date(report.shiftDate).toLocaleString("en-TH", {
        timeZone: "Asia/Bangkok",
      })}`
    );

  // VARIANCES
  sectionHeader(doc, "Variance Summary");

  const v = (report.variances as any) || {};

  doc.fontSize(12).fillColor("#000000");
  doc.text(`Cash Variance: ${v.cashVariance ?? "N/A"} (Level: ${v.cashVarianceLevel ?? "N/A"})`);
  doc.text(`QR Variance: ${v.qrVariance ?? "N/A"}`);
  doc.text(`QR Settlement Variance: ${v.qrSettlementVariance ?? "N/A"}`);
  doc.text(`Grab Variance: ${v.grabVariance ?? "N/A"}`);
  doc.text(`Total Sales Variance: ${v.totalSalesVariance ?? "N/A"}`);
  doc.moveDown(0.5);

  // WARNINGS & ERRORS
  sectionHeader(doc, "Warnings & Errors");

  const errors = v.errors || [];
  const warnings = v.warnings || [];

  if (errors.length === 0 && warnings.length === 0) {
    doc.text("No warnings or errors detected.");
  } else {
    errors.forEach((e: string) => doc.fillColor("#cc0000").text(`ERROR: ${e}`));
    warnings.forEach((w: string) =>
      doc.fillColor("#cc8800").text(`WARNING: ${w}`)
    );
  }

  // SALES DATA
  sectionHeader(doc, "Daily Sales Summary");
  doc.fontSize(10).fillColor("#000000");
  doc.text(JSON.stringify(report.salesData, null, 2));

  // STOCK DATA
  sectionHeader(doc, "Daily Stock Summary");
  doc.fontSize(10).fillColor("#000000");
  doc.text(JSON.stringify(report.stockData, null, 2));

  // POS DATA
  sectionHeader(doc, "POS Shift Report Summary");
  doc.fontSize(10).fillColor("#000000");
  doc.text(JSON.stringify(report.posData, null, 2));

  doc.end();
  return stream;
}
