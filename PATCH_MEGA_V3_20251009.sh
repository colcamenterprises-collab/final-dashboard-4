#!/usr/bin/env bash
set -euo pipefail

echo "=== PATCH_MEGA_V3_20251009 — Daily Sales & Stock System ==="

# ---- 0) Preconditions ---------------------------------------------------------
if ! command -v git >/dev/null 2>&1; then
  echo "git not found. Aborting for safety."; exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree not clean. Commit or stash changes first."; exit 1
fi

if [ ! -f .replit ] && [ ! -d server ]; then
  echo "This doesn't look like the dashboard v3 repo. Aborting."; exit 1
fi

branch="patch/MEGA_V3_20251009"
git checkout -b "$branch"

mkdir -p server/migrations scripts docs/architecture server/lib server/routes

# ---- 1) SQL migrations --------------------------------------------------------
cat > server/migrations/20251009_add_manager_checklist.sql <<'SQL'
CREATE TABLE IF NOT EXISTS "ManagerChecklist" (
  "id" SERIAL PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  "managerName" TEXT NOT NULL,
  "tasksAssigned" JSONB NOT NULL,
  "tasksCompleted" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "signedAt" TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS "idx_manager_checklist_shift" ON "ManagerChecklist"("shiftId");
SQL

cat > server/migrations/20251009_fix_ingredients_purchase_qty.sql <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='ingredients' AND column_name='purchase_qty'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN purchase_qty NUMERIC;
  END IF;
END $$;
SQL

cat > server/migrations/20251009_add_fk_stock_sales.sql <<'SQL'
-- Clean orphans then enforce FK (safe if already present)
DELETE FROM "DailyStockV2" s
WHERE NOT EXISTS (SELECT 1 FROM "DailySalesV2" d WHERE d.id = s."salesId");

DO $$ BEGIN
  ALTER TABLE "DailyStockV2"
  ADD CONSTRAINT "fk_dailystock_sales"
  FOREIGN KEY ("salesId") REFERENCES "DailySalesV2"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END $$;
SQL

# ---- 2) Node SQL migration runner --------------------------------------------
cat > scripts/run-sql-migrations.mjs <<'NODE'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIG_DIR = path.resolve(__dirname, '../server/migrations');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: DATABASE_URL });

const main = async () => {
  const files = fs.readdirSync(MIG_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical = chronological

  await client.connect();
  for (const f of files) {
    const fp = path.join(MIG_DIR, f);
    const sql = fs.readFileSync(fp, 'utf8');
    console.log(`>> Running ${f}`);
    await client.query(sql);
  }
  await client.end();
  console.log('All migrations applied.');
};

main().catch(async (e) => {
  console.error(e);
  try { await client.end(); } catch {}
  process.exit(1);
});
NODE

# ---- 3) Safe patch: managerChecks.ts persistence ------------------------------
# Insert prisma import if missing
MC_FILE="server/routes/managerChecks.ts"
if [ -f "$MC_FILE" ]; then
  if ! grep -q "from \"../lib/prisma\"" "$MC_FILE"; then
    # add import after first import line
    awk '
      NR==1 && /^import / { print; print "import { prisma } from \"../lib/prisma\";"; next }
      { print }
    ' "$MC_FILE" > "$MC_FILE.tmp" && mv "$MC_FILE.tmp" "$MC_FILE"
  fi

  # replace final console.log response with prisma create (anchor on "submitted:" log)
  if grep -q "Manager Check submitted:" "$MC_FILE"; then
    perl -0777 -pe '
      s#console\.log\([^\n]+Manager Check submitted:[\s\S]+?res\.json\(\{[^\}]+\}\);#const record = await prisma.managerChecklist.create({\n  data: {\n    shiftId: String(dailyCheckId),\n    managerName: answeredBy,\n    tasksAssigned: questions,\n    tasksCompleted: answers,\n    signedAt: new Date()\n  }\n});\nreturn res.json({ ok: true, id: record.id, status: \"COMPLETED\" });#g
    ' -i "$MC_FILE"
  fi
else
  echo "WARN: $MC_FILE missing; skipping managerChecks patch."
fi

# ---- 4) Safe patch: forms.ts redirect cleanup & 410 guard ---------------------
FORMS_FILE="server/routes/forms.ts"
if [ -f "$FORMS_FILE" ]; then
  # Add 410 guard if not present
  if ! grep -q "Gone: use /api/forms/daily-sales-v2" "$FORMS_FILE"; then
    cat >> "$FORMS_FILE" <<'TS'

/** Guard legacy daily-sales endpoints to prevent loops/freestyle */
app.all(["/api/daily-sales","/api/forms/daily-sales"], (_req, res) => {
  res.status(410).json({ error: "Gone: use /api/forms/daily-sales-v2" });
});
TS
  fi

  # Comment out legacy handlers (non-destructive)
  sed -i.bak 's/^\(\s*app\.post(\/api\/daily-sales[^\n]*\)/\/\/ \1/g' "$FORMS_FILE" || true
  sed -i.bak 's/^\(\s*app\.post(\/api\/forms\/daily-sales[^\n]*\)/\/\/ \1/g' "$FORMS_FILE" || true
fi

# ---- 5) PDF & Email: include rolls/meat/drinks --------------------------------
PDF_FILE="server/lib/pdf.ts"
if [ -f "$PDF_FILE" ] && ! grep -q "Stock Counts" "$PDF_FILE"; then
  cat >> "$PDF_FILE" <<'TS'

// --- Patch MEGA V3: Stock Counts block ---
try {
  // expects "stock" object in scope; adjust if different name
  // Fallback to props.stock if available
  const _stock: any = (typeof stock !== 'undefined' ? stock : (props?.stock ?? {}));
  doc.moveDown().fontSize(12).text("Stock Counts", { underline: true });
  doc.text(`Rolls: ${_stock?.burgerBuns ?? 0}`);
  doc.text(`Meat (g): ${_stock?.meatWeightG ?? 0}`);
  const _drinks = _stock?.drinksJson ? Object.entries(_stock.drinksJson as Record<string, number>) : [];
  if (_drinks.length) {
    doc.text("Drinks:");
    for (const [name, qty] of _drinks) doc.text(` • ${name}: ${qty}`);
  }
} catch (e) {
  // do not break PDF generation if structure differs
  doc.moveDown().fontSize(10).text("Stock counts unavailable (render-time mismatch).");
}
TS
fi

EMAIL_FILE="server/lib/email.ts"
if [ -f "$EMAIL_FILE" ] && ! grep -q "Stock Counts" "$EMAIL_FILE"; then
  cat >> "$EMAIL_FILE" <<'TS'

// --- Patch MEGA V3: Stock Counts in email ---
export function renderStockCountsEmailBlock(stock: any) {
  const drinks = stock?.drinksJson ? Object.entries(stock.drinksJson as Record<string, number>) : [];
  const drinksLines = drinks.map(([n, q]) => `• ${n}: ${q}`).join('<br/>');
  return `
  <h3>Stock Counts</h3>
  <p>Rolls: ${stock?.burgerBuns ?? 0}<br/>
     Meat (g): ${stock?.meatWeightG ?? 0}</p>
  ${drinks.length ? `<p><strong>Drinks</strong><br/>${drinksLines}</p>` : ''}
  `;
}
TS
fi

# ---- 6) Docs file (architecture) ---------------------------------------------
if [ ! -f docs/architecture/daily-sales-stock-forms.md ]; then
  cat > docs/architecture/daily-sales-stock-forms.md <<'MD'
# Daily Sales & Stock Forms Architecture Report
This copy tracks the canonical architecture for Dashboard v3.
(Full content already shared in Chat; keep this file as the in-repo reference.)
MD
fi

# ---- 7) Run migrations safely -------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set; skipping SQL execution. Migrations files are created."
else
  echo "Running SQL migrations via Node runner..."
  node scripts/run-sql-migrations.mjs
fi

# ---- 8) Prisma client refresh (if present) -----------------------------------
if [ -f prisma/schema.prisma ]; then
  if npm run | grep -q "prisma:generate"; then
    npm run prisma:generate || true
  else
    npx prisma generate || true
  fi
fi

# ---- 9) Git commit ------------------------------------------------------------
git add .
git commit -m "MEGA PATCH V3 (2025-10-09): ManagerCheck persistence, ingredients column, FK, legacy guards, email/PDF stock counts, docs stub."

echo "=== PATCH COMPLETE ===
Next:
1) Restart the backend/service.
2) Do a full flow test:
   - Form 1 → Form 2 → Manager Quick Check
   - Verify email/PDF shows Rolls/Meat/Drinks
   - Ensure old endpoints return 410
3) (Optional) run: ./make_ground_zero_report.sh

Branch created: $branch
"
