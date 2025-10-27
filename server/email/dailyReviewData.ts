import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLLS_THRESHOLD = 5;
const MEAT_THRESHOLD_G = 500;

function dayRange(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function loadStaffForm(dateISO: string) {
  const { start, end } = dayRange(dateISO);
  
  const row = await prisma.dailySalesV2.findFirst({
    where: { 
      shift_date: { gte: start, lt: end },
      deletedAt: null,
    },
    include: {
      stock: true,
    },
  });

  if (!row) {
    return {
      totalSales: null,
      bankedCash: null,
      bankedQR: null,
      closingCash: null,
      balanced: null as boolean | null,
      itemisedSales: [] as Array<{ name: string; qty: number; total: number }>,
      itemisedExpenses: [] as Array<{ name: string; total: number }>,
      rollsRecorded: null as number | null,
      meatRecordedGrams: null as number | null,
    };
  }

  const payload = row.payload as any;
  
  const cash = payload?.cashSales ?? row.cashSales ?? 0;
  const qr = payload?.qrSales ?? row.qrSales ?? 0;
  const grab = payload?.grabSales ?? row.grabSales ?? 0;
  const other = payload?.otherSales ?? row.aroiSales ?? 0;
  const total = payload?.totalSales ?? row.totalSales ?? (cash + qr + grab + other);

  const expensesArray = (payload?.expenses || []) as Array<{label: string; cost: number}>;
  const shopping = expensesArray.reduce((sum, exp) => sum + (exp.cost || 0), 0);
  
  const wagesArray = (payload?.wages || []) as Array<{name: string; amount: number}>;
  const wages = wagesArray.reduce((sum, w) => sum + (w.amount || 0), 0);

  const startingCash = payload?.startingCash ?? row.startingCash ?? 0;
  const endingCash = payload?.endingCash ?? row.endingCash ?? 0;
  const cashBanked = payload?.cashBanked ?? row.cashBanked ?? 0;
  
  const expensesTotal = shopping + wages;
  const expectedCash = startingCash + cash - expensesTotal;
  const balanced = Math.abs(endingCash - expectedCash) <= 30;

  const itemisedSales: Array<{ name: string; qty: number; total: number }> = [
    { name: "Cash", qty: 0, total: cash },
    { name: "QR/Promptpay", qty: 0, total: qr },
    { name: "Grab", qty: 0, total: grab },
    { name: "Other", qty: 0, total: other },
  ];

  const itemisedExpenses: Array<{ name: string; total: number }> = [
    { name: "Shopping", total: shopping },
    { name: "Wages", total: wages },
  ];

  const rollsRecorded = row.stock?.burgerBuns ?? null;
  const meatRecordedGrams = row.stock?.meatWeightG ?? null;

  return {
    totalSales: total,
    bankedCash: cashBanked,
    bankedQR: qr,
    closingCash: endingCash,
    balanced,
    itemisedSales,
    itemisedExpenses,
    rollsRecorded,
    meatRecordedGrams,
  };
}

export async function loadPosShift(dateISO: string) {
  const { start, end } = dayRange(dateISO);
  
  const row = await prisma.posShiftReport.findFirst({
    where: { businessDate: { gte: start, lt: end } },
  });

  if (!row) {
    return {
      totalSales: null,
      expensesTotal: null,
      expectedCash: null,
      actualCash: null,
      balanced: null as boolean | null,
      itemisedSales: [] as Array<{ name: string; qty: number; total: number }>,
      itemisedExpenses: [] as Array<{ name: string; total: number }>,
      expectedRolls: null as number | null,
      expectedMeatGrams: null as number | null,
    };
  }

  const cash = Number(row.cashTotal ?? 0);
  const qr = Number(row.qrTotal ?? 0);
  const grab = Number(row.grabTotal ?? 0);
  const other = Number(row.otherTotal ?? 0);
  const total = Number(row.grandTotal ?? (cash + qr + grab + other));

  const shopping = Number(row.shoppingTotal ?? 0);
  const wages = Number(row.wagesTotal ?? 0);
  const otherExp = Number(row.otherExpense ?? 0);
  const expensesTotal = shopping + wages + otherExp;

  const startingCash = Number(row.startingCash ?? 0);
  const expectedCash = startingCash + cash - expensesTotal;
  const actualCash = Number(row.cashInDrawer ?? 0);
  const balanced = Math.abs(actualCash - expectedCash) <= 30;

  const itemisedSales: Array<{ name: string; qty: number; total: number }> = [
    { name: "Cash", qty: 0, total: cash },
    { name: "QR/Promptpay", qty: 0, total: qr },
    { name: "Grab", qty: 0, total: grab },
    { name: "Other", qty: 0, total: other },
  ];

  const itemisedExpenses: Array<{ name: string; total: number }> = [
    { name: "Shopping", total: shopping },
    { name: "Wages", total: wages },
  ];
  if (otherExp) itemisedExpenses.push({ name: "Other", total: otherExp });

  return {
    totalSales: total,
    expensesTotal,
    expectedCash,
    actualCash,
    balanced,
    itemisedSales,
    itemisedExpenses,
    expectedRolls: null,
    expectedMeatGrams: null,
  };
}

export async function loadDailyReview(dateISO: string) {
  return {
    anomalies: [] as Array<{ title: string; detail?: string }>,
    managerNotes: null as string | null,
  };
}

export async function loadFinance(dateISO: string) {
  const tz = "Asia/Bangkok";
  const d = parseISO(`${dateISO}`);
  const yyyyMM = formatInTimeZone(d, tz, "yyyy-MM");
  const monthStartISO = `${yyyyMM}-01`;

  const monthStart = new Date(`${monthStartISO}T00:00:00.000Z`);
  const dayEnd = new Date(dateISO);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { start: todayStart, end: todayEnd } = dayRange(dateISO);

  const businessExpensesMTDResult = await prisma.$queryRaw<Array<{total: bigint}>>`
    SELECT COALESCE(SUM(amount_cents), 0) as total 
    FROM expenses 
    WHERE date >= ${monthStartISO}::date
    AND date < ${dateISO}::date + INTERVAL '1 day'
    AND source = 'DIRECT'
  `;
  const businessExpensesMTD = Number(businessExpensesMTDResult[0]?.total ?? 0);

  const businessExpensesTodayResult = await prisma.$queryRaw<Array<{total: bigint}>>`
    SELECT COALESCE(SUM(amount_cents), 0) as total 
    FROM expenses 
    WHERE date = ${dateISO}::date
    AND source = 'DIRECT'
  `;
  const businessExpensesToday = Number(businessExpensesTodayResult[0]?.total ?? 0);

  const shiftForms = await prisma.dailySalesV2.findMany({
    where: {
      shift_date: { gte: monthStart, lt: dayEnd },
      deletedAt: null,
    },
  });

  let shiftExpensesMTD = 0;
  let shiftExpensesToday = 0;

  for (const form of shiftForms) {
    const payload = form.payload as any;
    const expensesArray = (payload?.expenses || []) as Array<{cost: number}>;
    const wagesArray = (payload?.wages || []) as Array<{amount: number}>;
    
    const shopping = expensesArray.reduce((sum, exp) => sum + (exp.cost || 0), 0);
    const wages = wagesArray.reduce((sum, w) => sum + (w.amount || 0), 0);
    const formTotal = shopping + wages;

    shiftExpensesMTD += formTotal;

    const formDate = form.shift_date;
    if (formDate && formDate >= todayStart && formDate < todayEnd) {
      shiftExpensesToday += formTotal;
    }
  }

  const fbExpensesMTDResult = await prisma.$queryRaw<Array<{total: bigint}>>`
    SELECT COALESCE(SUM(amount_cents), 0) as total 
    FROM expenses 
    WHERE date >= ${monthStartISO}::date
    AND date < ${dateISO}::date + INTERVAL '1 day'
    AND (category ILIKE '%Food%' OR category ILIKE '%Beverage%' OR category ILIKE '%Ingredients%')
  `;
  const fbExpensesMTD = Number(fbExpensesMTDResult[0]?.total ?? 0);

  const salesForms = await prisma.dailySalesV2.findMany({
    where: {
      shift_date: { gte: monthStart, lt: dayEnd },
      deletedAt: null,
    },
  });

  const salesIncomeMTD = salesForms.reduce((sum, form) => {
    return sum + (form.totalSales ?? 0);
  }, 0);

  return {
    businessExpensesMTD,
    shiftExpensesMTD,
    businessExpensesToday,
    shiftExpensesToday,
    fbExpensesMTD,
    salesIncomeMTD,
  };
}

const chart = new ChartJSNodeCanvas({ width: 560, height: 240, backgroundColour: "#11141A" });

export async function buildFBvsSalesChart(data: { fb: number; sales: number }) {
  const configuration = {
    type: "bar" as const,
    data: {
      labels: ["F&B Expenses", "Sales Income"],
      datasets: [
        {
          label: "Amount (฿)",
          data: [data.fb, data.sales],
          backgroundColor: ["#10B981", "#3B82F6"],
        },
      ],
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false }, title: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#C7CFD9" } },
        y: { grid: { color: "#1F2430" }, ticks: { color: "#C7CFD9" } },
      },
    },
  };
  const png = await chart.renderToBuffer(configuration as any);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function rollsStatus(expected: number | null, recorded: number | null) {
  if (expected == null || recorded == null) return { variance: null, status: "INSUFFICIENT_DATA" as const };
  const variance = recorded - expected;
  const status = Math.abs(variance) > ROLLS_THRESHOLD ? ("FLAG" as const) : ("OK" as const);
  return { variance, status };
}

export function meatStatus(expectedG: number | null, recordedG: number | null) {
  if (expectedG == null || recordedG == null) return { varianceG: null, status: "INSUFFICIENT_DATA" as const };
  const varianceG = recordedG - expectedG;
  const status = Math.abs(varianceG) > MEAT_THRESHOLD_G ? ("FLAG" as const) : ("OK" as const);
  return { varianceG, status };
}
