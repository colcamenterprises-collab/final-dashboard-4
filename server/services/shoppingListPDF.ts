// PATCH 3 — SHOPPING LIST PDF EXPORT
// STRICT: No other modifications allowed.

import PDFDocument from "pdfkit";
import { db } from "../lib/prisma";
import { Readable } from "stream";

export async function generateShoppingListPDF() {
  const prisma = db();
  const list = await prisma.shoppingListV2.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!list) return null;

  const doc = new PDFDocument({ margin: 40 });

  const stream = new Readable({
    read() {},
  });

  doc.on("data", (chunk: any) => stream.push(chunk));
  doc.on("end", () => stream.push(null));

  // TITLE
  doc.fontSize(22).fillColor("#000000").text("Smash Brothers Burgers", {
    align: "left",
  });

  doc.moveDown(0.3);
  doc.fontSize(16).fillColor("#333333").text("Shopping List", {
    align: "left",
  });

  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(`Generated: ${new Date().toLocaleString("en-TH", { timeZone: "Asia/Bangkok" })}`);

  doc.moveDown(1);

  // TABLE HEADER
  doc.fontSize(12).fillColor("#ff6a00").text("Item", { continued: true, width: 200 });
  doc.text("Qty", { continued: true, width: 80 });
  doc.text("Notes", { width: 250 });

  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke("#ff6a00");
  doc.moveDown(0.5);

  // TABLE ROWS
  const items = (list as any).items || [];
  items.forEach((i: any) => {
    doc
      .fontSize(11)
      .fillColor("#000000")
      .text(i.item, { continued: true, width: 200 });

    doc.text(String(i.quantity), { continued: true, width: 80 });

    doc.text(i.notes || "-", { width: 250 });

    doc.moveDown(0.3);
  });

  doc.end();
  return stream;
}
