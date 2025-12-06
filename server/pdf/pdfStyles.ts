/**
 * Shared PDF Styles for SBB Reports
 * Clean, professional styling - white background, black text, yellow accents
 * A4 Portrait Layout
 */

import PDFDocument from "pdfkit";

// Color palette - softened for professional look
const COLORS = {
  yellow: "#facc15",      // soft yellow accent
  black: "#111827",       // gray-900 for text
  gray: "#6b7280",        // gray-500 for secondary
  lightGray: "#f3f4f6",   // gray-100 for backgrounds
  white: "#ffffff",
  border: "#e5e7eb",      // gray-200 for borders
};

export function applyNeobrutalistHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  logoBuffer?: Buffer
) {
  // Thin yellow accent bar at top
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill(COLORS.yellow);
  doc.restore();

  // Logo (if supplied)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 40, 20, { width: 36 });
    } catch (e) {
      console.warn("Could not load logo image:", e);
    }
  }

  // Title - clean and professional
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fill(COLORS.black)
    .text(title, logoBuffer ? 90 : 40, 24, { align: "left" });

  // Thin underline
  doc.save();
  doc.rect(40, 55, 120, 3).fill(COLORS.yellow);
  doc.restore();
}

export function sectionBox(
  doc: PDFKit.PDFDocument,
  title: string,
  startY: number
) {
  // Yellow section header - smaller, cleaner
  doc.save();
  doc.rect(40, startY, doc.page.width - 80, 24).fill(COLORS.yellow);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fill(COLORS.black)
    .text(title, 50, startY + 6);

  return startY + 32;
}

export function tableHeader(
  doc: PDFKit.PDFDocument,
  headers: string[],
  y: number
) {
  // Light gray header background
  doc.save();
  doc.rect(40, y, doc.page.width - 80, 22).fill(COLORS.lightGray);
  doc.restore();

  // Border
  doc.save();
  doc.rect(40, y, doc.page.width - 80, 22).stroke(COLORS.border);
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(10).fill(COLORS.black);

  const colWidth = (doc.page.width - 100) / headers.length;
  let x = 50;
  headers.forEach((h) => {
    doc.text(h, x, y + 6, { width: colWidth - 10 });
    x += colWidth;
  });

  return y + 26;
}

export function tableRow(
  doc: PDFKit.PDFDocument,
  values: any[],
  y: number
) {
  // Subtle bottom border
  doc.save();
  doc.moveTo(40, y + 18).lineTo(doc.page.width - 40, y + 18).stroke(COLORS.border);
  doc.restore();

  doc.font("Helvetica").fontSize(10).fill(COLORS.black);

  const colWidth = (doc.page.width - 100) / values.length;
  let x = 50;
  values.forEach((v) => {
    doc.text(String(v ?? ""), x, y + 2, { width: colWidth - 10 });
    x += colWidth;
  });

  return y + 20;
}
