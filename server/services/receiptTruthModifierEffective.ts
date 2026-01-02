/**
 * PATCH 14 — MODIFIER EFFECTIVE COUNT (TRUTH LOCK)
 * Fixes modifier inflation by counting each modifier ONCE per sold base item per receipt.
 * 
 * Rule: Deduplicate by (receipt_id, base_item_id, modifier_id)
 * This ensures that even if the POS returns duplicates, we only count once.
 */

import axios from 'axios';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const LOYVERSE_API = 'https://api.loyverse.com/v1.0';
const LOYVERSE_TOKEN = process.env.LOYVERSE_TOKEN;

interface LoyverseLineModifier {
  modifier_id?: string;
  modifier_option_id?: string;
  name?: string;
  option?: string;
  quantity?: number;
  money_amount?: number;
}

interface LoyverseLineItem {
  item_id?: string;
  item_name: string;
  quantity: number;
  line_modifiers?: LoyverseLineModifier[];
}

interface LoyverseReceipt {
  receipt_number: string;
  receipt_date: string;
  refund_for?: string | null;
  line_items?: LoyverseLineItem[];
}

function getShiftWindowUTC(businessDate: string): { start: string; end: string } {
  const [year, month, day] = businessDate.split('-').map(Number);
  const startBangkok = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
  const endBangkok = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  return {
    start: startBangkok.toISOString(),
    end: endBangkok.toISOString(),
  };
}

async function fetchReceiptsFromLoyverse(startISO: string, endISO: string): Promise<LoyverseReceipt[]> {
  if (!LOYVERSE_TOKEN) {
    throw new Error('[MODIFIER_EFFECTIVE_FAIL] LOYVERSE_TOKEN not configured');
  }

  const allReceipts: LoyverseReceipt[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams();
    params.append('created_at_min', startISO);
    params.append('created_at_max', endISO);
    params.append('limit', '250');
    if (cursor) params.append('cursor', cursor);

    const url = `${LOYVERSE_API}/receipts?${params.toString()}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${LOYVERSE_TOKEN}` },
      timeout: 30000,
    });

    const data = response.data;
    if (Array.isArray(data?.receipts)) {
      allReceipts.push(...data.receipts);
    }

    cursor = data?.cursor;
    pageCount++;

    if (pageCount > 100) break;
  } while (cursor);

  return allReceipts;
}

function filterToShiftWindow(receipts: LoyverseReceipt[], startISO: string, endISO: string): LoyverseReceipt[] {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  
  return receipts.filter(r => {
    const receiptTime = new Date(r.receipt_date).getTime();
    return receiptTime >= start && receiptTime < end;
  });
}

export interface ModifierEffectiveRow {
  receiptId: string;
  baseItemId: string;
  modifierId: string;
  modifierName: string;
  priceImpact: number;
}

export interface ModifierEffectiveSummary {
  modifierName: string;
  count: number;
  totalRevenue: number;
}

export interface RebuildResult {
  ok: boolean;
  shiftDate: string;
  receiptsProcessed: number;
  modifiersInserted: number;
  uniqueModifiers: number;
}

export async function rebuildModifierEffective(businessDate: string): Promise<RebuildResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[MODIFIER_EFFECTIVE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  console.log(`[MODIFIER_EFFECTIVE] Rebuilding for ${businessDate}`);
  const { start, end } = getShiftWindowUTC(businessDate);

  const rawReceipts = await fetchReceiptsFromLoyverse(start, end);
  const receipts = filterToShiftWindow(rawReceipts, start, end);

  console.log(`[MODIFIER_EFFECTIVE] Processing ${receipts.length} receipts`);

  // Clear existing rows for this shift_date
  await db.execute(sql`DELETE FROM receipt_truth_modifier_effective WHERE shift_date = ${businessDate}::date`);

  // Deduplicate modifiers: Map key = "receipt_id|base_item_id|modifier_id"
  const modifierMap = new Map<string, ModifierEffectiveRow>();

  for (const receipt of receipts) {
    // Skip refunds
    if (receipt.refund_for) continue;

    const receiptId = receipt.receipt_number;
    const lineItems = receipt.line_items || [];

    // Use line index to distinguish multiple items of the same product on a receipt
    for (let lineIdx = 0; lineIdx < lineItems.length; lineIdx++) {
      const line = lineItems[lineIdx];
      // Combine item_id with line index to make each line item unique within receipt
      const baseItemId = `${line.item_id || 'UNKNOWN'}-L${lineIdx}`;
      const modifiers = line.line_modifiers || [];

      for (const mod of modifiers) {
        // Build a unique modifier ID: use modifier_option_id if available, else hash name+option
        const modifierId = mod.modifier_option_id || mod.modifier_id || `${mod.name}-${mod.option}`;
        const modifierName = mod.option || mod.name || 'Unknown Modifier';
        const priceImpact = Number(mod.money_amount || 0);

        // Dedupe key: only ONE entry per (receipt, line item position, modifier)
        // This correctly counts modifiers when same product ordered multiple times
        const key = `${receiptId}|${baseItemId}|${modifierId}`;

        if (!modifierMap.has(key)) {
          modifierMap.set(key, {
            receiptId,
            baseItemId,
            modifierId,
            modifierName,
            priceImpact,
          });
        }
      }
    }
  }

  // Insert deduplicated modifiers
  const rows = Array.from(modifierMap.values());
  let insertedCount = 0;

  for (const row of rows) {
    await db.execute(sql`
      INSERT INTO receipt_truth_modifier_effective 
        (shift_date, receipt_id, base_item_id, modifier_id, modifier_name, price_impact)
      VALUES 
        (${businessDate}::date, ${row.receiptId}, ${row.baseItemId}, ${row.modifierId}, ${row.modifierName}, ${row.priceImpact})
      ON CONFLICT (shift_date, receipt_id, base_item_id, modifier_id) DO NOTHING
    `);
    insertedCount++;
  }

  // Count unique modifiers
  const uniqueResult = await db.execute(sql`
    SELECT COUNT(DISTINCT modifier_name) as cnt FROM receipt_truth_modifier_effective WHERE shift_date = ${businessDate}::date
  `);
  const uniqueModifiers = Number((uniqueResult.rows[0] as any)?.cnt || 0);

  console.log(`[MODIFIER_EFFECTIVE] Inserted ${insertedCount} effective modifiers, ${uniqueModifiers} unique`);

  return {
    ok: true,
    shiftDate: businessDate,
    receiptsProcessed: receipts.length,
    modifiersInserted: insertedCount,
    uniqueModifiers,
  };
}

export async function getModifierEffectiveSummary(businessDate: string): Promise<ModifierEffectiveSummary[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[MODIFIER_EFFECTIVE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const result = await db.execute(sql`
    SELECT 
      modifier_name,
      COUNT(*)::int as count,
      COALESCE(SUM(price_impact), 0)::numeric as total_revenue
    FROM receipt_truth_modifier_effective
    WHERE shift_date = ${businessDate}::date
    GROUP BY modifier_name
    ORDER BY count DESC
  `);

  return (result.rows as any[]).map(row => ({
    modifierName: row.modifier_name,
    count: Number(row.count),
    totalRevenue: Number(row.total_revenue),
  }));
}
