import { PrismaClient } from "@prisma/client";
import { recomputeRollsLedgerByShiftDate } from "./rollsLedgerSimple.js";
const db = new PrismaClient();

async function importFromLoyverse(shiftDate: string): Promise<number> {
  try {
    const mod = await import("../services/loyverseImportV2.js");
    if (typeof (mod as any).importShift === "function") {
      const r = await (mod as any).importShift(shiftDate);
      return Number(r?.receipts ?? r?.imported ?? 0);
    }
    if (typeof (mod as any).syncShift === "function") {
      const r = await (mod as any).syncShift(shiftDate);
      return Number(r?.receipts ?? r?.imported ?? 0);
    }
    if (typeof (mod as any).syncRange === "function") {
      const r = await (mod as any).syncRange(shiftDate, shiftDate);
      return Number(r?.receipts ?? r?.imported ?? 0);
    }
  } catch { /* importer not available; proceed with DB */ }
  return 0;
}

async function cacheHasDate(shiftDate: string): Promise<boolean> {
  const r:any[] = await db.$queryRaw`
    SELECT COUNT(*)::int AS n FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date
  `;
  return Number(r?.[0]?.n ?? 0) > 0;
}

async function computeShiftAll(shiftDate: string): Promise<void> {
  const svc = await import("./shiftItems.js");
  if (typeof (svc as any).computeShiftAll === "function") {
    await (svc as any).computeShiftAll(shiftDate);
  }
}

export async function ensureShift(shiftDate: string): Promise<void> {
  if (!(await cacheHasDate(shiftDate))) {
    // Try to ensure raw receipts exist; import if missing.
    const rc:any[] = await db.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM lv_receipt
      WHERE (DATE(datetime_bkk AT TIME ZONE 'Asia/Bangkok')) IN (${shiftDate}::date, (${shiftDate}::date + INTERVAL '1 day')::date)
    `;
    if (Number(rc?.[0]?.n ?? 0) === 0) {
      await importFromLoyverse(shiftDate);
    }
    await computeShiftAll(shiftDate);
  }
  await recomputeRollsLedgerByShiftDate(shiftDate);
}
