/**
 * Mix and Match Meal Deal — Promotion Analysis
 *
 * SKU: 10069 | Name: Mix and Match Meal Deal | Category: Promotions
 *
 * Locked rule (per sale):
 *   - 2 burgers  (from "Mix and Match - Burger Option" modifiers)
 *   - 2 French Fries servings
 *   - 2 drinks   (from "Mix and Match - Drink Options" modifiers)
 *   - 1 Coleslaw (noted only, no stock reconciliation yet)
 *
 * Drink reconciliation target:
 *   lv_modifier_drink_total (all selected drink modifiers, any set) + promo_drink_entitlement = expected_total
 *   For 2026-04-25: 28 + 2 = 30
 *
 * Flags:
 *   PROMO_DRINK_SELECTION_MISSING  — selected < expected for drink modifiers
 *   PROMO_BURGER_SELECTION_MISSING — selected < expected for burger modifiers
 *
 * Source: lv_line_item + lv_modifier (Loyverse raw, authoritative)
 *
 * DO NOT TOUCH: Drinks table, Fries table, Buns table, Meat table.
 */

import { Router } from 'express';
import { pool } from '../db';
import { isDrinkModifier } from './modifierPipeline.js';

const router = Router();

// ─── Promotion rule constants ─────────────────────────────────────────────
const PROMO_SKU = '10069';
const PROMO_DRINKS_PER_SALE    = 2;
const PROMO_BURGERS_PER_SALE   = 2;
const PROMO_FRIES_PER_SALE     = 2; // French Fries servings
const PROMO_BUNS_PER_SALE      = 2;
const PROMO_COLESLAW_PER_SALE  = 1; // noted only — no stock reconciliation

const MODIFIER_SET_DRINK  = 'Mix and Match - Drink Options';
const MODIFIER_SET_BURGER = 'Mix and Match - Burger Option';

// ─── GET /promo-mix-and-match?date=YYYY-MM-DD ────────────────────────────
router.get('/promo-mix-and-match', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // ── 1. Count promo sales and get their receipt/line identifiers ─────
    const promoSalesResult = await pool.query<{
      receipt_id: string;
      line_no: number;
      qty: number;
    }>(
      `SELECT li.receipt_id, li.line_no, li.qty
       FROM lv_line_item li
       JOIN lv_receipt r ON r.receipt_id = li.receipt_id
       WHERE r.datetime_bkk::date = $1::date
         AND li.sku = $2`,
      [date, PROMO_SKU],
    );

    const promoLines = promoSalesResult.rows;
    const totalPromoQty = promoLines.reduce((s, r) => s + Number(r.qty), 0);

    // ── 2. Get all modifiers for promo line items ────────────────────────
    const promoModifiers: Array<{
      receipt_id: string;
      line_no: number;
      mod_no: number;
      modifier_name: string;
      modifier_qty: number;
      modifier_set: string;
    }> = [];

    if (promoLines.length > 0) {
      // Build a list of (receipt_id, line_no) pairs for the promo items
      const pairConditions = promoLines
        .map((_, i) => `(m.receipt_id = $${i * 2 + 2} AND m.line_no = $${i * 2 + 3})`)
        .join(' OR ');

      const params: any[] = [date];
      for (const pl of promoLines) {
        params.push(pl.receipt_id, pl.line_no);
      }

      const modResult = await pool.query<{
        receipt_id: string;
        line_no: string;
        mod_no: string;
        name: string;
        qty: string;
        modifier_set: string;
      }>(
        `SELECT m.receipt_id, m.line_no, m.mod_no, m.name, m.qty,
                COALESCE(m.raw_json->>'name', '') AS modifier_set
         FROM lv_modifier m
         JOIN lv_receipt r ON r.receipt_id = m.receipt_id
         WHERE r.datetime_bkk::date = $1::date
           AND (${pairConditions})
         ORDER BY m.receipt_id, m.line_no, m.mod_no`,
        params,
      );

      for (const row of modResult.rows) {
        promoModifiers.push({
          receipt_id: row.receipt_id,
          line_no: Number(row.line_no),
          mod_no: Number(row.mod_no),
          modifier_name: row.name,
          modifier_qty: Number(row.qty),
          modifier_set: row.modifier_set,
        });
      }
    }

    // ── 3. Separate drink vs burger modifier selections ──────────────────
    const drinkSelections = promoModifiers.filter(
      (m) => m.modifier_set === MODIFIER_SET_DRINK,
    );
    const burgerSelections = promoModifiers.filter(
      (m) => m.modifier_set === MODIFIER_SET_BURGER,
    );

    const drinkSelectedQty  = drinkSelections.reduce((s, m) => s + m.modifier_qty, 0);
    const burgerSelectedQty = burgerSelections.reduce((s, m) => s + m.modifier_qty, 0);

    // ── 4. Expected vs selected vs missing ──────────────────────────────
    const drinkExpected   = totalPromoQty * PROMO_DRINKS_PER_SALE;
    const burgerExpected  = totalPromoQty * PROMO_BURGERS_PER_SALE;
    const fries_contribution = totalPromoQty * PROMO_FRIES_PER_SALE;
    const buns_contribution  = totalPromoQty * PROMO_BUNS_PER_SALE;
    const coleslaw_expected  = totalPromoQty * PROMO_COLESLAW_PER_SALE;

    const drinkMissing  = Math.max(0, drinkExpected  - drinkSelectedQty);
    const burgerMissing = Math.max(0, burgerExpected - burgerSelectedQty);

    // ── 5. Flags ─────────────────────────────────────────────────────────
    const flags: string[] = [];
    if (drinkMissing > 0)  flags.push('PROMO_DRINK_SELECTION_MISSING');
    if (burgerMissing > 0) flags.push('PROMO_BURGER_SELECTION_MISSING');

    // ── 6. Drink reconciliation against lv_modifier total for the date ──
    // All drink modifiers selected on this date (from all modifier sets)
    const allDrinkModResult = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(m.qty), 0) AS total
       FROM lv_modifier m
       JOIN lv_receipt r ON r.receipt_id = m.receipt_id
       WHERE r.datetime_bkk::date = $1::date
         AND (${buildDrinkNameFilter('m.name')})`,
      [date],
    );
    const lvModifierDrinkTotal = Number(allDrinkModResult.rows[0]?.total ?? 0);
    const reconciliationExpected = lvModifierDrinkTotal + drinkExpected;

    return res.json({
      ok: true,
      date,
      source: 'lv_line_item + lv_modifier',
      promo: {
        sku: PROMO_SKU,
        name: 'Mix and Match Meal Deal',
        qty_sold: totalPromoQty,
        line_items: promoLines.map((pl) => ({
          receipt_id: pl.receipt_id,
          line_no: pl.line_no,
          qty: Number(pl.qty),
        })),
      },
      drinks: {
        expected: drinkExpected,
        selected: drinkSelectedQty,
        missing: drinkMissing,
        selections: drinkSelections.map((m) => ({
          name: m.modifier_name,
          qty: m.modifier_qty,
        })),
        flag: drinkMissing > 0 ? 'PROMO_DRINK_SELECTION_MISSING' : null,
      },
      burgers: {
        expected: burgerExpected,
        selected: burgerSelectedQty,
        missing: burgerMissing,
        selections: burgerSelections.map((m) => ({
          name: m.modifier_name,
          qty: m.modifier_qty,
        })),
        flag: burgerMissing > 0 ? 'PROMO_BURGER_SELECTION_MISSING' : null,
      },
      fries: {
        additional_servings: fries_contribution,
        note: `Mix and Match adds ${fries_contribution} French Fries serving(s) to fries usage. French Fries only — not Sweet Potato.`,
      },
      buns: {
        additional_units: buns_contribution,
        note: `Mix and Match adds ${buns_contribution} bun(s) to buns usage.`,
      },
      coleslaw: {
        expected: coleslaw_expected,
        note: `${coleslaw_expected} coleslaw serving(s) included in promo. No stock reconciliation yet.`,
      },
      drink_reconciliation: {
        lv_modifier_drink_total: lvModifierDrinkTotal,
        promo_drink_entitlement: drinkExpected,
        expected_total: reconciliationExpected,
        promo_drink_selected: drinkSelectedQty,
        promo_drink_missing: drinkMissing,
        note: `${lvModifierDrinkTotal} drink modifiers selected (all sets) + ${drinkExpected} promo drink entitlement = ${reconciliationExpected} expected total`,
      },
      flags,
    });
  } catch (err: any) {
    console.error('[promo-mix-and-match] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Build SQL filter for known drink modifier names ──────────────────────
function buildDrinkNameFilter(col: string): string {
  const drinkNames = [
    'Coke', 'Coca Cola', 'Coca-Cola',
    'Coke Zero', 'Coca Cola Zero', 'Coca-Cola Zero',
    'Fanta Orange',
    'Fanta Strawberry',
    'Schweppes Manow', 'Schweppes Manao', 'Schweppes Lime',
    'Soda Water',
    'Bottle Water', 'Bottled Water',
    'Sprite',
  ];
  return drinkNames
    .map((n) => `LOWER(${col}) = LOWER('${n.replace(/'/g, "''")}')`)
    .join(' OR ');
}

export default router;
