// server/lib/expenseTotals.ts
type Num = number | string | null | undefined;
const toNum = (v: Num) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));
const sumBy = (arr: any[], key: string) =>
  Array.isArray(arr) ? arr.reduce((a, b) => a + toNum(b?.[key]), 0) : 0;

/**
 * Accepts the DB row that contains either column totals and/or a JSON payload with arrays:
 *   row.shoppingTotal, row.wagesTotal, row.othersTotal
 *   row.payload.expenses[] -> { cost }
 *   row.payload.wages[] -> { amount }
 *   row.payload.otherExpenses[] -> { amount }
 *   row.payload.shoppingTotal / wagesTotal / othersTotal (optional)
 * Returns legacy keys used by the UI.
 */
export function extractFormExpenseTotals(row: any) {
  const payload = row?.payload ?? {};

  // 1) Column totals
  const colShopping = toNum(row?.shoppingTotal);
  const colWages    = toNum(row?.wagesTotal);
  const colOthers   = toNum(row?.othersTotal);

  // 2) Top-level payload totals (if your submitter sets them)
  const payShopping = toNum(payload?.shoppingTotal);
  const payWages    = toNum(payload?.wagesTotal);
  const payOthers   = toNum(payload?.othersTotal);

  // 3) Calculated from arrays (defensive fallback)
  const calcShopping = sumBy(payload?.expenses, "cost");
  const calcWages    = sumBy(payload?.wages, "amount");
  const calcOthers   = sumBy(payload?.otherExpenses, "amount");

  const shoppingTotal = colShopping || payShopping || calcShopping;
  const wageTotal     = colWages    || payWages    || calcWages;
  const otherTotal    = colOthers   || payOthers   || calcOthers;
  const grandTotal    = shoppingTotal + wageTotal + otherTotal;

  return { shoppingTotal, wageTotal, otherTotal, grandTotal };
}

/**
 * POS/shift side — if you don't store expenses there, keep zeros but return the same keys.
 * If you do store them, apply the same pattern here.
 */
export function extractPosExpenseTotals(posRow: any) {
  const payload = posRow?.payload ?? {};
  const colShopping = toNum(posRow?.shoppingTotal);
  const colWages    = toNum(posRow?.wagesTotal);
  const colOthers   = toNum(posRow?.othersTotal);
  const payShopping = toNum(payload?.shoppingTotal);
  const payWages    = toNum(payload?.wagesTotal);
  const payOthers   = toNum(payload?.othersTotal);

  const shoppingTotal = colShopping || payShopping || 0;
  const wageTotal     = colWages    || payWages    || 0;
  const otherTotal    = colOthers   || payOthers   || 0;
  const grandTotal    = shoppingTotal + wageTotal + otherTotal;

  return { shoppingTotal, wageTotal, otherTotal, grandTotal };
}
