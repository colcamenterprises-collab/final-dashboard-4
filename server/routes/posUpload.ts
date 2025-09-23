import { Router } from "express";
import multer from "multer";
import { processPosCsv } from "../services/posUploadService";

const upload = multer({ dest: "uploads/" });
const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const result = await processPosCsv(req.file.path);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process file" });
  }
});

export default router;