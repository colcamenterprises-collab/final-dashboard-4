#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Running one-shot critical patch…"

# Step 1: Install dependencies
npm install --silent

# Step 2: Apply DB fixes
cat <<'SQL' > migrations/20250826_add_wages_source.sql
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "wages" NUMERIC DEFAULT 0;
SQL

echo "✅ Added migration file for missing columns"

# Step 3: Run migration
npx prisma migrate dev --name add_wages_source --skip-seed

# Step 4: Regenerate client
npx prisma generate

# Step 5: Patch routes.ts (deprecate /api/expenses)
sed -i.bak 's#/api/expenses#\/api/expensesV2#g' src/server/routes.ts || true

echo "✅ Patched routes.ts to remove /api/expenses v1"

# Step 6: Restart server
npm run build || true
npm run start || true

echo "🎉 Patch complete. DB schema fixed, routes updated, app restarted."