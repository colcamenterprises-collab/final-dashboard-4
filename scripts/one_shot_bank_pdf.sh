#!/usr/bin/env bash
set -euo pipefail

echo "▶ One-shot setup for Bank PDF uploads…"

ROOT="$(pwd)"
echo "• Working in: $ROOT"

# -------- deps (safe to re-run) --------
echo "• Installing deps (multer, pdf-parse, tsx, typescript)…"
npm install multer pdf-parse >/dev/null 2>&1 || npm install multer pdf-parse
npm install -D tsx@4 typescript @types/node >/dev/null 2>&1 || true

# -------- server files --------
mkdir -p src/server/bank

TARGET=src/server/bank/upload.ts
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$TARGET.bak.$(date +%s)" || true
fi

cat > "$TARGET" << "TS"
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
TS

# -------- ensure uploads dir --------
mkdir -p uploads

# -------- register router in server/routes.ts --------
ROUTES_FILE="server/routes.ts"
if [ -f "$ROUTES_FILE" ]; then
  # add import if missing
  if ! grep -q "bankUploadRouter" "$ROUTES_FILE"; then
    # place import near other imports
    awk '/^import .* from .*;/ && c==0 { print; next } { print }' "$ROUTES_FILE" > "$ROUTES_FILE.tmp"
    mv "$ROUTES_FILE.tmp" "$ROUTES_FILE"
    # safest is to append the import (paths differ per repo); try two common paths:
    if ! grep -q "bankUploadRouter" "$ROUTES_FILE"; then
      echo "import { bankUploadRouter } from \"../src/server/bank/upload\";" >> "$ROUTES_FILE" || true
      echo "import { bankUploadRouter as bankUploadRouterAlt } from \"../src/server/bank/upload\";" >/dev/null 2>&1 || true
    fi
  fi

  # add app.use if missing
  if ! grep -q "bankUploadRouter" "$ROUTES_FILE"; then
    echo "" >> "$ROUTES_FILE"
    echo "// Bank PDF upload router (auto-added)" >> "$ROUTES_FILE"
    echo "app.use(\"/api\", bankUploadRouter);" >> "$ROUTES_FILE"
  else
    if ! grep -q "app.use(\"/api\", bankUploadRouter)" "$ROUTES_FILE"; then
      # insert near other app.use lines
      sed -i.bak "/app.use(.*api.*);/!b;n" "$ROUTES_FILE" 2>/dev/null || true
      echo "// Bank PDF upload router (auto-added)" >> "$ROUTES_FILE"
      echo "app.use(\"/api\", bankUploadRouter);" >> "$ROUTES_FILE"
    fi
  fi
else
  echo "⚠ Could not find $ROUTES_FILE — please add this line where other routers are registered:"
  echo "   app.use(\"/api\", bankUploadRouter);"
fi

# -------- build/run hint --------
echo "• Done. If the app is running, it will pick this up on save."
echo "• If it crashed, run:  npm run start"
echo "• Place a PDF at:     uploads/statement.pdf"
echo
echo "Test it with:"
echo "  curl -F \"file=@uploads/statement.pdf;type=application/pdf\" http://localhost:5000/api/bank-imports/pdf"
