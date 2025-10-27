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
    modifiers?: Array<{ name: string; quantity?: number; sku?: string }>;
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

      const dtBkk = DateTime.fromISO(rc.receipt_date, { zone: "UTC" }).setZone("Asia/Bangkok").toISO();
      const totalAmount = (rc.total_money?.amount ?? 0) / 100.0;

      await db.$executeRaw`
        INSERT INTO lv_receipt (receipt_id, datetime_bkk, staff_name, customer_id, total_amount, payment_json, raw_json)
        VALUES (${rc.receipt_number}, ${dtBkk}::timestamptz, ${rc.employee?.name ?? null}, ${rc.customer_id ?? null},
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
        await db.$executeRaw`
          INSERT INTO lv_line_item (receipt_id, line_no, sku, name, qty, unit_price, raw_json)
          VALUES (${rc.receipt_number}, ${lineNo}, ${li.sku ?? null}, ${li.item_name ?? "UNKNOWN"},
                  ${Number(li.quantity || 0)}, ${Number(li.price || 0)}, ${JSON.stringify(li)}::jsonb)
          ON CONFLICT (receipt_id, line_no) DO UPDATE
          SET sku=EXCLUDED.sku, name=EXCLUDED.name, qty=EXCLUDED.qty, unit_price=EXCLUDED.unit_price,
              raw_json=EXCLUDED.raw_json`;

        let modNo = 0;
        for (const m of li.modifiers ?? []) {
          modNo++;
          await db.$executeRaw`
            INSERT INTO lv_modifier (receipt_id, line_no, mod_no, sku, name, qty, raw_json)
            VALUES (${rc.receipt_number}, ${lineNo}, ${modNo}, ${m.sku ?? null}, ${m.name ?? "MOD"},
                    ${Number(m.quantity || 1)}, ${JSON.stringify(m)}::jsonb)
            ON CONFLICT (receipt_id, line_no, mod_no) DO UPDATE
            SET sku=EXCLUDED.sku, name=EXCLUDED.name, qty=EXCLUDED.qty, raw_json=EXCLUDED.raw_json`;
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
