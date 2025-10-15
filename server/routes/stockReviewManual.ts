import { Router } from "express";
import { Pool } from "pg";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Fixed can brands (cans; no plain water) */
export const DRINK_BRANDS = [
  "Coke","Coke Zero","Sprite","Schweppes Manow",
  "Red Fanta","Orange Fanta","Red Singha","Yellow Singha","Pink Singha"
];

type YN = "Y" | "N";

type RollsMeatRow = {
  prev_end: number;
  purchased: number;
  sold: number;
  expected: number;
  actual: number;
  paid: YN;
};

type DrinkRow = {
  brand: string;
  prev_end: number;
  purchased: number;
  sold: number;
  expected: number;
  actual: number;
  variance: number;
  paid: YN;
};

function int(v: any) { const n = Number(v ?? 0); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0; }
function yn(v: any): YN { return v === "Y" ? "Y" : "N"; }

function dayStr(v: string | undefined) {
  if (!v) throw new Error("Missing date (YYYY-MM-DD)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Invalid date");
  return v;
}

/** ensure tables */
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_ledger_day (
      day DATE PRIMARY KEY,
      rolls_prev_end INTEGER NOT NULL DEFAULT 0,
      rolls_purchased INTEGER NOT NULL DEFAULT 0,
      burgers_sold INTEGER NOT NULL DEFAULT 0,
      rolls_expected INTEGER NOT NULL DEFAULT 0,
      rolls_actual INTEGER NOT NULL DEFAULT 0,
      rolls_paid CHAR(1) NOT NULL DEFAULT 'N',
      meat_prev_end_g INTEGER NOT NULL DEFAULT 0,
      meat_purchased_g INTEGER NOT NULL DEFAULT 0,
      meat_sold_g INTEGER NOT NULL DEFAULT 0,
      meat_expected_g INTEGER NOT NULL DEFAULT 0,
      meat_actual_g INTEGER NOT NULL DEFAULT 0,
      meat_paid CHAR(1) NOT NULL DEFAULT 'N',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stock_ledger_drinks (
      day DATE NOT NULL,
      brand TEXT NOT NULL,
      prev_end INTEGER NOT NULL DEFAULT 0,
      purchased INTEGER NOT NULL DEFAULT 0,
      sold INTEGER NOT NULL DEFAULT 0,
      expected INTEGER NOT NULL DEFAULT 0,
      actual INTEGER NOT NULL DEFAULT 0,
      variance INTEGER NOT NULL DEFAULT 0,
      paid CHAR(1) NOT NULL DEFAULT 'N',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (day, brand)
    );
  `);
}

/** GET ?date=YYYY-MM-DD -> one day */
router.get("/", async (req, res) => {
  try {
    await ensureSchema();
    const day = dayStr(String(req.query.date || ""));
    const base = await pool.query(`SELECT * FROM stock_ledger_day WHERE day = $1`, [day]);
    const drinks = await pool.query(`SELECT * FROM stock_ledger_drinks WHERE day = $1 ORDER BY brand`, [day]);

    const existing = new Map(drinks.rows.map((r:any)=>[r.brand, r]));
    const rows = DRINK_BRANDS.map(b => existing.get(b) || {
      day, brand: b, prev_end:0, purchased:0, sold:0, expected:0, actual:0, variance:0, paid:"N"
    });

    res.json({
      ok: true,
      day,
      rolls: base.rowCount
        ? {
            prev_end: base.rows[0].rolls_prev_end,
            purchased: base.rows[0].rolls_purchased,
            sold: base.rows[0].burgers_sold,
            expected: base.rows[0].rolls_expected,
            actual: base.rows[0].rolls_actual,
            paid: base.rows[0].rolls_paid
          }
        : { prev_end:0, purchased:0, sold:0, expected:0, actual:0, paid:"N" },
      meat: base.rowCount
        ? {
            prev_end: base.rows[0].meat_prev_end_g,
            purchased: base.rows[0].meat_purchased_g,
            sold: base.rows[0].meat_sold_g,
            expected: base.rows[0].meat_expected_g,
            actual: base.rows[0].meat_actual_g,
            paid: base.rows[0].meat_paid
          }
        : { prev_end:0, purchased:0, sold:0, expected:0, actual:0, paid:"N" },
      drinks: rows
    });
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message });
  }
});

/** UPSERT one day { day, rolls, meat, drinks[] }  */
router.post("/", async (req, res) => {
  try {
    await ensureSchema();
    const day = dayStr(String(req.body?.day || req.query?.date || ""));
    const rollsReq: RollsMeatRow = {
      prev_end: int(req.body?.rolls?.prev_end),
      purchased: int(req.body?.rolls?.purchased),
      sold: int(req.body?.rolls?.sold),
      expected: int(req.body?.rolls?.expected),
      actual: int(req.body?.rolls?.actual),
      paid: yn(req.body?.rolls?.paid),
    };
    const meatReq: RollsMeatRow = {
      prev_end: int(req.body?.meat?.prev_end),
      purchased: int(req.body?.meat?.purchased),
      sold: int(req.body?.meat?.sold),
      expected: int(req.body?.meat?.expected),
      actual: int(req.body?.meat?.actual),
      paid: yn(req.body?.meat?.paid),
    };
    const drinksReq: DrinkRow[] = Array.isArray(req.body?.drinks) ? req.body.drinks : [];
    const cleaned: DrinkRow[] = drinksReq
      .filter((r:any)=> DRINK_BRANDS.includes(String(r.brand)))
      .map((r:any)=> {
        const prev = int(r.prev_end), pur = int(r.purchased), sold = int(r.sold), act = int(r.actual);
        const exp = int((r.expected ?? (prev + pur - sold)));
        return { brand: r.brand, prev_end: prev, purchased: pur, sold, expected: exp, actual: act, variance: act - exp, paid: yn(r.paid) };
      });

    await pool.query(`
      INSERT INTO stock_ledger_day(
        day, rolls_prev_end, rolls_purchased, burgers_sold, rolls_expected, rolls_actual, rolls_paid,
        meat_prev_end_g, meat_purchased_g, meat_sold_g, meat_expected_g, meat_actual_g, meat_paid, updated_at
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,NOW()
      )
      ON CONFLICT (day) DO UPDATE SET
        rolls_prev_end = EXCLUDED.rolls_prev_end,
        rolls_purchased = EXCLUDED.rolls_purchased,
        burgers_sold = EXCLUDED.burgers_sold,
        rolls_expected = EXCLUDED.rolls_expected,
        rolls_actual = EXCLUDED.rolls_actual,
        rolls_paid = EXCLUDED.rolls_paid,
        meat_prev_end_g = EXCLUDED.meat_prev_end_g,
        meat_purchased_g = EXCLUDED.meat_purchased_g,
        meat_sold_g = EXCLUDED.meat_sold_g,
        meat_expected_g = EXCLUDED.meat_expected_g,
        meat_actual_g = EXCLUDED.meat_actual_g,
        meat_paid = EXCLUDED.meat_paid,
        updated_at = NOW()
    `, [
      day, rollsReq.prev_end, rollsReq.purchased, rollsReq.sold, rollsReq.expected, rollsReq.actual, rollsReq.paid,
      meatReq.prev_end, meatReq.purchased, meatReq.sold, meatReq.expected, meatReq.actual, meatReq.paid
    ]);

    for (const d of cleaned) {
      await pool.query(`
        INSERT INTO stock_ledger_drinks(day, brand, prev_end, purchased, sold, expected, actual, variance, paid, updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (day, brand) DO UPDATE SET
          prev_end = EXCLUDED.prev_end,
          purchased = EXCLUDED.purchased,
          sold = EXCLUDED.sold,
          expected = EXCLUDED.expected,
          actual = EXCLUDED.actual,
          variance = EXCLUDED.variance,
          paid = EXCLUDED.paid,
          updated_at = NOW()
      `, [day, d.brand, d.prev_end, d.purchased, d.sold, d.expected, d.actual, d.variance, d.paid]);
    }

    res.json({ ok:true, day, saved_drinks: cleaned.length });
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message });
  }
});

/** CSV export for a day */
router.get("/export.csv", async (req,res) => {
  try {
    await ensureSchema();
    const day = dayStr(String(req.query.date || ""));
    const base = await pool.query(`SELECT * FROM stock_ledger_day WHERE day = $1`, [day]);
    const drinks = await pool.query(`SELECT * FROM stock_ledger_drinks WHERE day = $1 ORDER BY brand`, [day]);

    const fields = [
      "date","rolls_prev_end","rolls_purchased","burgers_sold","rolls_expected","rolls_actual","rolls_variance","rolls_paid",
      "meat_prev_end_g","meat_purchased_g","meat_sold_g","meat_expected_g","meat_actual_g","meat_variance_g","meat_paid"
    ];
    for (const b of DRINK_BRANDS) {
      fields.push(
        `${b}_prev`,`${b}_purchased`,`${b}_sold`,`${b}_expected`,`${b}_actual`,`${b}_variance`,`${b}_paid`
      );
    }

    function esc(v:any){ const s = String(v ?? ""); return `"${s.replace(/"/g,'""')}"`; }

    const row:any = {};
    const baseRow = base.rowCount ? base.rows[0] : {};
    row["date"] = day;
    row["rolls_prev_end"]= baseRow.rolls_prev_end ?? 0;
    row["rolls_purchased"]= baseRow.rolls_purchased ?? 0;
    row["burgers_sold"]= baseRow.burgers_sold ?? 0;
    row["rolls_expected"]= baseRow.rolls_expected ?? 0;
    row["rolls_actual"]= baseRow.rolls_actual ?? 0;
    row["rolls_variance"]= (row["rolls_actual"] - row["rolls_expected"]) || 0;
    row["rolls_paid"]= baseRow.rolls_paid ?? "N";
    row["meat_prev_end_g"]= baseRow.meat_prev_end_g ?? 0;
    row["meat_purchased_g"]= baseRow.meat_purchased_g ?? 0;
    row["meat_sold_g"]= baseRow.meat_sold_g ?? 0;
    row["meat_expected_g"]= baseRow.meat_expected_g ?? 0;
    row["meat_actual_g"]= baseRow.meat_actual_g ?? 0;
    row["meat_variance_g"]= (row["meat_actual_g"] - row["meat_expected_g"]) || 0;
    row["meat_paid"]= baseRow.meat_paid ?? "N";

    const map = new Map(drinks.rows.map((r:any)=>[r.brand, r]));
    for (const b of DRINK_BRANDS) {
      const r:any = map.get(b) || {};
      row[`${b}_prev`] = r.prev_end ?? 0;
      row[`${b}_purchased`] = r.purchased ?? 0;
      row[`${b}_sold`] = r.sold ?? 0;
      row[`${b}_expected`] = r.expected ?? 0;
      row[`${b}_actual`] = r.actual ?? 0;
      row[`${b}_variance`] = r.variance ?? 0;
      row[`${b}_paid`] = r.paid ?? "N";
    }

    const header = fields.join(",");
    const data = fields.map(f => esc(row[f])).join(",");

    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stock_review_${day}.csv"`);
    res.send(header + "\n" + data + "\n");
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message });
  }
});

export default router;
