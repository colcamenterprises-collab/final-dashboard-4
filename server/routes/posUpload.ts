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

router.post("/sync-daily", async (req, res) => {
  try {
    const { businessDate } = req.body;
    
    if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return res.status(400).json({ error: 'Invalid businessDate format (expected YYYY-MM-DD)' });
    }
    
    const { ingestShiftForDate } = await import('../services/loyverseIngest');
    const result = await ingestShiftForDate(businessDate);
    
    res.json({ 
      success: true, 
      businessDate,
      sales: result.sales,
      expenses: result.expenses,
      message: 'POS data synced successfully'
    });
  } catch (error) {
    console.error(`Daily sync error for ${req.body.businessDate}:`, error);
    res.status(500).json({ 
      error: 'Daily sync failed', 
      details: (error as Error).message 
    });
  }
});

export default router;