/**
 * /api/analysis/drinks-variance  — Drinks Stock Reconciliation
 * /api/analysis/drinks-variance/reviews — Review persistence
 *
 * Modifier source: lv_modifier JOIN lv_receipt (Loyverse raw data)
 * Modifiers filtered via deterministic name mapping from modifierPipeline.ts
 * Water ambiguity resolved — Soda Water and Bottle Water are separately named in Loyverse.
 */

import { Router } from 'express';
import { pool } from '../db';
import { getDrinkEntryForModifier } from './modifierPipeline.js';

const router = Router();

// ─── Canonical drink list ──────────────────────────────────────────────────
// modifierNames: exact lv_modifier.name values that map to this drink SKU.
// null = not sold via modifiers (Kids Juice).
const DRINK_CATALOG = [
  { sku: '10012', displayName: 'Coke Can',            stockKey: 'Coke',                modifierNames: ['Coke', 'Coca Cola', 'Coca-Cola']                             },
  { sku: '10013', displayName: 'Coke Zero',           stockKey: 'Coke Zero',           modifierNames: ['Coke Zero', 'Coca Cola Zero', 'Coca-Cola Zero']               },
  { sku: '10021', displayName: 'Schweppes Lime',      stockKey: 'Schweppes Manow',     modifierNames: ['Schweppes Manow', 'Schweppes Manao', 'Schweppes Lime']        },
  { sku: '10026', displayName: 'Sprite',              stockKey: 'Sprite',              modifierNames: ['Sprite']                                                      },
  { sku: '10027', displayName: 'Fanta Orange',        stockKey: 'Fanta Orange',        modifierNames: ['Fanta Orange']                                                },
  { sku: '10028', displayName: 'Fanta Strawberry',    stockKey: 'Fanta Strawberry',    modifierNames: ['Fanta Strawberry']                                            },
  { sku: '10029', displayName: 'Soda Water',          stockKey: 'Soda Water',          modifierNames: ['Soda Water']                                                  },
  { sku: '10031', displayName: 'Bottle Water',        stockKey: 'Bottled Water',       modifierNames: ['Bottle Water', 'Bottled Water']                               },
  { sku: '10039', displayName: 'Kids Juice (Orange)', stockKey: 'Kids Juice (Orange)', modifierNames: null                                                            },
  { sku: '10040', displayName: 'Kids Juice (Apple)',  stockKey: 'Kids Juice (Apple)',  modifierNames: null                                                            },
] as const;

type DrinkEntry = (typeof DRINK_CATALOG)[number];

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── GET /drinks-variance?date=YYYY-MM-DD ────────────────────────────────
router.get('/drinks-variance', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  const prior = new Date(`${date}T00:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const prevDate = prior.toISOString().slice(0, 10);

  const drinkSkus = DRINK_CATALOG.map((d) => d.sku);

  const [endStk, prevStk, sales2End, sales2Prev, purchases, directSold, modifierTotals, reviews] =
    await Promise.all([

      // 1. End stock — daily_stock_v2 for this date (correct column: "drinksJson")
      pool
        .query<{ drinksJson: any }>(
          `SELECT "drinksJson" FROM daily_stock_v2
           WHERE "createdAt"::date = $1::date
           ORDER BY "createdAt" DESC LIMIT 1`,
          [date],
        )
        .catch(() => ({ rows: [] } as any)),

      // 2. Start stock — daily_stock_v2 for prior date
      pool
        .query<{ drinksJson: any }>(
          `SELECT "drinksJson" FROM daily_stock_v2
           WHERE "createdAt"::date = $1::date
           ORDER BY "createdAt" DESC LIMIT 1`,
          [prevDate],
        )
        .catch(() => ({ rows: [] } as any)),

      // 3. End stock fallback — daily_sales_v2
      pool
        .query<{ drinkstock: any }>(
          `SELECT payload->'drinkStock' AS drinkstock FROM daily_sales_v2
           WHERE "shiftDate" = $1 AND "deletedAt" IS NULL
           ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
          [date],
        )
        .catch(() => ({ rows: [] } as any)),

      // 4. Start stock fallback — daily_sales_v2 prior date
      pool
        .query<{ drinkstock: any }>(
          `SELECT payload->'drinkStock' AS drinkstock FROM daily_sales_v2
           WHERE "shiftDate" = $1 AND "deletedAt" IS NULL
           ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
          [prevDate],
        )
        .catch(() => ({ rows: [] } as any)),

      // 5. Purchases — purchase_tally_drink for effective date
      pool
        .query<{ item_name: string; qty: number }>(
          `SELECT d.item_name, SUM(d.qty)::int AS qty
           FROM purchase_tally_drink d
           JOIN purchase_tally t ON t.id = d.tally_id
           WHERE t.date = $1::date
           GROUP BY d.item_name`,
          [date],
        )
        .catch(() => ({ rows: [] } as any)),

      // 6. Direct sold — receipt_truth_daily_usage for drink SKUs (non-set items)
      pool
        .query<{ sku: string; qty: number }>(
          `SELECT sku, SUM(quantity_sold)::int AS qty
           FROM receipt_truth_daily_usage
           WHERE business_date = $1
             AND sku = ANY($2::text[])
           GROUP BY sku`,
          [date, drinkSkus],
        )
        .catch(() => ({ rows: [] } as any)),

      // 7. Modifier totals — from lv_modifier (Loyverse raw, complete source of truth)
      pool
        .query<{ modifier_name: string; total: string }>(
          `SELECT m.name AS modifier_name, SUM(m.qty)::int AS total
           FROM lv_modifier m
           JOIN lv_receipt r ON r.receipt_id = m.receipt_id
           WHERE r.datetime_bkk::date = $1::date
           GROUP BY m.name`,
          [date],
        )
        .catch(() => ({ rows: [] } as any)),

      // 8. Reviews for this date
      pool
        .query<{ item_name: string }>(
          `SELECT item_name FROM drinks_variance_reviews WHERE shift_date = $1`,
          [date],
        )
        .catch(() => ({ rows: [] } as any)),
    ]);

  // ── Stock maps ────────────────────────────────────────────────────────
  const endStockRaw: Record<string, number> =
    endStk.rows[0]?.drinksJson ?? sales2End.rows[0]?.drinkstock ?? {};
  const prevStockRaw: Record<string, number> =
    prevStk.rows[0]?.drinksJson ?? sales2Prev.rows[0]?.drinkstock ?? {};

  function stockLookup(raw: Record<string, number>, stockKey: string): number | null {
    // Exact key match first
    if (stockKey in raw) return Number(raw[stockKey]);
    // Normalized fallback
    const normTarget = normKey(stockKey);
    for (const [k, v] of Object.entries(raw)) {
      if (normKey(k) === normTarget) return Number(v);
    }
    return null;
  }

  // ── Purchase map: norm(item_name) → qty ─────────────────────────────
  const purchaseMap = new Map<string, number>();
  for (const r of purchases.rows) {
    const nk = normKey(r.item_name);
    purchaseMap.set(nk, (purchaseMap.get(nk) ?? 0) + Number(r.qty));
  }

  // Match purchase row to a catalog entry by EXACT normalised key match only.
  // No substring matching — prevents "Coke" from matching "Coke Zero".
  function lookupPurchased(entry: DrinkEntry): number {
    const targets = new Set([normKey(entry.stockKey), normKey(entry.displayName)]);
    for (const [nk, qty] of purchaseMap.entries()) {
      if (targets.has(nk)) return qty;
    }
    return 0;
  }

  // ── Direct sold map: sku → qty ──────────────────────────────────────
  const directSoldMap = new Map<string, number>();
  for (const r of directSold.rows) {
    directSoldMap.set(r.sku, Number(r.qty));
  }

  // ── Modifier totals from lv_modifier rows ────────────────────────────
  // Build a map: sku → totalQty from drink modifier names in lv_modifier
  const modifierBySku = new Map<string, number>();
  for (const row of modifierTotals.rows as Array<{ modifier_name: string; total: string }>) {
    const entry = getDrinkEntryForModifier(row.modifier_name);
    if (!entry) continue; // non-drink modifier — ignored here
    modifierBySku.set(entry.sku, (modifierBySku.get(entry.sku) ?? 0) + Number(row.total));
  }

  // ── Reviewed items set ──────────────────────────────────────────────
  const reviewedItems = new Set(reviews.rows.map((r: any) => r.item_name));

  // ── Build result rows ───────────────────────────────────────────────
  const data = DRINK_CATALOG.map((entry) => {
    const start    = stockLookup(prevStockRaw, entry.stockKey);
    const end      = stockLookup(endStockRaw,  entry.stockKey);
    const purchased = lookupPurchased(entry);
    const soldDirect = directSoldMap.get(entry.sku) ?? 0;

    let soldViaModifiers: number | null = null;

    if (entry.modifierNames === null) {
      // Not sold via modifiers (Kids Juice)
      soldViaModifiers = 0;
    } else {
      soldViaModifiers = modifierBySku.get(entry.sku) ?? 0;
    }

    const totalSold = soldDirect + (soldViaModifiers ?? 0);

    const expected =
      start !== null && soldViaModifiers !== null
        ? start + purchased - totalSold
        : null;

    const variance =
      end !== null && expected !== null
        ? end - expected
        : null;

    return {
      sku:                entry.sku,
      item_name:          entry.displayName,
      stock_key:          entry.stockKey,
      sold_direct:        soldDirect,
      sold_via_modifiers: soldViaModifiers,
      total_sold:         totalSold,
      start,
      purchased,
      end,
      expected,
      variance,
      has_review:         reviewedItems.has(entry.displayName),
    };
  });

  return res.json({
    ok: true,
    date,
    prev_date: prevDate,
    row_count: data.length,
    stock_source: endStk.rows[0] ? 'daily_stock_v2' : (sales2End.rows[0] ? 'daily_sales_v2' : 'none'),
    data,
  });
});

// ─── GET /drinks-variance/reviews?date=YYYY-MM-DD ───────────────────────
router.get('/drinks-variance/reviews', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }
  const result = await pool.query(
    `SELECT * FROM drinks_variance_reviews WHERE shift_date = $1 ORDER BY reviewed_at DESC`,
    [date],
  );
  return res.json({ ok: true, date, data: result.rows });
});

// ─── POST /drinks-variance/reviews ──────────────────────────────────────
router.post('/drinks-variance/reviews', async (req, res) => {
  const { shift_date, item_name, sku, variance_amount, owner_note, reviewed_by } = req.body;

  if (!shift_date || !item_name || !owner_note || !reviewed_by || variance_amount === undefined) {
    return res.status(400).json({ ok: false, error: 'Missing required fields: shift_date, item_name, owner_note, reviewed_by, variance_amount' });
  }

  const result = await pool.query(
    `INSERT INTO drinks_variance_reviews
       (shift_date, item_name, sku, variance_amount, owner_note, reviewed_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [shift_date, item_name, sku ?? null, variance_amount, owner_note, reviewed_by],
  );

  return res.status(201).json({ ok: true, data: result.rows[0] });
});

export default router;
