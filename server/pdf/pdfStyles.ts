/**
 * Shared PDF Styles for Neobrutalist SBB Reports
 * A4 Portrait Layout
 */

import PDFDocument from "pdfkit";

export function applyNeobrutalistHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  logoBuffer?: Buffer
) {
  // Yellow banner
  doc.save();
  doc.rect(0, 0, doc.page.width, 80).fill("#FFD500");
  doc.restore();

  // Logo (if supplied)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 40, 20, { width: 40 });
    } catch (e) {
      console.warn("Could not load logo image:", e);
    }
  }

  // Title
  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fill("#000000")
    .text(title, 100, 28, { align: "left" });
}

export function sectionBox(
  doc: PDFKit.PDFDocument,
  title: string,
  startY: number
) {
  // Yellow section header
  doc.save();
  doc.rect(40, startY, doc.page.width - 80, 30).fill("#FFD500");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fill("#000000")
    .text(title, 50, startY + 7);

  return startY + 40;
}

export function tableHeader(
  doc: PDFKit.PDFDocument,
  headers: string[],
  y: number
) {
  doc.save();
  doc.rect(40, y, doc.page.width - 80, 25).fill("#FFD500");
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(12).fill("#000000");

  let x = 50;
  headers.forEach((h) => {
    doc.text(h, x, y + 7);
    x += 150;
  });

  return y + 30;
}

export function tableRow(
  doc: PDFKit.PDFDocument,
  values: any[],
  y: number
) {
  doc.font("Helvetica").fontSize(11).fill("#000000");

  let x = 50;
  values.forEach((v) => {
    doc.text(String(v ?? ""), x, y);
    x += 150;
  });

  return y + 20;
}
