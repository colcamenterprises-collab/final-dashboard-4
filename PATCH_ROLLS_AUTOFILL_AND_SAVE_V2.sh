#!/usr/bin/env bash
set -euo pipefail
echo "== Patch: Rolls Autofill + Save Draft/Submit (one-pager) =="

# 1) Extend backend router with rolls auto-fill + save endpoints
cat > server/routes/stockReviewManual_rolls_autopatch.mjs <<'JS'
import fs from "fs";

const file = "server/routes/stockReviewManual.ts";
let src = fs.readFileSync(file, "utf8");

// Only patch once
if (!src.includes("// [ROLLS-AUTO]")) {
  // Insert helpers + endpoints before export
  src = src.replace(
    /export default router;\s*$/m,
`// [ROLLS-AUTO] --- begin rolls autofill + save endpoints

async function sumRollsPurchases(pool:any, day:string): Promise<number> {
  // Try common tables/columns for bun/rolls purchases. Returns PIECES (ints).
  const trySQL = async (sql:string, params:any[])=>{
    try { const r = await pool.query(sql, params); return Number(r.rows?.[0]?.qty ?? 0); } catch { return 0; }
  };
  // A) rolls_purchases(date, qty)
  let q = await trySQL(\`SELECT COALESCE(SUM(qty),0)::int AS qty FROM rolls_purchases WHERE date=$1\`, [day]);
  if (q>0) return q;
  // B) expense_items with category 'Buns'/'Rolls'
  q = await trySQL(\`
    SELECT COALESCE(SUM(qty),0)::int AS qty
    FROM expense_items
    WHERE date=$1 AND lower(category) IN ('buns','rolls','bread')
  \`, [day]);
  if (q>0) return q;
  // C) shopping_purchases with item like %bun% or %roll%
  q = await trySQL(\`
    SELECT COALESCE(SUM(quantity),0)::int AS qty
    FROM shopping_purchases
    WHERE date=$1 AND lower(item) ~ '(bun|roll)'
  \`, [day]);
  return q;
}

async function findRollsActualFromForms(pool:any, day:string): Promise<number> {
  try {
    const r = await pool.query(\`
      SELECT COALESCE( (payload->>'rollsEnd')::int, 0 ) AS rolls_end
      FROM daily_sales_v2
      WHERE to_char("shiftDate"::timestamp, 'YYYY-MM-DD') = $1
         OR "shiftDate"::text = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    \`, [day]);
    return Number(r.rows[0]?.rolls_end ?? 0);
  } catch { return 0; }
}

async function findPrevRollsActual(pool:any, day:string): Promise<number> {
  const r = await pool.query(\`
    SELECT rolls_actual FROM stock_ledger_day WHERE day=$1::date - INTERVAL '1 day' LIMIT 1
  \`, [day]);
  return Number(r.rows[0]?.rolls_actual ?? 0);
}
function rollsExpected(prev:number, purch:number, sold:number){ return Math.max(0,(prev|0)+(purch|0)-(sold|0)); }

/** POST /refresh-rolls?date=YYYY-MM-DD */
router.post("/refresh-rolls", async (req,res)=>{
  try{
    await ensureSchema();
    const day = dayStr(String(req.query.date || req.body?.day || ""));
    const prev = await findPrevRollsActual(pool, day);
    const purchased = await sumRollsPurchases(pool, day);
    const cur = await pool.query(\`SELECT rolls_sold FROM stock_ledger_day WHERE day=$1\`, [day]);
    const sold = Number(cur.rows?.[0]?.rolls_sold ?? 0);
    const actual = await findRollsActualFromForms(pool, day);
    const expected = rollsExpected(prev,purchased,sold);

    await pool.query(\`
      INSERT INTO stock_ledger_day(day, rolls_prev_end, rolls_purchased, rolls_sold, rolls_expected, rolls_actual, rolls_paid, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'N',NOW())
      ON CONFLICT (day) DO UPDATE SET
        rolls_prev_end=EXCLUDED.rolls_prev_end,
        rolls_purchased=EXCLUDED.rolls_purchased,
        rolls_expected=EXCLUDED.rolls_expected,
        rolls_actual=EXCLUDED.rolls_actual,
        updated_at=NOW()
    \`, [day, prev, purchased, sold, expected, actual]);

    res.json({ok:true, day, prev_end:prev, purchased, sold, expected, actual});
  }catch(e:any){ res.status(400).json({ok:false, error:e.message}); }
});

/** POST /save
 * Body: { day, status:'draft'|'submit', meat?, rolls?, drinks? } — each block optional
 * Only updates provided fields; set submitted=true when submit.
 */
router.post("/save", async (req,res)=>{
  try{
    await ensureSchema();
    const body = req.body||{};
    const day = dayStr(String(body.day||""));
    const status = (String(body.status||"draft").toLowerCase()==='submit') ? 'submit' : 'draft';

    // Build dynamic SET clause
    const sets:string[] = ['updated_at=NOW()'];
    const vals:any[] = [];
    let i=1;

    const setNum = (col:string, val:any)=>{
      if (val===undefined || val===null || Number.isNaN(Number(val))) return;
      sets.push(\`\${col}=$\${++i}\`); vals.push(Number(val));
    };
    const setStr = (col:string, val:any)=>{
      if (val===undefined) return;
      sets.push(\`\${col}=$\${++i}\`); vals.push(String(val));
    };

    const m=body.meat||{};
    setNum("meat_prev_end_g", m.prev_end);
    setNum("meat_purchased_g", m.purchased);
    setNum("meat_sold_g", m.sold);
    setNum("meat_expected_g", m.expected);
    setNum("meat_actual_g", m.actual);
    setStr("meat_paid", m.paid);

    const r=body.rolls||{};
    setNum("rolls_prev_end", r.prev_end);
    setNum("rolls_purchased", r.purchased);
    setNum("rolls_sold", r.sold);
    setNum("rolls_expected", r.expected);
    setNum("rolls_actual", r.actual);
    setStr("rolls_paid", r.paid);

    if (status==='submit') { sets.push("submitted=true"); } else { sets.push("submitted=false"); }

    // Upsert
    const sql = \`
      INSERT INTO stock_ledger_day(day, updated_at)
      VALUES ($1, NOW())
      ON CONFLICT (day) DO NOTHING;
      UPDATE stock_ledger_day SET \${sets.join(", ")} WHERE day=$1
      RETURNING *;
    \`;
    const rdb = await pool.query(sql, [day, ...vals]);
    res.json({ok:true, day, rows:rdb.rows?.length||0});
  }catch(e:any){ res.status(400).json({ok:false, error:e.message}); }
});

// [ROLLS-AUTO] --- end
export default router;
`
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("Patched stockReviewManual.ts with rolls auto + save endpoints ✅");
} else {
  console.log("Rolls auto/save already present; skipping ✅");
}
JS

node server/routes/stockReviewManual_rolls_autopatch.mjs

# 2) Ensure table has columns (idempotent)
cat > server/migrations/20251015_stock_ledger_rolls_submit.sql <<'SQL'
-- rolls + submitted columns (idempotent)
ALTER TABLE stock_ledger_day
  ADD COLUMN IF NOT EXISTS rolls_prev_end    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_purchased   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_sold        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_expected    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_actual      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_paid        char(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS submitted         boolean DEFAULT false;
SQL

# simple runner (works with Neon/psql env)
if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -f server/migrations/20251015_stock_ledger_rolls_submit.sql >/dev/null
  echo "DB migration applied ✅"
else
  echo "DATABASE_URL not set; please run migration manually."
fi

echo "== Patch complete. Backend ready for Rolls Auto + Save/Submit =="
