import { Router, Request, Response } from "express";
import { pool } from "../db.js";
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
    if (from) { params.push(from); where += ` AND shift_date >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND shift_date <= $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT id, shift_date, completed_by,
              total_sales, cash_sales, qr_sales, grab_sales, other_sales,
              rolls_expected, rolls_actual, rolls_variance,
              meat_expected_g, meat_actual_g, meat_variance_g
         FROM manual_stock_ledger
         ${where}
         ORDER BY shift_date DESC, created_at DESC
      `, params
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
      `SELECT mdl.brand_id, db.name, mdl.prev_end, mdl.purchased, mdl.sold, mdl.expected, mdl.actual, mdl.variance, mdl.paid
         FROM manual_drink_ledger mdl
         JOIN drink_brand db ON db.id = mdl.brand_id
        WHERE mdl.shift_id = $1
        ORDER BY db.id ASC`,
      [base.id]
    );

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

/** POST create */
analysisManualLedgerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const rolls = computeRolls(int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), int(b.rolls_actual));
    const meat  = computeMeat(int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), int(b.meat_actual_g));

    const { rows } = await pool.query(
      `INSERT INTO manual_stock_ledger
        (shift_date, completed_by, source_form_id,
         total_sales, cash_sales, qr_sales, grab_sales, other_sales, shopping_total, wages_total,
         rolls_prev_end, rolls_purchased, burgers_sold, rolls_expected, rolls_actual, rolls_variance, rolls_paid,
         meat_prev_end_g, meat_purchased_g, meat_sold_g, meat_expected_g, meat_actual_g, meat_variance_g, meat_paid,
         notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
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

/** PUT update */
analysisManualLedgerRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const rolls = computeRolls(int(b.rolls_prev_end), int(b.rolls_purchased), int(b.burgers_sold), int(b.rolls_actual));
    const meat  = computeMeat(int(b.meat_prev_end_g), int(b.meat_purchased_g), int(b.meat_sold_g), int(b.meat_actual_g));

    const { rows } = await pool.query(
      `UPDATE manual_stock_ledger SET
          shift_date=$1, completed_by=$2, source_form_id=$3,
          total_sales=$4, cash_sales=$5, qr_sales=$6, grab_sales=$7, other_sales=$8, shopping_total=$9, wages_total=$10,
          rolls_prev_end=$11, rolls_purchased=$12, burgers_sold=$13, rolls_expected=$14, rolls_actual=$15, rolls_variance=$16, rolls_paid=$17,
          meat_prev_end_g=$18, meat_purchased_g=$19, meat_sold_g=$20, meat_expected_g=$21, meat_actual_g=$22, meat_variance_g=$23, meat_paid=$24,
          notes=$25
        WHERE id=$26
        RETURNING *`,
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
        `INSERT INTO manual_drink_ledger
          (shift_id, brand_id, prev_end, purchased, sold, expected, actual, variance, paid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (shift_id, brand_id)
         DO UPDATE SET prev_end=EXCLUDED.prev_end, purchased=EXCLUDED.purchased, sold=EXCLUDED.sold,
                       expected=EXCLUDED.expected, actual=EXCLUDED.actual, variance=EXCLUDED.variance, paid=EXCLUDED.paid`,
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

/** CSV export */
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
      if (from) { params.push(from); where += ` AND shift_date >= $${params.length}`; }
      if (to)   { params.push(to);   where += ` AND shift_date <= $${params.length}`; }
      const q = `SELECT * FROM manual_stock_ledger ${where} ORDER BY shift_date DESC`;
      const resq = await pool.query(q, params);
      rows = resq.rows;
    }

    const brands = await getBrands();
    for (const r of rows) {
      const { rows: drinkRows } = await pool.query(
        `SELECT db.name, mdl.actual
           FROM manual_drink_ledger mdl
           JOIN drink_brand db ON db.id = mdl.brand_id
          WHERE mdl.shift_id = $1`,
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
