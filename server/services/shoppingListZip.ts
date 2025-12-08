// PATCH 4B — SHOPPING LIST DATE RANGE ZIP EXPORT
// STRICT: Do not modify other modules.

import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { db } from "../lib/prisma";
import archiver from "archiver";

async function renderPDF(items: any[], dateLabel: string) {
  const doc = new PDFDocument({ margin: 40 });

  const stream = new Readable({
    read() {},
  });

  doc.on("data", (chunk: any) => stream.push(chunk));
  doc.on("end", () => stream.push(null));

  // HEADER
  doc.fontSize(22).fillColor("#000000").text("Smash Brothers Burgers");
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor("#333333").text(`Shopping List — ${dateLabel}`);
  doc.moveDown(1);

  // TABLE HEADER
  doc.fontSize(12).fillColor("#ff6a00").text("Item", { continued: true, width: 200 });
  doc.text("Qty", { continued: true, width: 80 });
  doc.text("Notes", { width: 250 });

  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke("#ff6a00");
  doc.moveDown(0.5);

  // ITEMS
  items.forEach((i: any) => {
    doc.fontSize(11).fillColor("#000000").text(i.item, { continued: true, width: 200 });
    doc.text(String(i.quantity), { continued: true, width: 80 });
    doc.text(i.notes || "-", { width: 250 });
    doc.moveDown(0.3);
  });

  doc.end();
  return stream;
}

export async function generateShoppingListZip(start: string, end: string, res: any) {
  const prisma = db();
  const startDate = new Date(start);
  const endDate = new Date(end);

  const lists = await prisma.shoppingListV2.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!lists.length) return null;

  const archive = archiver("zip");
  archive.pipe(res);

  for (const list of lists) {
    const dateLabel = new Date(list.createdAt).toISOString().split("T")[0];
    const pdfStream = await renderPDF((list as any).items || [], dateLabel);

    archive.append(pdfStream, {
      name: `shopping-list-${dateLabel}.pdf`,
    });
  }

  archive.finalize();
  return true;
}
