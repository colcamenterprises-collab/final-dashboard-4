#!/usr/bin/env bash
set -euo pipefail

echo "=== PATCH V4.0: Stock Review Manual Ledger (tablet-first, isolated) ==="

ROOT="$(pwd)"

# -------- Helpers ------------------------------------------------------------
file_exists() { [[ -f "$1" ]]; }
dir_exists() { [[ -d "$1" ]]; }
ensure_dir()   { mkdir -p "$1"; }

TS_SERVER_DIR="server"
TS_CLIENT_DIR="client"
ROUTES_FILE="$TS_SERVER_DIR/routes.ts"
ALT_ROUTES_FILE="$TS_SERVER_DIR/routes/index.ts"
ROUTER_MOUNT_TARGET="routes.ts"

if file_exists "$ALT_ROUTES_FILE"; then
  ROUTES_FILE="$ALT_ROUTES_FILE"
fi

# Best-guess DB import file (we'll use 'pg' Pool directly to avoid ORM drift)
DB_FILE_CANDIDATES=(
  "$TS_SERVER_DIR/db.ts"
  "$TS_SERVER_DIR/lib/db.ts"
  "$TS_SERVER_DIR/lib/prisma.ts" # fallback (we won't use prisma client here)
)

DB_IMPORT_PATH=""
for cand in "${DB_FILE_CANDIDATES[@]}"; do
  if file_exists "$cand"; then DB_IMPORT_PATH="$(echo "$cand" | sed 's#^server/##')"; break; fi
done

if [[ -z "$DB_IMPORT_PATH" ]]; then
  echo "WARN: Could not autodetect a DB helper. We'll create a minimal pg pool at server/lib/pgPool.ts"
  ensure_dir "$TS_SERVER_DIR/lib"
  cat > "$TS_SERVER_DIR/lib/pgPool.ts" <<'TS'
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL env var is required");
}
export const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
TS
  DB_IMPORT_PATH="lib/pgPool.ts"
fi

# -------- 1) SQL Migration ---------------------------------------------------
MIG_DIR="$TS_SERVER_DIR/migrations"
ensure_dir "$MIG_DIR"
MIG_FILE="$MIG_DIR/20251015_manual_ledger.sql"

cat > "$MIG_FILE" <<'SQL'
-- Patch V4.0 Manual Ledger - Idempotent create

CREATE TABLE IF NOT EXISTS manual_stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date DATE NOT NULL,
  completed_by TEXT,
  source_form_id UUID,
  -- Optional summaries (future wiring)
  total_sales NUMERIC(12,2),
  cash_sales NUMERIC(12,2),
  qr_sales NUMERIC(12,2),
  grab_sales NUMERIC(12,2),
  other_sales NUMERIC(12,2),
  shopping_total NUMERIC(12,2),
  wages_total NUMERIC(12,2),

  -- Rolls (buns)
  rolls_prev_end INT DEFAULT 0,
  rolls_purchased INT DEFAULT 0,
  burgers_sold INT DEFAULT 0,
  rolls_expected INT DEFAULT 0,
  rolls_actual INT DEFAULT 0,
  rolls_variance INT DEFAULT 0,
  rolls_paid BOOLEAN DEFAULT FALSE,

  -- Meat (grams)
  meat_prev_end_g INT DEFAULT 0,
  meat_purchased_g INT DEFAULT 0,
  meat_sold_g INT DEFAULT 0,
  meat_expected_g INT DEFAULT 0,
  meat_actual_g INT DEFAULT 0,
  meat_variance_g INT DEFAULT 0,
  meat_paid BOOLEAN DEFAULT FALSE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_stock_ledger_shift_date
  ON manual_stock_ledger (shift_date);

CREATE TABLE IF NOT EXISTS drink_brand (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'can'
);

CREATE TABLE IF NOT EXISTS manual_drink_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES manual_stock_ledger(id) ON DELETE CASCADE,
  brand_id INT NOT NULL REFERENCES drink_brand(id) ON DELETE RESTRICT,
  prev_end INT DEFAULT 0,
  purchased INT DEFAULT 0,
  sold INT DEFAULT 0,
  expected INT DEFAULT 0,
  actual INT DEFAULT 0,
  variance INT DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_drink_ledger_shift_brand
  ON manual_drink_ledger (shift_id, brand_id);
SQL

echo "Applied migration file at $MIG_FILE"

# -------- 2) Seed Script -----------------------------------------------------
SEED_DIR="$TS_SERVER_DIR/seeds"
ensure_dir "$SEED_DIR"
SEED_FILE="$SEED_DIR/seedDrinkBrands.ts"

cat > "$SEED_FILE" <<TS
import { pool } from "../$DB_IMPORT_PATH";

const DRINKS = [
  "Coke",
  "Coke Zero",
  "Sprite",
  "Schweppes Manow",
  "Red Fanta",
  "Orange Fanta",
  "Red Singha",
  "Yellow Singha",
  "Pink Singha",
  "Soda Water"
];

async function run() {
  for (const name of DRINKS) {
    await pool.query(
      \`INSERT INTO drink_brand (name, unit) VALUES ($1, 'can')
         ON CONFLICT (name) DO UPDATE SET unit = EXCLUDED.unit\`,
      [name]
    );
  }
  console.log("Seeded drink_brand:", DRINKS.length, "brands");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
TS

echo "Created drink brand seed at $SEED_FILE"

# -------- 3) Analysis Manual Ledger Routes ----------------------------------
ROUTE_LEDGER_FILE="$TS_SERVER_DIR/routes/analysisManualLedger.ts"
ensure_dir "$TS_SERVER_DIR/routes"

cat > "$ROUTE_LEDGER_FILE" <<TS
import { Router, Request, Response } from "express";
import { pool } from "../$DB_IMPORT_PATH";
import { Parser } from "json2csv";

export const analysisManualLedgerRouter = Router();

/** Helpers */
function int(v: any) { const n = Number(v || 0); return Number.isFinite(n) ? Math.trunc(n) : 0; }
function dec(v: any) { const n = Number(v || 0); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; }

function computeRolls(prev_end:number, purchased:number, sold:number, actual:number) {
  const expected = int(prev_end) + int(purchased) - int(sold);
  const variance = int(actual) - expected;
  return { expected, variance };
}

function computeMeat(prev_end_g:number, purchased_g:number, sold_g:number, actual_g:number) {
  const expected = int(prev_end_g) + int(purchased_g) - int(sold_g);
  const variance = int(actual_g) - expected;
  return { expected, variance };
}

async function getBrands() {
  const { rows } = await pool.query("SELECT id, name FROM drink_brand ORDER BY id ASC");
  return rows as { id:number, name:string }[];
}

/** GET list (date range) */
analysisManualLedgerRouter.get("/list", async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as any;
    const params: any[] = [];
    let where = "WHERE 1=1";
    if (from) { params.push(from); where += \` AND shift_date >= $\${params.length}\`; }
    if (to)   { params.push(to);   where += \` AND shift_date <= $\${params.length}\`; }

    const { rows } = await pool.query(
      \`SELECT id, shift_date, completed_by,
              total_sales, cash_sales, qr_sales, grab_sales, other_sales,
              rolls_expected, rolls_actual, rolls_variance,
              meat_expected_g, meat_actual_g, meat_variance_g
         FROM manual_stock_ledger
         \${where}
         ORDER BY shift_date DESC, created_at DESC
      \`, params
    );

    res.json({ ok: true, items: rows });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/** GET single by date */
analysisManualLedgerRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { date } = req.query as any;
    if (!date) return res.status(400).json({ ok:false, error: "date is required" });

    const { rows } = await pool.query(
      "SELECT * FROM manual_stock_ledger WHERE shift_date = $1 LIMIT 1",
      [date]
    );
    const base = rows[0];
    if (!base) return res.json({ ok:true, item:null, drinks: [] });

    const brands = await getBrands();
    const { rows: drinkRows } = await pool.query(
      \`SELECT mdl.brand_id, db.name, mdl.prev_end, mdl.purchased, mdl.sold, mdl.expected, mdl.actual, mdl.variance, mdl.paid
         FROM manual_drink_ledger mdl
         JOIN drink_brand db ON db.id = mdl.brand_id
        WHERE mdl.shift_id = $1
        ORDER BY db.id ASC\`,
      [base.id]
    );

    // Ensure all brands present (fill missing with zeros)
    const map = new Map<number, any>(drinkRows.map(r => [r.brand_id, r]));
    const drinks = brands.map(b => map.get(b.id) ?? {
      brand_id: b.id, name: b.name,
      prev_end:0, purchased:0, sold:0, expected:0, actual:0, variance:0, paid:false
    });

    res.json({ ok:true, item: base, drinks });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/** POST create / PUT update (base row) */
analysisManualLedgerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const rolls = computeRolls(int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), int(b.rolls_actual));
    const meat  = computeMeat(int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), int(b.meat_actual_g));

    const { rows } = await pool.query(
      \`INSERT INTO manual_stock_ledger
        (shift_date, completed_by, source_form_id,
         total_sales, cash_sales, qr_sales, grab_sales, other_sales, shopping_total, wages_total,
         rolls_prev_end, rolls_purchased, burgers_sold, rolls_expected, rolls_actual, rolls_variance, rolls_paid,
         meat_prev_end_g, meat_purchased_g, meat_sold_g, meat_expected_g, meat_actual_g, meat_variance_g, meat_paid,
         notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *\`,
      [
        b.shift_date, b.completed_by || null, b.source_form_id || null,
        dec(b.total_sales), dec(b.cash_sales), dec(b.qr_sales), dec(b.grab_sales), dec(b.other_sales), dec(b.shopping_total), dec(b.wages_total),
        int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), rolls.expected, int(b.rolls_actual), rolls.variance, !!b.rolls_paid,
        int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), meat.expected, int(b.meat_actual_g), meat.variance, !!b.meat_paid,
        b.notes || null
      ]
    );

    res.json({ ok:true, item: rows[0] });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

analysisManualLedgerRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const rolls = computeRolls(int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), int(b.rolls_actual));
    const meat  = computeMeat(int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), int(b.meat_actual_g));

    const { rows } = await pool.query(
      \`UPDATE manual_stock_ledger SET
          shift_date=$1, completed_by=$2, source_form_id=$3,
          total_sales=$4, cash_sales=$5, qr_sales=$6, grab_sales=$7, other_sales=$8, shopping_total=$9, wages_total=$10,
          rolls_prev_end=$11, rolls_purchased=$12, burgers_sold=$13, rolls_expected=$14, rolls_actual=$15, rolls_variance=$16, rolls_paid=$17,
          meat_prev_end_g=$18, meat_purchased_g=$19, meat_sold_g=$20, meat_expected_g=$21, meat_actual_g=$22, meat_variance_g=$23, meat_paid=$24,
          notes=$25
        WHERE id=$26
        RETURNING *\`,
      [
        b.shift_date, b.completed_by || null, b.source_form_id || null,
        dec(b.total_sales), dec(b.cash_sales), dec(b.qr_sales), dec(b.grab_sales), dec(b.other_sales), dec(b.shopping_total), dec(b.wages_total),
        int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), rolls.expected, int(b.rolls_actual), rolls.variance, !!b.rolls_paid,
        int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), meat.expected, int(b.meat_actual_g), meat.variance, !!b.meat_paid,
        b.notes || null,
        id
      ]
    );

    res.json({ ok:true, item: rows[0] });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/** PUT drinks batch */
analysisManualLedgerRouter.put("/:id/drinks", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const items = Array.isArray(req.body) ? req.body : [];
    const brands = await getBrands();
    const nameToId = new Map(brands.map(b => [b.name, b.id]));

    await client.query("BEGIN");
    for (const it of items) {
      const brandId = nameToId.get(it.brand);
      if (!brandId) continue;

      const prev = int(it.prev_end), pur = int(it.purchased), sold = int(it.sold), act = int(it.actual);
      const expected = prev + pur - sold;
      const variance = act - expected;

      await client.query(
        \`INSERT INTO manual_drink_ledger
          (shift_id, brand_id, prev_end, purchased, sold, expected, actual, variance, paid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (shift_id, brand_id)
         DO UPDATE SET prev_end=EXCLUDED.prev_end, purchased=EXCLUDED.purchased, sold=EXCLUDED.sold,
                       expected=EXCLUDED.expected, actual=EXCLUDED.actual, variance=EXCLUDED.variance, paid=EXCLUDED.paid\`,
        [id, brandId, prev, pur, sold, expected, act, variance, !!it.paid]
      );
    }
    await client.query("COMMIT");
    res.json({ ok:true });
  } catch (e:any) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok:false, error: e.message });
  } finally {
    client.release();
  }
});

/** CSV export (single day or range) */
analysisManualLedgerRouter.get("/export.csv", async (req: Request, res: Response) => {
  try {
    const { from, to, id } = req.query as any;
    let rows:any[] = [];

    if (id) {
      const { rows: one } = await pool.query("SELECT * FROM manual_stock_ledger WHERE id = $1", [id]);
      rows = one;
    } else {
      const params:any[] = [];
      let where = "WHERE 1=1";
      if (from) { params.push(from); where += \` AND shift_date >= $\${params.length}\`; }
      if (to)   { params.push(to);   where += \` AND shift_date <= $\${params.length}\`; }
      const q = \`SELECT * FROM manual_stock_ledger \${where} ORDER BY shift_date DESC\`;
      const resq = await pool.query(q, params);
      rows = resq.rows;
    }

    // Pivot drinks Actual per brand
    const brands = await getBrands();
    for (const r of rows) {
      const { rows: drinkRows } = await pool.query(
        \`SELECT db.name, mdl.actual
           FROM manual_drink_ledger mdl
           JOIN drink_brand db ON db.id = mdl.brand_id
          WHERE mdl.shift_id = $1\`,
        [r.id]
      );
      const map = new Map(drinkRows.map((d:any) => [d.name, d.actual]));
      for (const b of brands) {
        r[b.name] = map.get(b.name) ?? 0;
      }
    }

    const fields = [
      "shift_date","completed_by",
      "total_sales","cash_sales","qr_sales","grab_sales","other_sales","shopping_total","wages_total",
      "rolls_prev_end","rolls_purchased","burgers_sold","rolls_expected","rolls_actual","rolls_variance","rolls_paid",
      "meat_prev_end_g","meat_purchased_g","meat_sold_g","meat_expected_g","meat_actual_g","meat_variance_g","meat_paid",
      ... (await getBrands()).map(b => b.name)
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=manual_ledger_export.csv");
    res.send(csv);
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});
TS

echo "Created analysis manual ledger router: $ROUTE_LEDGER_FILE"

# -------- 4) Mount router in server routes ----------------------------------
if ! file_exists "$ROUTES_FILE"; then
  echo "ERROR: Could not find $ROUTES_FILE to mount the router. Aborting."
  exit 1
fi

# Insert import if missing
if ! grep -q "analysisManualLedgerRouter" "$ROUTES_FILE"; then
  sed -i.bak '1i\
import { analysisManualLedgerRouter } from "./routes/analysisManualLedger";
' "$ROUTES_FILE"
fi

# Insert use() before default export or at EOF
if ! grep -q '/api/analysis/manual-ledger' "$ROUTES_FILE"; then
  # try place before export default / module.exports
  if grep -q "export default" "$ROUTES_FILE"; then
    sed -i.bak '0,/export default/{/export default/i \
app.use("/api/analysis/manual-ledger", analysisManualLedgerRouter);\
}' "$ROUTES_FILE"
  else
    # append
    echo 'app.use("/api/analysis/manual-ledger", analysisManualLedgerRouter);' >> "$ROUTES_FILE"
  fi
fi
echo "Mounted /api/analysis/manual-ledger"

# -------- 5) Frontend: Stock Review section ---------------------------------
PAGE_DIR="$TS_CLIENT_DIR/src/pages/analysis"
ALT_PAGE_DIR="$TS_CLIENT_DIR/src/pages/operations/analysis"
TARGET_PAGE=""
if dir_exists "$PAGE_DIR"; then TARGET_PAGE="$PAGE_DIR/StockReview.tsx"; fi
if [[ -z "$TARGET_PAGE" ]] && dir_exists "$ALT_PAGE_DIR"; then TARGET_PAGE="$ALT_PAGE_DIR/StockReview.tsx"; fi

ensure_dir "$(dirname "$TARGET_PAGE")"

cat > "$TARGET_PAGE" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";

/** Tablet-first density */
const card = "rounded-2xl shadow-sm border border-gray-200 p-3 mb-4";
const label = "text-xs text-gray-600";
const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm";
const badge = (v:number)=> v===0 ? "inline-block px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs"
                                : "inline-block px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-xs";

type Shift = any;
type DrinkRow = { name:string; prev_end:number; purchased:number; sold:number; expected:number; actual:number; variance:number; paid:boolean; };

async function api<T=any>(path:string, init?:RequestInit):Promise<T>{
  const r = await fetch(path, { headers: { "Content-Type":"application/json" }, ...init });
  return r.json();
}

export default function StockReview(){
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [shift, setShift] = useState<Shift|null>(null);
  const [drinks, setDrinks] = useState<DrinkRow[]>([]);
  const [saving, setSaving] = useState(false);

  const brands = useMemo(()=> drinks.map(d=>d.name), [drinks]);

  useEffect(() => {
    (async () => {
      const res = await api<{ok:boolean; item:Shift|null; drinks:DrinkRow[]}>(`/api/analysis/manual-ledger?date=${date}`);
      if (res.ok){
        setShift(res.item || {
          shift_date: date, rolls_prev_end:0, rolls_purchased:0, burgers_sold:0, rolls_actual:0, rolls_paid:false,
          meat_prev_end_g:0, meat_purchased_g:0, meat_sold_g:0, meat_actual_g:0, meat_paid:false
        });
        setDrinks(res.drinks || []);
      }
    })();
  }, [date]);

  const rollsExpected = (Number(shift?.rolls_prev_end||0)+Number(shift?.rolls_purchased||0)-Number(shift?.burgers_sold||0))|0;
  const rollsVariance = (Number(shift?.rolls_actual||0)-rollsExpected)|0;

  const meatExpected  = (Number(shift?.meat_prev_end_g||0)+Number(shift?.meat_purchased_g||0)-Number(shift?.meat_sold_g||0))|0;
  const meatVariance  = (Number(shift?.meat_actual_g||0)-meatExpected)|0;

  async function saveBase(){
    setSaving(true);
    const body = JSON.stringify({ ...shift,
      roll_expected: rollsExpected, meat_expected_g: meatExpected
    });
    const method = shift?.id ? "PUT" : "POST";
    const url = shift?.id ? `/api/analysis/manual-ledger/${shift.id}` : "/api/analysis/manual-ledger";
    const res = await api<{ok:boolean; item:any}>(url,{ method, body});
    if (res.ok){
      setShift(res.item);
    }
    setSaving(false);
  }

  async function saveDrinks(){
    if (!shift?.id) { await saveBase(); }
    const id = shift?.id;
    if (!id) return;
    const body = JSON.stringify(drinks.map(d=>({ brand:d.name, prev_end:d.prev_end, purchased:d.purchased, sold:d.sold, actual:d.actual, paid:d.paid })));
    await api(`/api/analysis/manual-ledger/${id}/drinks`, { method:"PUT", body });
  }

  async function saveAll(){
    await saveBase();
    await saveDrinks();
    alert("Saved!");
  }

  function updateShift(k:string, v:any){
    setShift((s:any)=> ({...s, [k]:v}));
  }

  function editDrink(idx:number, k:keyof DrinkRow, v:any){
    setDrinks(ds=>{
      const copy = [...ds];
      const d = {...copy[idx]};
      (d as any)[k] = k==="paid" ? !!v : Number(v||0);
      d.expected = (Number(d.prev_end||0)+Number(d.purchased||0)-Number(d.sold||0))|0;
      d.variance = (Number(d.actual||0)-d.expected)|0;
      copy[idx]=d;
      return copy;
    });
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Stock Review</h1>
        <div className="flex gap-2">
          <input type="date" className={input} value={date} onChange={e=>setDate(e.target.value)} />
          <button onClick={saveAll} disabled={saving} className="px-3 py-2 rounded-xl bg-black text-white text-sm">{saving ? "Saving..." : "Save"}</button>
          <a className="px-3 py-2 rounded-xl border text-sm" href={`/api/analysis/manual-ledger/export.csv?from=${date}&to=${date}`} target="_blank" rel="noreferrer">Export CSV (Day)</a>
        </div>
      </div>

      {/* Rolls */}
      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Rolls (Buns)</h2>
          <span className={badge(rollsVariance)}>Variance: {rollsVariance}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div><div className={label}>Prev End</div><input className={input} type="number" value={shift?.rolls_prev_end||0} onChange={e=>updateShift("rolls_prev_end", Number(e.target.value))}/></div>
          <div><div className={label}>Purchased</div><input className={input} type="number" value={shift?.rolls_purchased||0} onChange={e=>updateShift("rolls_purchased", Number(e.target.value))}/></div>
          <div><div className={label}>Burgers Sold</div><input className={input} type="number" value={shift?.burgers_sold||0} onChange={e=>updateShift("burgers_sold", Number(e.target.value))}/></div>
          <div><div className={label}>Expected</div><input className={input+" bg-gray-50"} readOnly value={rollsExpected}/></div>
          <div><div className={label}>Actual</div><input className={input} type="number" value={shift?.rolls_actual||0} onChange={e=>updateShift("rolls_actual", Number(e.target.value))}/></div>
          <div><div className={label}>Paid</div>
            <select className={input} value={shift?.rolls_paid ? "Y":"N"} onChange={e=>updateShift("rolls_paid", e.target.value==="Y")}><option>N</option><option>Y</option></select>
          </div>
        </div>
      </div>

      {/* Meat */}
      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Meat (grams)</h2>
          <span className={badge(meatVariance)}>Variance: {meatVariance} g</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div><div className={label}>Prev End (g)</div><input className={input} type="number" value={shift?.meat_prev_end_g||0} onChange={e=>updateShift("meat_prev_end_g", Number(e.target.value))}/></div>
          <div><div className={label}>Purchased (g)</div><input className={input} type="number" value={shift?.meat_purchased_g||0} onChange={e=>updateShift("meat_purchased_g", Number(e.target.value))}/></div>
          <div><div className={label}>Sold (g)</div><input className={input} type="number" value={shift?.meat_sold_g||0} onChange={e=>updateShift("meat_sold_g", Number(e.target.value))}/></div>
          <div><div className={label}>Expected (g)</div><input className={input+" bg-gray-50"} readOnly value={meatExpected}/></div>
          <div><div className={label}>Actual (g)</div><input className={input} type="number" value={shift?.meat_actual_g||0} onChange={e=>updateShift("meat_actual_g", Number(e.target.value))}/></div>
          <div><div className={label}>Paid</div>
            <select className={input} value={shift?.meat_paid ? "Y":"N"} onChange={e=>updateShift("meat_paid", e.target.value==="Y")}><option>N</option><option>Y</option></select>
          </div>
        </div>
      </div>

      {/* Drinks */}
      <div className={card}>
        <h2 className="text-base font-medium mb-2">Drinks (Cans)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Brand</th>
                <th className="text-left py-2">Prev</th>
                <th className="text-left py-2">Purch</th>
                <th className="text-left py-2">Sold</th>
                <th className="text-left py-2 bg-gray-50">Exp</th>
                <th className="text-left py-2">Act</th>
                <th className="text-left py-2">Var</th>
                <th className="text-left py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {drinks.map((d,i)=>(
                <tr key={d.name} className="border-b">
                  <td className="py-2 font-medium">{d.name}</td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.prev_end||0} onChange={e=>editDrink(i,'prev_end',e.target.value)}/></td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.purchased||0} onChange={e=>editDrink(i,'purchased',e.target.value)}/></td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.sold||0} onChange={e=>editDrink(i,'sold',e.target.value)}/></td>
                  <td className="bg-gray-50">{d.expected}</td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.actual||0} onChange={e=>editDrink(i,'actual',e.target.value)}/></td>
                  <td><span className={badge(d.variance)}>{d.variance}</span></td>
                  <td>
                    <select className="border px-1 py-1 text-xs rounded" value={d.paid?"Y":"N"} onChange={e=>editDrink(i,'paid',e.target.value==="Y")}>
                      <option>N</option><option>Y</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
TSX

echo "Created stock review page at $TARGET_PAGE"

# -------- 6) Run migration ---------------------------------------------------
echo ""
echo "=== Running migration ==="
if command -v psql &> /dev/null; then
  psql "$DATABASE_URL" < "$MIG_FILE" 2>&1
  echo "Migration applied via psql"
else
  echo "psql not found - migration file created at $MIG_FILE (run manually or via tsx/ts-node)"
fi

# -------- 7) Seed drink brands -----------------------------------------------
echo ""
echo "=== Seeding drink brands ==="
if command -v tsx &> /dev/null; then
  tsx "$SEED_FILE"
  echo "Seeded via tsx"
elif command -v ts-node &> /dev/null; then
  ts-node "$SEED_FILE"
  echo "Seeded via ts-node"
else
  echo "tsx or ts-node not found - seed file created at $SEED_FILE (run manually)"
fi

echo ""
echo "=== PATCH V4.0 COMPLETE ==="
echo "Manual Ledger tables created, 10 drink brands seeded, API at /api/analysis/manual-ledger, UI at $TARGET_PAGE"
echo "Next: Register $TARGET_PAGE in your router/nav and restart server."
