import PDFDocument from "pdfkit";
import { prisma } from "../../../lib/prisma";

export async function generateHealthSafetyAuditPDF(auditId: string) {
  const audit = await prisma.healthSafetyAudit.findUnique({
    where: { id: auditId },
    include: {
      items: {
        include: { question: true },
      },
    },
  });

  if (!audit) throw new Error("Audit not found");

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc.fontSize(18).text("Daily Health & Safety Audit", { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Manager: ${audit.managerName}`);
  doc.text(`Completed: ${audit.completedAt.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}`);
  doc.text(`Status: ${audit.status}`);
  doc.moveDown();

  let currentSection = "";

  audit.items.forEach(item => {
    if (item.question.section !== currentSection) {
      currentSection = item.question.section;
      doc.moveDown();
      doc.fontSize(12).text(currentSection, { underline: true });
      doc.moveDown(0.5);
    }

    const isFail = item.question.isCritical && !item.checked;

    doc
      .fontSize(10)
      .fillColor(isFail ? "red" : "black")
      .text(`[${item.checked ? "✔" : "✘"}] ${item.question.label}`);
  });

  doc.moveDown();
  doc.fillColor("black");
  doc.text("Manager Sign-Off:");
  doc.moveDown(2);
  doc.text("______________________________");

  doc.moveDown();
  doc.fontSize(8).text(`Audit ID: ${audit.id}`, { align: "right" });

  doc.end();

  return doc;
}
