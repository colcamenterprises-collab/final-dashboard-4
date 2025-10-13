import { z } from "zod";

const Num = (v:any) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g,""));
  return Number.isFinite(n) ? n : 0;
};

export type SummaryPick = {
  totalSales: number;
  cashSales: number;
  qrSales: number;
  grabSales: number;
  otherSales: number;        // payments: "Other (Sales)"
  shoppingTotal: number;     // expenses
  wagesTotal: number;
  othersTotal: number;
  totalExpenses: number;
  rollsEnd: number;
  meatEnd: number;
};

export function extractSummary(payload:any): SummaryPick {
  const p = payload || {};

  // tolerate legacy/typos/case
  const get = (keys:string[], fallback=0) => {
    for (const k of keys) if (p[k] !== undefined) return Num(p[k]);
    return fallback;
  };

  const totalSales    = get(["totalSales","total_sales"], 0);
  const cashSales     = get(["cashSales","cash_sales"], 0);
  const qrSales       = get(["qrSales","qr_sales"], 0);
  const grabSales     = get(["grabSales","grab_sales"], 0);
  const otherSales    = get(["otherSales","aroiSales","other_sales"], 0);

  const shoppingTotal = get(["shoppingTotal","shopping_total"], 0);
  const wagesTotal    = get(["wagesTotal","wages_total"], 0);
  const othersTotal   = get(["othersTotal","other_expenses","others_total"], 0);

  // prefer provided total; else recompute
  const totalExpenses = get(["totalExpenses","total_expenses"], shoppingTotal + wagesTotal + othersTotal);

  const rollsEnd      = Math.max(0, Math.trunc(get(["rollsEnd","buns","burgerBuns","rolls_end"], 0)));
  const meatEnd       = Math.max(0, Math.trunc(get(["meatEnd","meatWeightG","meat_end_g"], 0)));

  return { totalSales, cashSales, qrSales, grabSales, otherSales,
           shoppingTotal, wagesTotal, othersTotal, totalExpenses,
           rollsEnd, meatEnd };
}
