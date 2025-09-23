import express from "express";
import multer from "multer";
import { processPosCsv, getShiftSummary } from "../services/posUploadService";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const result = await processPosCsv(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.get("/summary/:date", async (req, res) => {
  try {
    const summary = await getShiftSummary(req.params.date);
    res.json(summary || { message: "No data" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Summary failed" });
  }
});

export default router;