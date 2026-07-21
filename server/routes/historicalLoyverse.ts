import { Router, Request, Response } from "express";
import { getPinSessionUser } from "./pinAuth";

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

const shiftMonths = [
  { month: "Jan 2026", shifts: 32, cashPayments: 378334.90, cashRefunds: 3624, paidIn: 2176.86, paidOut: 102234.86, difference: 2658.10 },
  { month: "Feb 2026", shifts: 30, cashPayments: 308759.20, cashRefunds: 2794, paidIn: 5114.08, paidOut: 76213.92, difference: 19562.76 },
  { month: "Mar 2026", shifts: 33, cashPayments: 261425.10, cashRefunds: 3849, paidIn: 2000, paidOut: 69901, difference: 79130.90 },
  { month: "Apr 2026", shifts: 31, cashPayments: 177921, cashRefunds: 449, paidIn: 5307.55, paidOut: 71071.99, difference: 476.44 },
  { month: "May 2026", shifts: 32, cashPayments: 137925.30, cashRefunds: 240, paidIn: 1242, paidOut: 60060.16, difference: -2327.14 },
  { month: "Jun 2026", shifts: 30, cashPayments: 90295.10, cashRefunds: 0, paidIn: 723, paidOut: 60445.50, difference: 4210.40 },
  { month: "Jul 2026", shifts: 20, cashPayments: 56594.30, cashRefunds: 0, paidIn: 16, paidOut: 70428.08, difference: 16522.78 },
];

const recentShifts = [
  { number: 933, opened: "20 Jul 2026 18:58", closed: "21 Jul 2026 02:17", cash: 3542, paidOut: 5402, expected: -1860, actual: 0, difference: 1860 },
  { number: 932, opened: "19 Jul 2026 18:15", closed: "20 Jul 2026 02:11", cash: 2013, paidOut: 1753, expected: 260, actual: 0, difference: -260 },
  { number: 931, opened: "18 Jul 2026 18:43", closed: "19 Jul 2026 02:11", cash: 6644, paidOut: 4977, expected: 1667, actual: 1667, difference: 0 },
  { number: 930, opened: "17 Jul 2026 18:48", closed: "18 Jul 2026 02:19", cash: 2486.10, paidOut: 2076, expected: 410.10, actual: 0, difference: -410.10 },
  { number: 929, opened: "16 Jul 2026 19:20", closed: "17 Jul 2026 02:07", cash: 2870, paidOut: 4833, expected: -1963, actual: 0, difference: 1963 },
  { number: 928, opened: "15 Jul 2026 18:46", closed: "16 Jul 2026 02:24", cash: 4241, paidOut: 5003, expected: -762, actual: 266, difference: 1028 },
  { number: 927, opened: "14 Jul 2026 19:16", closed: "15 Jul 2026 02:03", cash: 1961, paidOut: 3702, expected: -1741, actual: 0, difference: 1741 },
  { number: 926, opened: "13 Jul 2026 19:09", closed: "14 Jul 2026 01:53", cash: 3521, paidOut: 3336, expected: 185, actual: 185, difference: 0 },
];

router.get("/", (req: Request, res: Response) => {
  const user = getPinSessionUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (user.role !== "owner") return res.status(403).json({ error: "Owner access required" });

  res.json({
    source: "Loyverse direct CSV exports",
    period: { from: "2026-01-01", to: "2026-07-21", timezone: "Asia/Bangkok" },
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
      shifts: 208,
      modifierQuantity: 8648,
      modifierNetSales: 84510,
    },
    paymentTypes,
    discounts,
    topModifiers,
    shiftMonths,
    recentShifts,
    completeness: {
      paymentTypes: 4,
      discounts: 5,
      modifierRows: 62,
      shiftRows: 208,
      missingShiftNumbers: [911, 912, 913, 914, 915, 916],
    }
  });
});

export default router;
