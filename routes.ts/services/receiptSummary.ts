import { db } from "../db";
import {
  loyverseReceipts,
  dailyShiftReceiptSummary,
  insertDailyReceiptSummarySchema,
} from "@shared/schema";
import { between } from "drizzle-orm";

/** Helper: return [shiftStartUTC, shiftEndUTC] for any Bangkok-date (yyyy-mm-dd). */
export function getShiftWindow(dateStr: string): [Date, Date] {
  // 5 PM Bangkok
  const start = new Date(`${dateStr}T10:00:00Z`);       // 17:00 +07 == 10:00Z
  const end = new Date(`${dateStr}T20:00:00Z`);         // 03:00 +07 next day == 20:00Z
  end.setUTCDate(end.getUTCDate() + 1);
  return [start, end];
}

/** Categorisation rules */
const categoryOf = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("burger")) return "BURGERS";
  if (n.includes("fries") || n.includes("side")) return "SIDE ORDERS";
  if (n.includes("add") || n.includes("extra")) return "BURGER EXTRAS";
  if (n.includes("coke") || n.includes("water") || n.includes("drink"))
    return "DRINKS";
  return "OTHER";
};

/** Build + save summary for a given Bangkok date (yyyy-mm-dd). */
export async function buildShiftSummary(dateStr: string) {
  const [start, end] = getShiftWindow(dateStr);

  // grab all receipts in range
  const receipts = await db
    .select()
    .from(loyverseReceipts)
    .where(between(loyverseReceipts.receiptDate, start, end));

  const itemsMap: Record<string, { qty: number; sales: number }> = {};
  const modsMap: Record<string, { qty: number; sales: number }> = {};
  let burgersSold = 0;
  let drinksSold = 0;

  receipts.forEach((r) => {
    (r.items ?? []).forEach((it: any) => {
      const key = it.item_name ?? "unknown";
      const cat = categoryOf(key);
      const qty = it.quantity ?? 1;
      const sales = parseFloat(it.total_money ?? it.line_total ?? 0);

      itemsMap[cat] ??= { qty: 0, sales: 0 };
      itemsMap[cat].qty += qty;
      itemsMap[cat].sales += sales;

      if (cat === "BURGERS") burgersSold += qty;
      if (cat === "DRINKS") drinksSold += qty;

      // modifiers
      (it.line_modifiers ?? []).forEach((m: any) => {
        const mkey = m.name ?? "modifier";
        modsMap[mkey] ??= { qty: 0, sales: 0 };
        modsMap[mkey].qty += 1;
        modsMap[mkey].sales += parseFloat(m.money_amount ?? 0);
      });
    });
  });

  const data = insertDailyReceiptSummarySchema.parse({
    shiftDate: dateStr,
    burgersSold,
    drinksSold,
    itemsBreakdown: itemsMap,
    modifiersSummary: modsMap,
  });

  await db
    .insert(dailyShiftReceiptSummary)
    .values(data)
    .onConflictDoUpdate({ target: dailyShiftReceiptSummary.shiftDate, set: data });
  return data;
}