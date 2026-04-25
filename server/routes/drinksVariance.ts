/**
 * /api/analysis/drinks-variance  — Drinks Stock Reconciliation
 * /api/analysis/drinks-variance/reviews — Review persistence
 *
 * Rebuilt per FINAL DB spec (Apr 2026):
 * - Only drink SKUs (10 canonical items, no burgers/fries/sets)
 * - Modifiers sourced from receipt_truth_daily_usage set-row columns (not modifier aggregate)
 * - daily_stock_v2 uses correct column "drinksJson" + "createdAt"::date
 * - Explicit SKU→stock-key mapping (no fuzzy matching)
 * - Formula: Total Sold = Direct + Modifiers, Expected = Start + Purchased − Total Sold, Variance = End − Expected
 * - WATER code ambiguity: cannot split water_used between Soda Water and Bottle Water → shown as null/warning
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Canonical drink list ──────────────────────────────────────────────────
// Each entry defines the exact mapping between data sources.
// stockKey must match the JSON keys in daily_stock_v2.drinksJson.
// modifierCol is the column in receipt_truth_daily_usage on set rows.
// null modifierCol = not sold via modifiers.
// 'AMBIGUOUS' = WATER code shared by Soda Water & Bottle Water; cannot split.
const DRINK_CATALOG = [
  { sku: '10012', displayName: 'Coke Can',            stockKey: 'Coke',                modifierCol: 'coke_used'              },
  { sku: '10013', displayName: 'Coke Zero',           stockKey: 'Coke Zero',           modifierCol: 'coke_zero_used'         },
  { sku: '10021', displayName: 'Schweppes Lime',      stockKey: 'Schweppes Manow',     modifierCol: 'schweppes_manao_used'   },
  { sku: '10026', displayName: 'Sprite',              stockKey: 'Sprite',              modifierCol: 'sprite_used'            },
  { sku: '10027', displayName: 'Fanta Orange',        stockKey: 'Fanta Orange',        modifierCol: 'fanta_orange_used'      },
  { sku: '10028', displayName: 'Fanta Strawberry',    stockKey: 'Fanta Strawberry',    modifierCol: 'fanta_strawberry_used'  },
  { sku: '10029', displayName: 'Soda Water',          stockKey: 'Soda Water',          modifierCol: 'AMBIGUOUS'              },
  { sku: '10031', displayName: 'Bottle Water',        stockKey: 'Bottled Water',       modifierCol: 'AMBIGUOUS'              },
  { sku: '10039', displayName: 'Kids Juice (Orange)', stockKey: 'Kids Juice (Orange)', modifierCol: null                     },
  { sku: '10040', displayName: 'Kids Juice (Apple)',  stockKey: 'Kids Juice (Apple)',  modifierCol: null                     },
] as const;

type DrinkEntry = typeof DRINK_CATALOG[number];

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
  const setSkusSql = `(SELECT sku FROM receipt_truth_usage_rule WHERE requires_drink_modifier = true AND active = true)`;

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

      // 7. Modifier totals — SUM each drink column from set rows on this business_date
      pool
        .query<{
          coke_total: number; coke_zero_total: number; sprite_total: number;
          water_total: number; fanta_orange_total: number; fanta_strawberry_total: number;
          schweppes_total: number;
        }>(
          `SELECT
             COALESCE(SUM(coke_used), 0)::int              AS coke_total,
             COALESCE(SUM(coke_zero_used), 0)::int          AS coke_zero_total,
             COALESCE(SUM(sprite_used), 0)::int             AS sprite_total,
             COALESCE(SUM(water_used), 0)::int              AS water_total,
             COALESCE(SUM(fanta_orange_used), 0)::int       AS fanta_orange_total,
             COALESCE(SUM(fanta_strawberry_used), 0)::int   AS fanta_strawberry_total,
             COALESCE(SUM(schweppes_manao_used), 0)::int    AS schweppes_total
           FROM receipt_truth_daily_usage
           WHERE business_date = $1
             AND sku IN ${setSkusSql}`,
          [date],
        )
        .catch(() => ({ rows: [{ coke_total:0, coke_zero_total:0, sprite_total:0, water_total:0, fanta_orange_total:0, fanta_strawberry_total:0, schweppes_total:0 }] } as any)),

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

  // ── Modifier totals ─────────────────────────────────────────────────
  const mt = modifierTotals.rows[0] ?? {
    coke_total:0, coke_zero_total:0, sprite_total:0, water_total:0,
    fanta_orange_total:0, fanta_strawberry_total:0, schweppes_total:0,
  };

  const MODIFIER_TOTALS: Record<string, number> = {
    coke_used:              Number(mt.coke_total),
    coke_zero_used:         Number(mt.coke_zero_total),
    sprite_used:            Number(mt.sprite_total),
    water_used:             Number(mt.water_total),
    fanta_orange_used:      Number(mt.fanta_orange_total),
    fanta_strawberry_used:  Number(mt.fanta_strawberry_total),
    schweppes_manao_used:   Number(mt.schweppes_total),
  };

  // ── Reviewed items set ──────────────────────────────────────────────
  const reviewedItems = new Set(reviews.rows.map((r: any) => r.item_name));

  // ── Build result rows ───────────────────────────────────────────────
  const data = DRINK_CATALOG.map((entry) => {
    const start    = stockLookup(prevStockRaw, entry.stockKey);
    const end      = stockLookup(endStockRaw,  entry.stockKey);
    const purchased = lookupPurchased(entry);
    const soldDirect = directSoldMap.get(entry.sku) ?? 0;

    let soldViaModifiers: number | null = null;
    let ambiguousModifier = false;

    if (entry.modifierCol === 'AMBIGUOUS') {
      ambiguousModifier = true;
      soldViaModifiers = null;
    } else if (entry.modifierCol === null) {
      soldViaModifiers = 0;
    } else {
      soldViaModifiers = MODIFIER_TOTALS[entry.modifierCol] ?? 0;
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
      ambiguous_modifier: ambiguousModifier,
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
