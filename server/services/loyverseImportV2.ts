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
import { PrismaClient } from "@prisma/client";
import { getBangkokBusinessWindow, normalizeLoyversePayments, parseLoyverseMoney } from "./loyverseMirrorCommon.js";

const db = new PrismaClient();
const LOYVERSE_TOKEN = process.env.LOYVERSE_TOKEN || process.env.LOYVERSE_API_TOKEN || process.env.LOYVERSE_ACCESS_TOKEN;
const LOYVERSE_API = process.env.LOYVERSE_BASE_URL || "https://api.loyverse.com/v1.0";

type LvReceipt = {
  id?: string;
  receipt_number: string;
  receipt_date: string;
  total_money?: number | { amount?: number; value?: number };
  line_items?: Array<{
    item_name?: string;
    name?: string;
    quantity: number;
    price?: number | { amount?: number; value?: number };
    total_money?: number | { amount?: number; value?: number };
    sku?: string;
    line_modifiers?: Array<{ name?: string; option?: string; quantity?: number; sku?: string }>;
  }>;
  payments?: any[];
  employee?: { name?: string };
  customer_id?: string;
};

async function* fetchReceipts(fromISO: string, toISO: string): AsyncGenerator<LvReceipt> {
  if (!LOYVERSE_TOKEN) {
    throw new Error("LOYVERSE_TOKEN, LOYVERSE_API_TOKEN, or LOYVERSE_ACCESS_TOKEN is required for Loyverse sync");
  }
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams();
    params.append('created_at_min', fromISO);
    params.append('created_at_max', toISO);
    if (cursor) {
      params.append('cursor', cursor);
      params.append('page_token', cursor);
    }

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

    cursor = data?.cursor ?? data?.next_page_token ?? data?.nextCursor;
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
  let importedReceipts = 0;
  let updatedReceipts = 0;
  let skippedDuplicateReceipts = 0;
  let failedReceipts = 0;
  let lineItemsImported = 0;
  let lineItemsSkippedDuplicates = 0;
  let modifiersImported = 0;
  let modifiersSkippedDuplicates = 0;
  let paymentsImported = 0;
  const errors: Array<{ receipt_id: string | null; message: string }> = [];

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

      const receiptId = rc.receipt_number || rc.id;
      if (!receiptId) {
        failedReceipts++;
        errors.push({ receipt_id: null, message: "Receipt missing receipt_number/id" });
        continue;
      }

      try {
        const totalAmount = parseLoyverseMoney(rc.total_money);
        const normalizedPayments = normalizeLoyversePayments(rc.payments);
        paymentsImported += normalizedPayments.length;

        const existingRows = await db.$queryRaw<{ exists: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM lv_receipt WHERE receipt_id = ${receiptId}) AS exists`;
        const receiptExisted = Boolean(existingRows[0]?.exists);

        // lv_receipt: DO UPDATE allowed — receipt metadata/payment/raw payload can be corrected by Loyverse.
        await db.$executeRaw`
          INSERT INTO lv_receipt (receipt_id, datetime_bkk, staff_name, customer_id, total_amount, payment_json, raw_json)
          VALUES (${receiptId}, ${receiptDateISO}::timestamptz, ${rc.employee?.name ?? null}, ${rc.customer_id ?? null},
                  ${totalAmount}, ${JSON.stringify(normalizedPayments)}::jsonb, ${JSON.stringify(rc)}::jsonb)
          ON CONFLICT (receipt_id) DO UPDATE
          SET datetime_bkk=EXCLUDED.datetime_bkk,
              staff_name=EXCLUDED.staff_name,
              customer_id=EXCLUDED.customer_id,
              total_amount=EXCLUDED.total_amount,
              payment_json=EXCLUDED.payment_json,
              raw_json=EXCLUDED.raw_json`;

        if (receiptExisted) {
          updatedReceipts++;
          skippedDuplicateReceipts++;
        } else {
          importedReceipts++;
        }

        let lineNo = 0;
        for (const li of rc.line_items ?? []) {
        lineNo++;

        // lv_line_item: DO NOTHING — immutable after first insert.
        // DB trigger no_update_lv_line_item blocks all UPDATEs.
        const insertedLineRows = await db.$queryRaw<{ inserted: number }[]>`
          INSERT INTO lv_line_item (receipt_id, line_no, sku, name, qty, unit_price, raw_json)
          VALUES (${receiptId}, ${lineNo}, ${li.sku ?? null}, ${li.item_name ?? li.name ?? "UNKNOWN"},
                  ${Number(li.quantity || 0)}, ${parseLoyverseMoney(li.price)}, ${JSON.stringify(li)}::jsonb)
          ON CONFLICT (receipt_id, line_no) DO NOTHING
          RETURNING 1 AS inserted`;
        if (insertedLineRows.length > 0) lineItemsImported++;
        else lineItemsSkippedDuplicates++;

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
            const insertedModifierRows = await db.$queryRaw<{ inserted: number }[]>`
              INSERT INTO lv_modifier (receipt_id, line_no, mod_no, sku, name, qty, raw_json)
              VALUES (${receiptId}, ${lineNo}, ${modNo}, ${m.sku ?? null}, ${modName},
                      1, ${JSON.stringify(m)}::jsonb)
              ON CONFLICT (receipt_id, line_no, mod_no) DO NOTHING
              RETURNING 1 AS inserted`;
            if (insertedModifierRows.length > 0) modifiersImported++;
            else modifiersSkippedDuplicates++;
          }
        }
        }
      } catch (receiptError: any) {
        failedReceipts++;
        errors.push({ receipt_id: receiptId, message: receiptError?.message || String(receiptError) });
        console.error(`[ImportV2] Failed receipt ${receiptId}:`, receiptError?.message || receiptError);
      }
    }

    const status = failedReceipts > 0 ? 'warning' : 'ok';
    await db.$executeRaw`
      UPDATE import_log
      SET receipts_fetched=${fetched}, receipts_upserted=${importedReceipts + updatedReceipts}, status=${status}, message=${errors.length ? JSON.stringify(errors.slice(0, 25)) : null}, finished_at=now()
      WHERE run_id=${runId}::uuid`;

    const result = {
      ok: failedReceipts === 0,
      status,
      runId,
      dateRange: { fromISO, toISO },
      importedReceipts,
      updatedReceipts,
      skippedDuplicates: skippedDuplicateReceipts + lineItemsSkippedDuplicates + modifiersSkippedDuplicates,
      skippedDuplicateReceipts,
      failedReceipts,
      lineItemsImported,
      lineItemsSkippedDuplicates,
      modifiersImported,
      modifiersSkippedDuplicates,
      paymentsImported,
      errors,
      legacy: { fetched, upserted: importedReceipts + updatedReceipts },
    };
    console.log(`[ImportV2] Complete: ${JSON.stringify(result)}`);
    return result;
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

export async function importShift(shiftDate: string) {
  const window = getBangkokBusinessWindow(shiftDate);
  const result = await importReceiptsV2(window.startISO, window.endISO);
  return {
    ...result,
    shiftDate,
    shiftWindow: window,
    receipts: result.importedReceipts + result.updatedReceipts,
    imported: result.importedReceipts,
  };
}

export async function syncRange(from: string, to: string) {
  const fromWindow = getBangkokBusinessWindow(from);
  const toWindow = getBangkokBusinessWindow(to);
  const result = await importReceiptsV2(fromWindow.startISO, toWindow.endISO);
  return { ...result, from, to, shiftWindow: { from: fromWindow, to: toWindow } };
}
