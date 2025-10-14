export type BankingAuto = {
  startingCash: number;
  closingCash: number;
  cashSales: number;
  qrSales: number;
  cashExpenses: number;
  expectedCashBank: number;
  expectedQRBank: number;
  expectedTotalBank: number;
};

const N = (v:any) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n) ? n : 0;
};

export function computeBankingAuto(payload:any): BankingAuto {
  const p = payload || {};
  const startingCash = N(p.startingCash ?? p.starting_cash ?? p.startingFloat);
  const closingCash  = N(p.closingCash  ?? p.closing_cash  ?? p.endingCash ?? p.ending_cash);
  const cashSales    = N(p.cashSales    ?? p.cash_sales);
  const qrSales      = N(p.qrSales      ?? p.qr_sales);
  const shopping     = N(p.shoppingTotal ?? p.shopping_total);
  const wages        = N(p.wagesTotal    ?? p.wages_total);
  const others       = N(p.othersTotal   ?? p.others_total);
  const cashExpenses = shopping + wages + others;

  let expectedCashBank = (startingCash + cashSales) - (closingCash + cashExpenses);
  if (expectedCashBank < 0) expectedCashBank = 0;
  const expectedQRBank = qrSales;
  const expectedTotalBank = expectedCashBank + expectedQRBank;

  return {
    startingCash, closingCash, cashSales, qrSales,
    cashExpenses, expectedCashBank, expectedQRBank, expectedTotalBank
  };
}
