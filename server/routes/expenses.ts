// server/routes/expenses.ts
import { Router } from "express";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

export const expensesRouter = Router();

// Minimal stubs — replace with real Prisma writes later
expensesRouter.post("/purchase", async (req, res) => {
  const body = req.body || {};
  console.log("[purchase]", body); // TODO: write to DB
  return res.json({ ok: true });
});

expensesRouter.post("/upload-statements", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file");
  console.log("[upload]", req.file.originalname, req.file.mimetype, req.file.size);
  // TODO: parse + attach to day/shift
  return res.json({ ok: true, name: req.file.originalname, size: req.file.size });
});