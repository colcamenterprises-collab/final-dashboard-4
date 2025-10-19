import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();
const TZ = "Asia/Bangkok";
const LOYVERSE_TOKEN = process.env.LOYVERSE_TOKEN!;
const LOYVERSE_API = "https://api.loyverse.com/v1.0/receipts";

type LvReceipt = {
  receipt_number: string;
  receipt_date: string;
  total_money?: { amount: number };
  line_items?: Array<{ name: string; quantity: number; price?: number; sku?: string }>;
  payment_type?: string;
};

async function fetchDay(dayISO: string): Promise<LvReceipt[]> {
  const day = DateTime.fromISO(dayISO, { zone: TZ }).startOf("day");
  const fromUTC = day.toUTC().toISO();
  const toUTC = day.plus({ days: 1 }).toUTC().toISO();

  const out: LvReceipt[] = [];
  let url = `${LOYVERSE_API}?from=${encodeURIComponent(fromUTC!)}&to=${encodeURIComponent(toUTC!)}`;
  for (let i = 0; i < 50 && url; i++) {
    const r = await axios.get(url, { headers: { Authorization: `Bearer ${LOYVERSE_TOKEN}` }, timeout: 30000 });
    const data = r.data;
    if (Array.isArray(data?.receipts)) out.push(...data.receipts);
    url = data?.links?.next ?? null;
  }
  return out;
}

export async function loyverseImportRange(fromISO: string, toISO: string): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const start = DateTime.fromISO(fromISO, { zone: TZ }).startOf("day");
  const end = DateTime.fromISO(toISO, { zone: TZ }).startOf("day");
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const day = d.toISODate()!;
    const batchId = `LOYVERSE_${day.replace(/-/g, "")}`;
    const receipts = await fetchDay(day);
    await prisma.$executeRaw`DELETE FROM pos_receipt WHERE batch_id = ${batchId}`;
    let inserted = 0;
    for (const rc of receipts) {
      const bangkokTs = DateTime.fromISO(rc.receipt_date).setZone(TZ).toISO();
      const items = (rc.line_items ?? []).map(li => ({
        name: li.name,
        quantity: Number(li.quantity || 0),
        price: Number(li.price || 0),
        sku: li.sku ? String(li.sku).trim() : null,
      }));
      await prisma.$executeRaw`
        INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
        VALUES (gen_random_uuid(), ${batchId}, ${rc.receipt_number}, ${bangkokTs}::timestamptz,
                ${(rc.total_money?.amount ?? 0) / 100.0}, ${JSON.stringify(items)}::jsonb,
                ${rc.payment_type ?? null}, now())
      `;
      inserted++;
    }
    results[day] = inserted;
  }
  return results;
}
