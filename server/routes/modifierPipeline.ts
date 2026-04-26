/**
 * Modifier Pipeline — drink modifiers and other modifiers
 *
 * Source: lv_modifier JOIN lv_receipt (Loyverse raw data — complete and authoritative)
 *
 * GET /api/analysis/drink-modifiers?date=YYYY-MM-DD
 *   Returns only drink modifiers, mapped to SKUs.
 *   Flags UNMAPPED_DRINK_MODIFIER for any unrecognised drink-like name (none expected).
 *
 * GET /api/analysis/other-modifiers?date=YYYY-MM-DD
 *   Returns all non-drink modifiers (burger add-ons, removals, upgrades, etc.).
 *
 * The two sets are mutually exclusive and collectively exhaustive.
 * Source: lv_modifier + lv_receipt — NOT receipt_truth_modifier_aggregate.
 *
 * DO NOT TOUCH: Drinks, Burgers, Buns, Meat, Side Orders, Fries, Sweet Potato tables.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Deterministic drink modifier name → SKU mapping ──────────────────────────
// Any modifier name that appears here is a DRINK modifier.
// Everything else is an OTHER modifier.
export const DRINK_MODIFIER_ENTRIES: Array<{
  names: string[];   // exact modifier names as stored in lv_modifier (case-insensitive match)
  sku: string;
  displayName: string;
}> = [
  { names: ['Coke', 'Coca Cola', 'Coca-Cola'],                             sku: '10012', displayName: 'Coke Can' },
  { names: ['Coke Zero', 'Coca Cola Zero', 'Coca-Cola Zero'],               sku: '10013', displayName: 'Coke Zero' },
  { names: ['Fanta Orange'],                                                sku: '10027', displayName: 'Fanta Orange' },
  { names: ['Fanta Strawberry'],                                            sku: '10028', displayName: 'Fanta Strawberry' },
  { names: ['Schweppes Manow', 'Schweppes Manao', 'Schweppes Lime'],        sku: '10021', displayName: 'Schweppes Lime' },
  { names: ['Soda Water'],                                                  sku: '10029', displayName: 'Soda Water' },
  { names: ['Bottle Water', 'Bottled Water'],                               sku: '10031', displayName: 'Bottle Water' },
  { names: ['Sprite'],                                                      sku: '10026', displayName: 'Sprite' },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Build a normalised name → entry lookup map
const drinkNameMap = new Map<string, typeof DRINK_MODIFIER_ENTRIES[number]>();
for (const entry of DRINK_MODIFIER_ENTRIES) {
  for (const name of entry.names) {
    drinkNameMap.set(norm(name), entry);
  }
}

export function isDrinkModifier(modifierName: string): boolean {
  return drinkNameMap.has(norm(modifierName));
}

export function getDrinkEntryForModifier(modifierName: string): typeof DRINK_MODIFIER_ENTRIES[number] | null {
  return drinkNameMap.get(norm(modifierName)) ?? null;
}

// ─── Raw modifier aggregate from lv_modifier ──────────────────────────────────
async function getRawModifiers(date: string): Promise<Array<{ modifier_name: string; total: number }>> {
  const result = await pool.query<{ modifier_name: string; total: string }>(
    `SELECT m.name AS modifier_name, SUM(m.qty)::int AS total
     FROM lv_modifier m
     JOIN lv_receipt r ON r.receipt_id = m.receipt_id
     WHERE r.datetime_bkk::date = $1::date
     GROUP BY m.name
     ORDER BY total DESC, m.name`,
    [date],
  );
  return result.rows.map((r) => ({ modifier_name: r.modifier_name, total: Number(r.total) }));
}

// ─── GET /drink-modifiers?date=YYYY-MM-DD ─────────────────────────────────────
router.get('/drink-modifiers', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    const allModifiers = await getRawModifiers(date);

    const drinkRows: Array<{
      modifier_name: string;
      sku: string;
      display_name: string;
      total: number;
      flag?: string;
    }> = [];

    for (const row of allModifiers) {
      const entry = getDrinkEntryForModifier(row.modifier_name);
      if (!entry) continue; // not a drink — goes to other-modifiers

      drinkRows.push({
        modifier_name: row.modifier_name,
        sku: entry.sku,
        display_name: entry.displayName,
        total: row.total,
      });
    }

    // Check for any modifier names that start with known drink words but didn't map — flag them
    const knownDrinkPrefixes = ['coke', 'sprite', 'fanta', 'schweppes', 'water', 'soda', 'bottle'];
    const unmapped: string[] = [];
    for (const row of allModifiers) {
      if (isDrinkModifier(row.modifier_name)) continue;
      const lower = row.modifier_name.toLowerCase();
      if (knownDrinkPrefixes.some((p) => lower.startsWith(p))) {
        unmapped.push(row.modifier_name);
      }
    }

    return res.json({
      ok: true,
      date,
      source: 'lv_modifier',
      total_drink_modifiers: drinkRows.reduce((s, r) => s + r.total, 0),
      data: drinkRows,
      unmapped_drink_modifiers: unmapped,
    });
  } catch (err: any) {
    console.error('[drink-modifiers] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /other-modifiers?date=YYYY-MM-DD ─────────────────────────────────────
router.get('/other-modifiers', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    const allModifiers = await getRawModifiers(date);

    const otherRows = allModifiers
      .filter((row) => !isDrinkModifier(row.modifier_name))
      .map((row) => ({
        modifier_name: row.modifier_name,
        total: row.total,
      }));

    return res.json({
      ok: true,
      date,
      source: 'lv_modifier',
      total_other_modifiers: otherRows.reduce((s, r) => s + r.total, 0),
      data: otherRows,
    });
  } catch (err: any) {
    console.error('[other-modifiers] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
