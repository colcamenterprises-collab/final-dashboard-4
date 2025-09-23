import express from "express";
import multer from "multer";
import { processPosCsv, getShiftSummary } from "../services/posUploadService";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("🔥 POS UPLOAD HANDLER CALLED");
  if (!req.file) {
    console.log("❌ No file uploaded");
    return res.status(400).json({ error: "No file uploaded" });
  }
  console.log("📁 File uploaded:", req.file.filename, req.file.size, "bytes");
  try {
    const result = await processPosCsv(req.file.path);
    console.log("✅ processPosCsv result:", result);
    res.json(result);
  } catch (err) {
    console.log("💥 processPosCsv error:", err);
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

router.get("/shifts", async (req, res) => {
  try {
    const { db } = await import("../db");
    const { loyverse_shifts } = await import("../../shared/schema");
    const { desc } = await import("drizzle-orm");
    
    const shifts = await db.select().from(loyverse_shifts).orderBy(desc(loyverse_shifts.shiftDate)).limit(50);
    res.json({ shifts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch shifts" });
  }
});

export default router;