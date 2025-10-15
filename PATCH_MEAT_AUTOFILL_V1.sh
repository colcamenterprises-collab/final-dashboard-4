#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
echo "== Meat Autofill Patch: start =="

# --- 1) Update backend router: add meat auto-fill logic + refresh endpoint
cat > server/routes/stockReviewManual_autopatch.mjs <<'JS'
import fs from "fs";

const file = "server/routes/stockReviewManual.ts";
let src = fs.readFileSync(file, "utf8");

// Only patch once: guard on marker
if (!src.includes("// [MEAT-AUTO]")) {
  // Inject helper + endpoints. We'll append near the end but before export default
  src = src.replace(
    /export default router;\s*$/m,
`// [MEAT-AUTO] --- begin meat autofill helpers
type ColHint = { table:string, cols:string[] };

async function columnExists(pool:any, tbl:string, col:string) {
  const q = \`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2
    LIMIT 1
  \`;
  const r = await pool.query(q, [tbl, col]);
  return r.rowCount > 0;
}

/** Try to detect meat purchase sources and return grams for a given day */
async function sumMeatPurchasesGrams(pool:any, day:string): Promise<number> {
  // Candidates (add more if your schema differs)
  const candidates: Array<() => Promise<number>> = [

    // A) meat_purchases(date, weight_g) or (date, weight, unit)
    async () => {
      const tbl = "meat_purchases";
      if (!(await columnExists(pool, tbl, "date"))) return 0;

      if (await columnExists(pool, tbl, "weight_g")) {
        const r = await pool.query(\`SELECT COALESCE(SUM(weight_g),0)::bigint AS g FROM \${tbl} WHERE date = $1\`, [day]);
        return Number(r.rows[0]?.g ?? 0);
      }
      if (await columnExists(pool, tbl, "weight")) {
        const hasUnit = await columnExists(pool, tbl, "unit");
        const sql = hasUnit
          ? \`SELECT COALESCE(SUM(ROUND(weight * CASE WHEN lower(unit) LIKE 'kg%%' THEN 1000 ELSE 1 END)),0)::bigint AS g FROM \${tbl} WHERE date = $1\`
          : \`SELECT COALESCE(SUM(ROUND(weight)),0)::bigint AS g FROM \${tbl} WHERE date = $1\`;
        const r = await pool.query(sql, [day]);
        return Number(r.rows[0]?.g ?? 0);
      }
      return 0;
    },

    // B) expenses_meat(date, amount_g)
    async () => {
      const tbl = "expenses_meat";
      if (!(await columnExists(pool, tbl, "date"))) return 0;
      const col = (await columnExists(pool, tbl, "amount_g")) ? "amount_g"
               : (await columnExists(pool, tbl, "weight_g")) ? "weight_g"
               : null;
      if (!col) return 0;
      const r = await pool.query(\`SELECT COALESCE(SUM(\${col}),0)::bigint AS g FROM \${tbl} WHERE date=$1\`, [day]);
      return Number(r.rows[0]?.g ?? 0);
    },

    // C) expense_items(date, category, qty_g)
    async () => {
      const tbl = "expense_items";
      if (!(await columnExists(pool, tbl, "date"))) return 0;
      if (!(await columnExists(pool, tbl, "category"))) return 0;
      let col = null;
      if (await columnExists(pool, tbl, "qty_g")) col = "qty_g";
      else if (await columnExists(pool, tbl, "weight_g")) col = "weight_g";
      if (!col) return 0;
      const r = await pool.query(
        \`SELECT COALESCE(SUM(\${col}),0)::bigint AS g
         FROM \${tbl}
         WHERE date=$1 AND lower(category) LIKE 'meat%'\`,
        [day]
      );
      return Number(r.rows[0]?.g ?? 0);
    },

  ];

  for (const fn of candidates) {
    try {
      const g = await fn();
      if (g > 0) return g;
    } catch {}
  }
  return 0;
}

/** Read meatEnd from daily_sales_v2 payload for given date (if present) */
async function findMeatActualFromForms(pool:any, day:string): Promise<number> {
  try {
    // shiftDate may be text or date; cast both sides to text for safety
    const r = await pool.query(\`
      SELECT COALESCE( (payload->>'meatEnd')::bigint, 0 ) AS meat_end
      FROM daily_sales_v2
      WHERE to_char("shiftDate"::timestamp, 'YYYY-MM-DD') = $1
         OR "shiftDate"::text = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    \`, [day]);
    return Number(r.rows[0]?.meat_end ?? 0);
  } catch {
    return 0;
  }
}

/** Load prior day meat actual to use as prev_end */
async function findPrevMeatActual(pool:any, day:string): Promise<number> {
  const r = await pool.query(\`
    SELECT meat_actual_g
    FROM stock_ledger_day
    WHERE day = $1::date - INTERVAL '1 day'
    LIMIT 1
  \`, [day]);
  return Number(r.rows[0]?.meat_actual_g ?? 0);
}

/** Compute meat expected from fields */
function meatExpected(prev:number, purchased:number, sold:number) {
  return Math.max(0, (prev|0) + (purchased|0) - (sold|0));
}

/** POST /manual-ledger/refresh-meat?date=YYYY-MM-DD
 *  - pulls prev_end, purchased_g, actual_g from sources and UPSERTS meat fields only
 */
router.post("/refresh-meat", async (req, res) => {
  try {
    await ensureSchema();
    const day = dayStr(String(req.query.date || req.body?.day || ""));
    const prev = await findPrevMeatActual(pool, day);
    const purchased = await sumMeatPurchasesGrams(pool, day);
    // sold remains as-is (manual for now)
    const current = await pool.query(\`SELECT meat_sold_g FROM stock_ledger_day WHERE day=$1\`, [day]);
    const sold = Number(current.rows?.[0]?.meat_sold_g ?? 0);
    const actual = await findMeatActualFromForms(pool, day);
    const expected = meatExpected(prev, purchased, sold);

    await pool.query(\`
      INSERT INTO stock_ledger_day(
        day, meat_prev_end_g, meat_purchased_g, meat_sold_g, meat_expected_g, meat_actual_g, meat_paid, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,'N', NOW())
      ON CONFLICT (day) DO UPDATE SET
        meat_prev_end_g = EXCLUDED.meat_prev_end_g,
        meat_purchased_g = EXCLUDED.meat_purchased_g,
        meat_expected_g = EXCLUDED.meat_expected_g,
        meat_actual_g = EXCLUDED.meat_actual_g,
        updated_at = NOW()
    \`, [day, prev, purchased, sold, expected, actual]);

    const out = { ok:true, day, prev_end_g: prev, purchased_g: purchased, sold_g: sold, expected_g: expected, actual_g: actual };
    res.json(out);
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message });
  }
});

// [MEAT-AUTO] --- end meat autofill helpers

export default router;
`
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("Patched stockReviewManual.ts with meat auto-fill ✅");
} else {
  console.log("Meat auto-fill already present; skipping ✅");
}
JS

node server/routes/stockReviewManual_autopatch.mjs

# --- 2) Update the Stock Review page: add "Auto" button for Meat
cat > client/src/pages/analysis/StockReview_autopatch.mjs <<'JS'
import fs from "fs";
const file = "client/src/pages/analysis/StockReview.tsx";
let src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

if (src && !src.includes("/* [MEAT-AUTO-BTN] */")) {
  // Insert the Auto button in the Meat card's header
  src = src.replace(
    /(<div className="flex items-center justify-between mb-2">\s*<h2 className="text-base font-medium">Meat \(grams\)<\/h2>\s*<span[^>]*>[^<]*<\/span>\s*<\/div>)/m,
`$1
{/* [MEAT-AUTO-BTN] */}
<div className="flex items-center gap-2 mb-2">
  <button
    onClick={async ()=>{
      try{
        const res = await fetch(\`/api/stock-review/manual-ledger/refresh-meat?date=\${day}\`, { method:"POST" });
        const j = await res.json();
        if(!j.ok){ alert(j.error || "Auto-fill failed"); return; }
        // Pull fresh state
        const r = await fetch(\`/api/stock-review/manual-ledger?date=\${day}\`);
        const d = await r.json();
        if(d?.ok){
          setMeat(d.meat);
        }
      }catch(e){ alert("Auto-fill failed"); }
    }}
    className="h-9 rounded-xl border px-3 text-sm"
    title="Auto-fill Prev/Purchased/Actual from Expenses & Form 2"
  >Auto</button>
</div>`
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("Patched StockReview.tsx with meat Auto button ✅");
} else {
  console.log("StockReview.tsx not found or already patched; skipping.");
}
JS

node client/src/pages/analysis/StockReview_autopatch.mjs || true

echo "== Meat Autofill Patch: done =="
echo "Restart your server/workflow, then open: /analysis/stock-review"
echo "Use the Meat card's 'Auto' button to pull Prev/Purchased/Actual automatically."
