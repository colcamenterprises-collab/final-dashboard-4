import { Router } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "uploads/" });

// --- CSV Upload (simple stub; wire to your parser later) ---
router.post("/csv", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ ok:false, error:"No file" });
    // TODO: parse CSV -> save to DB
    res.json({ ok:true, kind:"csv", filename:file.originalname });
  } catch (err:any) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// --- PDF Upload (extracts text only; tolerant preview) ---
router.post("/pdf", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ ok:false, error:"No file" });

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);

    // TODO: map pdfData.text -> transactions, insert to DB
    res.json({
      ok: true,
      kind: "pdf",
      filename: file.originalname,
      textPreview: (pdfData.text || "").slice(0, 300)
    });
  } catch (err:any) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

export default router;
