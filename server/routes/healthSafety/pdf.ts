import { Router } from "express";
import { generateHealthSafetyAuditPDF } from "../../services/pdf/healthSafetyAuditPdf";

const router = Router();

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await generateHealthSafetyAuditPDF(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=health-safety-audit-${id}.pdf`
    );

    doc.pipe(res);
  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(404).json({ error: error.message || "Failed to generate PDF" });
  }
});

export default router;
