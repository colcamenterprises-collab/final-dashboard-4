import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

const upload = multer({ dest: path.join(process.cwd(), "uploads") });
export const bankUploadRouter = express.Router();

/**
 * POST /api/bank-imports/pdf
 * field name: file  (multipart/form-data)
 */
bankUploadRouter.post("/api/bank-imports/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const pdfPath = req.file.path;
    const dataBuffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(dataBuffer);

    // TODO: replace this stub with real bank statement parsing rules.
    // For now we just return the extracted text length and a preview.
    const preview = (parsed.text || "").slice(0, 800);
    return res.json({
      ok: true,
      savedTo: pdfPath,
      meta: { pages: parsed.numpages ?? null, info: parsed.info ?? null },
      textPreview: preview
    });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message || "parse-failed" });
  }
});
