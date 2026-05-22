import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pdfParse from "pdf-parse";

export const bankUploadRouter = express.Router();

// store into project /uploads (created if missing)
const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Simple CSV parser (header row + comma separated)
function parseCsv(buf: Buffer) {
  const text = buf.toString("utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map(c => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

// Generic CSV upload
bankUploadRouter.post("/csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, error: "No file" });
    const raw = fs.readFileSync(req.file.path);
    const rows = parseCsv(raw);

    // Stage rows only — return to client for Approve/Edit/Delete
    // (Later: insert into expenses after approval)
    return res.json({ ok: true, source: "csv", count: rows.length, rows });
  } catch (e:any) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message || "csv_error" });
  }
});

// PDF upload
bankUploadRouter.post("/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, error: "No file" });
    const buf = fs.readFileSync(req.file.path);
    const pdf = await pdfParse(buf);

    // For now: return raw text for client-side mapping.
    // (Later: add per-bank line extraction rules.)
    return res.json({ ok: true, source: "pdf", meta: pdf.metadata ?? null, text: pdf.text });
  } catch (e:any) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message || "pdf_error" });
  }
});
