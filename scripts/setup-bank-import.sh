#!/usr/bin/env bash
set -euo pipefail

echo "==> 1) Installing dependencies..."
npm ls multer >/dev/null 2>&1 || npm install multer
npm ls pdf-parse >/dev/null 2>&1 || npm install pdf-parse

echo "==> 2) Ensuring folder exists: src/server/bank"
mkdir -p src/server/bank

ROUTER_FILE="src/server/bank/router.ts"
if [ ! -f "$ROUTER_FILE" ]; then
  echo "==> 3) Creating $ROUTER_FILE"
  cat > "$ROUTER_FILE" <<'TS'
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
TS
else
  echo "==> 3) Skipping create: $ROUTER_FILE already exists"
fi

ROUTES_FILE="server/routes.ts"

# Import line to add (idempotent)
IMPORT_LINE='import bankImportRouter from "@/server/bank/router";'
# app.use line to add (idempotent) – mount under /api/bank-imports
USE_LINE='app.use("/api/bank-imports", bankImportRouter);'

echo "==> 4) Patching $ROUTES_FILE (idempotent)"
# Insert import if missing (after first import line)
if ! grep -qF "$IMPORT_LINE" "$ROUTES_FILE"; then
  # add after the last import line to be safe
  awk -v add="$IMPORT_LINE" '
    BEGIN{done=0}
    /^import /{last=NR}
    {print}
    END{
      if (last>0){
        # no-op: we will re-write file below
      }
    }' "$ROUTES_FILE" > "$ROUTES_FILE.tmp"

  # Rebuild file with import injected after the last import
  awk -v add="$IMPORT_LINE" '
    BEGIN{injected=0; last=0}
    {lines[NR]=$0; if($0 ~ /^import /) last=NR}
    END{
      for(i=1;i<=NR;i++){
        print lines[i]
        if (i==last && injected==0){ print add; injected=1 }
      }
    }' "$ROUTES_FILE" > "$ROUTES_FILE.tmp2"
  mv "$ROUTES_FILE.tmp2" "$ROUTES_FILE"
fi

# Insert app.use if missing – place near other routers
if ! grep -qF "$USE_LINE" "$ROUTES_FILE"; then
  awk -v add="$USE_LINE" '
    BEGIN{inserted=0}
    {print}
    /Purchase Tally router|Use the new expenses V2 router/{
      if (!inserted){
        # Insert right after this section comment line once
        print add
        inserted=1
      }
    }' "$ROUTES_FILE" > "$ROUTES_FILE.tmp" || true

  # Fallback: append at end if pattern not found
  if ! grep -qF "$USE_LINE" "$ROUTES_FILE.tmp" 2>/dev/null; then
    echo "$USE_LINE" >> "$ROUTES_FILE.tmp"
  fi
  mv "$ROUTES_FILE.tmp" "$ROUTES_FILE"
fi

echo "==> 5) Generating Prisma client (safe)"
npx prisma generate >/dev/null

echo "==> 6) Done. Endpoints now available:"
echo "    • POST /api/bank-imports/pdf   (multipart/form-data, field: file)"
echo "    • POST /api/bank-imports/csv   (multipart/form-data, field: file)"

# Optional: restart your dev server if you use a Run script
# Uncomment the next line if desired:
# pkill -f node || true
# npm run dev &
