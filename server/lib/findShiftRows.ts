import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Business rule: a "shift date D" is the shift that runs from
 * local BKK D 18:00 -> D+1 03:00.
 * Storage may have written "shiftDate" as D, D-1, or D+1 depending on UTC logic.
 * This resolver:
 *   1) tries exact match on shiftDate = D
 *   2) falls back to neighbors D-1 and D+1
 *   3) if multiple candidates, choose the one whose createdAt falls in
 *      [D 18:00 BKK, D+1 03:00 BKK] when converted to UTC; otherwise pick latest.
 */

function bkkWindowUtc(dateStr: string) {
  // Build BKK window without extra deps, using Intl to get BKK timestamps
  const asBkk = (y: number, m: number, d: number, h: number, mi = 0) =>
    new Date(new Date(Date.UTC(y, m - 1, d, h - 7, mi)).toISOString()); // Asia/Bangkok = UTC+7

  const [y, m, d] = dateStr.split("-").map(Number);
  const startBkk = asBkk(y, m, d, 18, 0);         // D 18:00 BKK -> UTC
  // next day for 03:00 BKK
  const endDate = new Date(Date.UTC(y, m - 1, d));
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const y2 = endDate.getUTCFullYear();
  const m2 = endDate.getUTCMonth() + 1;
  const d2 = endDate.getUTCDate();
  const endBkk = asBkk(y2, m2, d2, 3, 0);         // D+1 03:00 BKK -> UTC

  return { startUtc: startBkk, endUtc: endBkk };
}

export async function findDailySalesRowFor(dateStr: string) {
  const candidates = await prisma.dailySalesV2.findMany({
    where: { shiftDate: { in: [dateStr, prev(dateStr), next(dateStr)] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!candidates.length) return null;

  const { startUtc, endUtc } = bkkWindowUtc(dateStr);
  const inWindow = candidates.find(r => {
    const c = new Date(r.createdAt);
    return c >= startUtc && c <= endUtc;
  });
  return inWindow ?? candidates[0];
}

export async function findPosShiftRowFor(dateStr: string) {
  // PosShiftReport uses businessDate (DateTime) not shiftDate
  // We look for dates D-1, D, D+1 as Date objects
  const dates = [prev(dateStr), dateStr, next(dateStr)].map(s => new Date(s + "T00:00:00Z"));
  
  const candidates = await prisma.posShiftReport.findMany({
    where: { 
      OR: dates.map(d => ({ businessDate: d }))
    },
    orderBy: { openedAt: "desc" },
  });
  if (!candidates.length) return null;

  const { startUtc, endUtc } = bkkWindowUtc(dateStr);
  const inWindow = candidates.find(r => {
    // Use openedAt for matching the shift window
    if (!r.openedAt) return false;
    const c = new Date(r.openedAt);
    return c >= startUtc && c <= endUtc;
  });
  return inWindow ?? candidates[0];
}

function prev(s: string) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0,10);
}
function next(s: string) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0,10);
}
