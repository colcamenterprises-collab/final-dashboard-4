/*
 * POS TRUTH LAYER — INGESTION ONLY. DO NOT MODIFY STORAGE LOGIC.
 *
 * This file is the SOLE writer to lv_line_item and lv_modifier.
 * These tables are the canonical POS truth layer.
 *
 * Rules that MUST NOT be violated:
 *   1. lv_line_item rows are INSERT-ONLY. Once written they are never updated.
 *   2. lv_modifier rows are INSERT-ONLY. Once written they are never updated.
 *   3. lv_modifier.qty MUST always = 1. One row per selection per unit.
 *   4. Multi-quantity line items expand modifiers: qty=2 → 2 modifier rows.
 *   5. No SKU mapping, renaming, deduplication, or transformation at storage level.
 *
 * If you change this logic you break:
 *   - Sales accuracy
 *   - Modifier counts (Analysis V3)
 *   - Fraud detection
 *   - Entire system trust
 *
 * DO NOT add ON CONFLICT DO UPDATE to lv_line_item or lv_modifier.
 * The database triggers (no_update_lv_line_item, no_update_lv_modifier)
 * will reject any UPDATE attempt with POS_TRUTH_LAYER_VIOLATION.
 */

import axios from "axios";
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const LOYVERSE_TOKEN = process.env.LOYVERSE_TOKEN!;
const LOYVERSE_API = "https://api.loyverse.com/v1.0";

type LvReceipt = {
  receipt_number: string;
  receipt_date: string;
  total_money?: { amount: number };
  line_items?: Array<{
    item_name: string;
    quantity: number;
    price?: number;
    sku?: string;
    line_modifiers?: Array<{ name?: string; option?: string; quantity?: number; sku?: string }>;
  }>;
  payments?: any[];
  employee?: { name?: string };
  customer_id?: string;
};

async function* fetchReceipts(fromISO: string, toISO: string): AsyncGenerator<LvReceipt> {
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams();
    params.append('created_at_min', fromISO);
    params.append('created_at_max', toISO);
    if (cursor) params.append('cursor', cursor);

    const url = `${LOYVERSE_API}/receipts?${params.toString()}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${LOYVERSE_TOKEN}` },
      timeout: 30000,
    });

    const data = response.data;

    if (Array.isArray(data?.receipts)) {
      for (const receipt of data.receipts) {
        yield receipt;
      }
    }

    cursor = data?.cursor;
    pageCount++;

    if (pageCount > 500) {
      console.warn('[ImportV2] Hit page limit (500), stopping pagination');
      break;
    }
  } while (cursor);

  console.log(`[ImportV2] Fetched ${pageCount} pages total`);
}

export async function importReceiptsV2(fromISO: string, toISO: string) {
  console.log(`[ImportV2] Starting import from ${fromISO} to ${toISO}`);
  const started = new Date();
  const runId = crypto.randomUUID();
  let fetched = 0;
  let upserted = 0;

  try {
    await db.$executeRaw`
      INSERT INTO import_log (run_id, provider, from_ts, to_ts, started_at)
      VALUES (${runId}::uuid, 'loyverse', ${fromISO}::timestamptz, ${toISO}::timestamptz, ${started})`;

    for await (const rc of fetchReceipts(fromISO, toISO)) {
      fetched++;
      if (fetched <= 3) {
        console.log(`[ImportV2] Receipt ${fetched}: ${rc.receipt_number} at ${rc.receipt_date}`);
      }

      // Store Loyverse UTC time as-is. datetime_bkk is timestamptz (UTC internally).
      // Shift-window queries filter using Asia/Bangkok timezone.
      const receiptDateISO = rc.receipt_date;

      const totalAmount = typeof rc.total_money === 'number'
        ? rc.total_money / 100.0
        : (rc.total_money?.amount ?? 0) / 100.0;

      // lv_receipt: DO UPDATE allowed — receipt metadata (staff, total) can be corrected.
      await db.$executeRaw`
        INSERT INTO lv_receipt (receipt_id, datetime_bkk, staff_name, customer_id, total_amount, payment_json, raw_json)
        VALUES (${rc.receipt_number}, ${receiptDateISO}::timestamptz, ${rc.employee?.name ?? null}, ${rc.customer_id ?? null},
                ${totalAmount}, ${JSON.stringify(rc.payments ?? [])}::jsonb, ${JSON.stringify(rc)}::jsonb)
        ON CONFLICT (receipt_id) DO UPDATE
        SET datetime_bkk=EXCLUDED.datetime_bkk,
            staff_name=EXCLUDED.staff_name,
            customer_id=EXCLUDED.customer_id,
            total_amount=EXCLUDED.total_amount,
            payment_json=EXCLUDED.payment_json,
            raw_json=EXCLUDED.raw_json`;

      let lineNo = 0;
      for (const li of rc.line_items ?? []) {
        lineNo++;

        // lv_line_item: DO NOTHING — immutable after first insert.
        // DB trigger no_update_lv_line_item blocks all UPDATEs.
        await db.$executeRaw`
          INSERT INTO lv_line_item (receipt_id, line_no, sku, name, qty, unit_price, raw_json)
          VALUES (${rc.receipt_number}, ${lineNo}, ${li.sku ?? null}, ${li.item_name ?? "UNKNOWN"},
                  ${Number(li.quantity || 0)}, ${Number(li.price || 0)}, ${JSON.stringify(li)}::jsonb)
          ON CONFLICT (receipt_id, line_no) DO NOTHING`;

        // lv_modifier: DO NOTHING — immutable after first insert.
        // DB trigger no_update_lv_modifier blocks all UPDATEs.
        //
        // MULTI-QUANTITY RULE: one modifier row per selection PER UNIT.
        // Double Set x2 with Coke → 2 rows (mod_no 1 and 2), each qty=1.
        // mod_no increments globally within this line item so
        // (receipt_id, line_no, mod_no) stays unique across all units.
        //
        // qty is hardcoded to 1. DB CHECK constraint qty_must_be_one enforces this.
        let modNo = 0;
        const lineQty = Math.max(1, Number(li.quantity || 1));
        for (let unitIdx = 0; unitIdx < lineQty; unitIdx++) {
          for (const m of li.line_modifiers ?? []) {
            modNo++;
            const modName = m.option ?? m.name ?? "MOD";
            await db.$executeRaw`
              INSERT INTO lv_modifier (receipt_id, line_no, mod_no, sku, name, qty, raw_json)
              VALUES (${rc.receipt_number}, ${lineNo}, ${modNo}, ${m.sku ?? null}, ${modName},
                      1, ${JSON.stringify(m)}::jsonb)
              ON CONFLICT (receipt_id, line_no, mod_no) DO NOTHING`;
          }
        }
      }
      upserted++;
    }

    await db.$executeRaw`
      UPDATE import_log
      SET receipts_fetched=${fetched}, receipts_upserted=${upserted}, status='ok', finished_at=now()
      WHERE run_id=${runId}::uuid`;

    console.log(`[ImportV2] Complete: fetched=${fetched}, upserted=${upserted}`);
    return { ok: true, fetched, upserted };
  } catch (error: any) {
    console.error('[ImportV2] Error:', error.message);
    await db.$executeRaw`
      UPDATE import_log
      SET status='error', message=${error.message}, finished_at=now()
      WHERE run_id=${runId}::uuid`;
    throw error;
  } finally {
    await db.$disconnect();
  }
}
