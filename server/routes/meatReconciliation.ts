/**
 * /api/analysis/meat-reconciliation  — Meat Stock Reconciliation (CORE STOCK V2 PATCH 1)
 * /api/analysis/meat-reconciliation/reviews — Review persistence
 *
 * Single-row table: Meat
 *   Start     = previous shift closing meat weight (canonical source priority below)
 *   Purchased = SUM(purchase_tally.meat_grams) WHERE date = shift_date
 *   Used      = total patties × 90g  (patties derived from PATTY_MAP keyed by SKU)
 *   End       = current shift closing meat weight (canonical source priority below)
 *   Expected  = Start + Purchased − Used
 *   Variance  = End − Expected   (negative = missing meat)
 *
 * Stock source priority (per shift date):
 *   1. daily_sales_v2.payload->>'meatEnd'  (v2_canonical  — owner-verified value)
 *   2. daily_stock_v2.meatWeightG          (legacy_fallback — raw form entry)
 *
 * Chicken burgers (10066, 10068, 10070, 10071) → 0 patties.
 * If SKU has no PATTY_MAP entry → MISSING_PATTY_MAPPING flagged and used=null.
 * If Start or End stock missing → status: incomplete_component_data.
 *
 * Does NOT touch Drinks, Burgers & Sets, or Buns logic.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const GRAMS_PER_PATTY = 90;

// ─── Canonical patty map, keyed by Loyverse SKU ──────────────────────────────
// patties: number of beef patties per item sold
// isChicken: true = explicitly 0 patties, no MISSING_PATTY_MAPPING flag
const PATTY_MAP: Record<string, { patties: number; isChicken?: boolean }> = {
  '10004': { patties: 1  },  // Single Smash Burger
  '10006': { patties: 2  },  // Ultimate Double
  '10009': { patties: 3  },  // Triple Smash Burger
  '10019': { patties: 2  },  // Super Double Bacon
  '10032': { patties: 2  },  // Double Set (Meal Deal)
  '10033': { patties: 1  },  // Single Meal Set (Meal Deal)
  '10034': { patties: 3  },  // Triple Set / Triple Smash Set (Meal Deal)
  '10036': { patties: 2  },  // Super Double Bacon Set (Meal Deal)
  '10015': { patties: 1  },  // Kids Single Cheeseburger
  '10017': { patties: 2  },  // Kids Double Cheeseburger
  '10003': { patties: 1  },  // Kids Single Set / Kids Single Meal Set
  // Chicken — explicitly 0 beef patties
  '10066': { patties: 0, isChicken: true },  // Crispy Chicken Fillet Burger
  '10068': { patties: 0, isChicken: true },  // Big Rooster Sriracha
  '10070': { patties: 0, isChicken: true },  // Karaage Chicken Burger
  '10071': { patties: 0, isChicken: true },  // Karaage Chicken Set (Meal Deal)
};

const BURGER_CATEGORIES = [
  'Burgers',
  'Smash Burgers',
  'Burger Sets',
  'Burger Sets (Meal Deals)',
  'Smash Burger Sets (Meal Deals)',
  'Kids',
  'Kids Will Love This',
];

// ─── GET /meat-reconciliation?date=YYYY-MM-DD ────────────────────────────────
router.get('/meat-reconciliation', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // Previous shift date
    const prevDate = new Date(date + 'T12:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    // ── Helper: resolve canonical meat weight for a shift date ───────────
    // Priority 1: daily_sales_v2.payload->>'meatEnd'  (owner-verified, v2_canonical)
    // Priority 2: daily_stock_v2.meatWeightG          (raw form entry, legacy_fallback)
    async function resolveMeatWeight(shiftDate: string): Promise<{
      value: number | null;
      source: 'v2_canonical' | 'legacy_fallback' | 'missing';
    }> {
      const r = await pool.query(
        `SELECT
           (ds.payload->>'meatEnd')::int  AS v2_canonical,
           dsv."meatWeightG"              AS legacy_raw
         FROM daily_sales_v2 ds
         LEFT JOIN daily_stock_v2 dsv ON dsv."salesId" = ds.id
         WHERE ds."shiftDate" = $1
         LIMIT 1`,
        [shiftDate],
      );
      if (!r.rows[0]) return { value: null, source: 'missing' };
      const v2 = r.rows[0].v2_canonical !== null ? Number(r.rows[0].v2_canonical) : null;
      const legacy = r.rows[0].legacy_raw !== null ? Number(r.rows[0].legacy_raw) : null;
      if (v2 !== null) return { value: v2, source: 'v2_canonical' };
      if (legacy !== null) return { value: legacy, source: 'legacy_fallback' };
      return { value: null, source: 'missing' };
    }

    // ── Start: previous shift's canonical closing meat weight ─────────────
    const startResolved = await resolveMeatWeight(prevDateStr);
    const start: number | null = startResolved.value;
    const startSource = startResolved.source;

    // ── End: current shift's canonical closing meat weight ────────────────
    const endResolved = await resolveMeatWeight(date);
    const end: number | null = endResolved.value;
    const endSource = endResolved.source;

    // ── Purchased: sum of meat_grams from purchase_tally ─────────────────
    const purchRes = await pool.query(
      `SELECT COALESCE(SUM(meat_grams), 0) AS total
       FROM purchase_tally
       WHERE date = $1 AND meat_grams IS NOT NULL`,
      [date],
    );
    const purchased = Number(purchRes.rows[0]?.total ?? 0);

    // ── Burger sales for patty calculation ───────────────────────────────
    const salesRes = await pool.query(
      `SELECT sku, item_name, SUM(quantity_sold) AS qty_sold
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND category_name = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'
         AND sku IS NOT NULL
       GROUP BY sku, item_name
       ORDER BY sku`,
      [date, BURGER_CATEGORIES],
    );

    // ── Calculate patties and flag unmapped items ─────────────────────────
    let totalPatties = 0;
    let hasUnmapped = false;
    const unmappedItems: string[] = [];
    const itemBreakdown: Array<{
      sku: string;
      item_name: string;
      qty: number;
      patties_each: number | null;
      patties_total: number | null;
      grams_total: number | null;
      is_chicken: boolean;
      note: string | null;
    }> = [];

    for (const row of salesRes.rows) {
      const sku = row.sku as string;
      const itemName = row.item_name as string;
      const qty = Number(row.qty_sold);
      const mapping = PATTY_MAP[sku];

      if (!mapping) {
        hasUnmapped = true;
        unmappedItems.push(`${itemName} (${sku})`);
        itemBreakdown.push({
          sku,
          item_name: itemName,
          qty,
          patties_each: null,
          patties_total: null,
          grams_total: null,
          is_chicken: false,
          note: 'MISSING_PATTY_MAPPING',
        });
      } else {
        const pattiesTotal = mapping.patties * qty;
        totalPatties += pattiesTotal;
        itemBreakdown.push({
          sku,
          item_name: itemName,
          qty,
          patties_each: mapping.patties,
          patties_total: pattiesTotal,
          grams_total: pattiesTotal * GRAMS_PER_PATTY,
          is_chicken: mapping.isChicken ?? false,
          note: mapping.isChicken ? 'CHICKEN — 0 PATTIES' : null,
        });
      }
    }

    // If any item is unmapped, used becomes null (cannot compute reliably)
    const used: number | null = hasUnmapped
      ? null
      : totalPatties * GRAMS_PER_PATTY;

    // ── Formula ───────────────────────────────────────────────────────────
    const expected =
      start !== null && used !== null ? start + purchased - used : null;
    const variance =
      end !== null && expected !== null ? end - expected : null;

    // ── Review status ─────────────────────────────────────────────────────
    const reviewRes = await pool.query(
      `SELECT id, owner_note, reviewed_by, reviewed_at
       FROM meat_variance_reviews
       WHERE shift_date = $1
       ORDER BY reviewed_at DESC LIMIT 1`,
      [date],
    );
    const hasReview = reviewRes.rows.length > 0;
    const latestReview = reviewRes.rows[0] ?? null;

    // ── Missing data guard ────────────────────────────────────────────────
    if (start === null || end === null) {
      return res.json({
        ok: true,
        date,
        status: 'incomplete_component_data',
        missing: [
          ...(start === null ? ['start_stock'] : []),
          ...(end === null ? ['end_stock'] : []),
        ],
        stock_source: {
          start: startSource,
          end: endSource,
        },
        data: null,
      });
    }

    return res.json({
      ok: true,
      date,
      prev_date: prevDateStr,
      status: 'complete',
      grams_per_patty: GRAMS_PER_PATTY,
      total_patties: totalPatties,
      has_unmapped: hasUnmapped,
      unmapped_items: unmappedItems,
      item_breakdown: itemBreakdown,
      stock_source: {
        start: startSource,
        end: endSource,
      },
      data: {
        item: 'Meat',
        start,
        purchased,
        used,
        end,
        expected,
        variance,
        has_review: hasReview,
        latest_review: latestReview,
      },
    });
  } catch (err: any) {
    console.error('[meat-reconciliation] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /meat-reconciliation/reviews?date=YYYY-MM-DD ────────────────────────
router.get('/meat-reconciliation/reviews', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM meat_variance_reviews WHERE shift_date = $1 ORDER BY reviewed_at DESC`,
      [date],
    );
    return res.json({ ok: true, date, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /meat-reconciliation/reviews ───────────────────────────────────────
router.post('/meat-reconciliation/reviews', async (req, res) => {
  const { shift_date, variance_amount, owner_note, reviewed_by } = req.body;

  if (!shift_date || !owner_note || !reviewed_by || variance_amount === undefined) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: shift_date, variance_amount, owner_note, reviewed_by',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO meat_variance_reviews (shift_date, variance_amount, owner_note, reviewed_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [shift_date, variance_amount, owner_note, reviewed_by],
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
