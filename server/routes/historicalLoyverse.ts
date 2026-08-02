import { Router, Request, Response } from "express";
import { getPinSessionUser } from "./pinAuth";
import { shiftChunk0 } from "../data/loyverseShifts2026Chunk0";
import { shiftChunk1 } from "../data/loyverseShifts2026Chunk1";
import { shiftChunk2 } from "../data/loyverseShifts2026Chunk2";
import { shiftChunk3 } from "../data/loyverseShifts2026Chunk3";

const router = Router();

const paymentTypes = [
  { name: "Cash", transactions: 4403, gross: 1406650, refundTransactions: 26, refunds: 10956, net: 1395694 },
  { name: "GRAB", transactions: 3837, gross: 1750293, refundTransactions: 26, refunds: 10289, net: 1740004 },
  { name: "SCAN (QR Code)", transactions: 769, gross: 237222, refundTransactions: 11, refunds: 3703, net: 233519 },
  { name: "DIRECT", transactions: 4, gross: 819, refundTransactions: 1, refunds: 40, net: 779 },
];

const discounts = [
  { name: "Discount by points", applied: 0, amount: 0 },
  { name: "Member Discount", applied: 155, amount: 6617 },
  { name: "old price", applied: 1, amount: 20 },
  { name: "Owner", applied: 27, amount: 10871 },
  { name: "Google Review", applied: 4, amount: 137 },
];

const topModifiers = [
  { group: "Make it Better", option: "Crispy Bacon (เบคอนกรอบ)", sold: 429, refunded: 4, gross: 17160, refunds: 160, net: 17000 },
  { group: "Make it Better", option: "Double Cheese (เพิ่มชีส)", sold: 377, refunded: 5, gross: 15080, refunds: 200, net: 14880 },
  { group: "Make it Better", option: "Jalapenos (ฮาลาปิโน)", sold: 299, refunded: 2, gross: 11960, refunds: 80, net: 11880 },
  { group: "Make it Better", option: "Grilled Onions (หอมใหญ่ย่าง)", sold: 227, refunded: 1, gross: 6810, refunds: 30, net: 6780 },
  { group: "Burger Extra Options", option: "Crispy Bacon", sold: 154, refunded: 1, gross: 6160, refunds: 40, net: 6120 },
  { group: "Burger Extra Options", option: "Double Cheese", sold: 139, refunded: 2, gross: 5560, refunds: 80, net: 5480 },
  { group: "Burger Extra Options", option: "Jalapenos", sold: 136, refunded: 3, gross: 5440, refunds: 120, net: 5320 },
  { group: "Make it Better", option: "Crunchy Fried Onions", sold: 131, refunded: 0, gross: 5240, refunds: 0, net: 5240 },
  { group: "Drink Options (Sets)", option: "Coke", sold: 1089, refunded: 5, gross: 0, refunds: 0, net: 0 },
  { group: "Drink Options (Sets)", option: "Coke Zero", sold: 728, refunded: 3, gross: 0, refunds: 0, net: 0 },
  { group: "Drink Options (Sets)", option: "Fanta Orange", sold: 289, refunded: 3, gross: 0, refunds: 0, net: 0 },
  { group: "Drink Options (Sets)", option: "Bottle Water", sold: 244, refunded: 2, gross: 0, refunds: 0, net: 0 },
];

type ShiftTuple = readonly [number,string,string,string,string,number,number,number,number,number,number,number,number];
const shiftTuples: readonly ShiftTuple[] = [
  ...shiftChunk0,
  ...shiftChunk1,
  ...shiftChunk2,
  ...shiftChunk3,
] as readonly ShiftTuple[];

function parseLoyverseDate(value: string) {
  const [date, time] = value.trim().split(/\s+/);
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const displayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

const shiftRows = shiftTuples.map((r) => {
  const [number, opened, openedBy, closed, closedBy, startingCash, cashPayments, cashRefunds, paidIn, paidOut, expected, actual, difference] = r;
  const closedDate = parseLoyverseDate(closed);
  return {
    number,
    store: "Smash Bros Burgers (Rawai)",
    pos: "Smash Brothers - Rawai (Main POS)",
    opened: displayFormatter.format(parseLoyverseDate(opened)).replace(",", ""),
    openedRaw: opened,
    openedBy,
    closed: displayFormatter.format(closedDate).replace(",", ""),
    closedRaw: closed,
    closedBy,
    reportDate: closedDate.toISOString().slice(0, 10),
    month: monthFormatter.format(closedDate),
    startingCash,
    cash: cashPayments,
    cashRefunds,
    paidIn,
    paidOut,
    expected,
    actual,
    difference,
  };
}).sort((a, b) => b.number - a.number);

const shiftMonthsMap = new Map<string, { month:string; shifts:number; startingCash:number; cashPayments:number; cashRefunds:number; paidIn:number; paidOut:number; expected:number; actual:number; difference:number; sortDate:string }>();
for (const row of shiftRows) {
  const current = shiftMonthsMap.get(row.month) || { month: row.month, shifts: 0, startingCash: 0, cashPayments: 0, cashRefunds: 0, paidIn: 0, paidOut: 0, expected: 0, actual: 0, difference: 0, sortDate: row.reportDate.slice(0, 7) };
  current.shifts += 1;
  current.startingCash += row.startingCash;
  current.cashPayments += row.cash;
  current.cashRefunds += row.cashRefunds;
  current.paidIn += row.paidIn;
  current.paidOut += row.paidOut;
  current.expected += row.expected;
  current.actual += row.actual;
  current.difference += row.difference;
  shiftMonthsMap.set(row.month, current);
}
const shiftMonths = [...shiftMonthsMap.values()].sort((a, b) => a.sortDate.localeCompare(b.sortDate)).map(({ sortDate, ...row }) => row);

const shiftNumbers = shiftRows.map((r) => r.number);
const minShift = Math.min(...shiftNumbers);
const maxShift = Math.max(...shiftNumbers);
const shiftSet = new Set(shiftNumbers);
const missingShiftNumbers = Array.from({ length: maxShift - minShift + 1 }, (_, i) => minShift + i).filter((n) => !shiftSet.has(n));

router.get("/", (req: Request, res: Response) => {
  const user = getPinSessionUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (user.role !== "owner") return res.status(403).json({ error: "Owner access required" });

  res.json({
    source: "Loyverse direct CSV exports",
    period: { from: "2026-01-01", to: "2026-07-21", timezone: "Asia/Bangkok" },
    shiftSource: "Loyverse shift CSV export",
    shiftPeriod: { from: "2026-01-01", to: "2026-08-03", timezone: "Asia/Bangkok" },
    reconciliation: {
      paymentNet: 3369996,
      salesSummaryNet: 3369989,
      difference: 7,
      warning: "Payment-type net is ฿7 above the daily sales-summary export. Source totals are retained unchanged."
    },
    totals: {
      paymentTransactions: 9013,
      grossPayments: 3394984,
      refundTransactions: 64,
      refunds: 24988,
      netPayments: 3369996,
      discountsApplied: 187,
      discounts: 17645,
      shifts: shiftRows.length,
      modifierQuantity: 8648,
      modifierNetSales: 84510,
    },
    paymentTypes,
    discounts,
    topModifiers,
    shiftMonths,
    recentShifts: shiftRows,
    completeness: {
      paymentTypes: 4,
      discounts: 5,
      modifierRows: 62,
      shiftRows: shiftRows.length,
      missingShiftNumbers,
      shiftNumberRange: { from: minShift, to: maxShift },
    }
  });
});

export default router;
