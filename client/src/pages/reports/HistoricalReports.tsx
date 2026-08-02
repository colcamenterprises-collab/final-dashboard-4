import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { AlertTriangle, ReceiptText } from "lucide-react";

type ShiftMonth = {
  month:string;
  shifts:number;
  startingCash:number;
  cashPayments:number;
  cashRefunds:number;
  paidIn:number;
  paidOut:number;
  expected:number;
  actual:number;
  difference:number;
};

type ShiftRow = {
  number:number;
  store:string;
  pos:string;
  opened:string;
  openedRaw:string;
  openedBy:string;
  closed:string;
  closedRaw:string;
  closedBy:string;
  reportDate:string;
  startingCash:number;
  cash:number;
  cashRefunds:number;
  paidIn:number;
  paidOut:number;
  expected:number;
  actual:number;
  difference:number;
};

type Data = {
  source: string;
  period: { from: string; to: string; timezone: string };
  shiftSource?: string;
  shiftPeriod?: { from: string; to: string; timezone: string };
  reconciliation: { difference: number; warning: string };
  totals: Record<string, number>;
  paymentTypes: Array<{name:string;transactions:number;gross:number;refundTransactions:number;refunds:number;net:number}>;
  discounts: Array<{name:string;applied:number;amount:number}>;
  topModifiers: Array<{group:string;option:string;sold:number;refunded:number;gross:number;refunds:number;net:number}>;
  shiftMonths: ShiftMonth[];
  recentShifts: ShiftRow[];
  completeness: {modifierRows:number;shiftRows:number;missingShiftNumbers:number[];shiftNumberRange?:{from:number;to:number}};
};

const money = (value: number) => new Intl.NumberFormat("en-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-TH").format(value);
const compactNumber = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const compactMoney = (value: number) => `฿${compactNumber(value)}`;
const periodDate = (value:string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"Asia/Bangkok" });

function Card({ label, value, detail }: { label:string; value:string; detail?:string }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-900 md:text-[28px]">{value}</p>
    {detail && <p className="mt-1 text-xs text-slate-500 md:text-sm">{detail}</p>}
  </div>;
}

function MonthCard({ label, month }: { label:string; month?:ShiftMonth }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <h2 className="mt-1 text-xl font-black text-slate-900">{month?.month || "No imported data"}</h2>
      </div>
      {month && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{number(month.shifts)} shifts</span>}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cash payments</p><p className="mt-1 text-lg font-black text-slate-900">{month ? compactMoney(month.cashPayments) : "—"}</p></div>
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Paid out</p><p className="mt-1 text-lg font-black text-slate-900">{month ? compactMoney(month.paidOut) : "—"}</p></div>
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cash refunds</p><p className="mt-1 text-base font-bold text-slate-700">{month ? compactMoney(month.cashRefunds) : "—"}</p></div>
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Difference</p><p className={`mt-1 text-base font-bold ${month && Math.abs(month.difference) > 0.01 ? "text-red-600" : "text-emerald-700"}`}>{month ? money(month.difference) : "—"}</p></div>
    </div>
  </div>;
}

function Table({ headers, rows, minWidth = "760px" }: { headers:string[]; rows: React.ReactNode[][]; minWidth?:string }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full table-auto text-sm" style={{minWidth}}>
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>{headers.map((h,j)=><th key={h} className={`whitespace-nowrap px-4 py-3 font-bold ${j>0?"text-right":"text-left"}`}>{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r,i)=><tr key={i} className="hover:bg-slate-50/70">{r.map((c,j)=><td key={j} className={`whitespace-nowrap px-4 py-3 align-middle tabular-nums ${j>0?"text-right":"text-left font-medium"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

const monthKey = (date: Date) => date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

export default function HistoricalReports() {
  const location = useLocation();
  const { data, isLoading, error } = useQuery<Data>({ queryKey:["historical-loyverse-reporting"], queryFn: async()=>{
    const response = await fetch("/api/reports/historical-loyverse", { credentials:"include" });
    if (!response.ok) throw new Error((await response.json().catch(()=>null))?.error || "Unable to load historical reports");
    return response.json();
  }});

  if (isLoading) return <div className="p-8 text-slate-500">Loading historical reporting…</div>;
  if (error || !data) return <div className="m-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{(error as Error)?.message || "No historical data available"}</div>;

  const mode = location.pathname.includes("payment-types") ? "payments" : location.pathname.includes("sales-by-item") ? "items" : "shifts";
  const title = mode==="payments" ? "Sales by Payment Type" : mode==="items" ? "Sales by Item" : "Shift Summary";
  const activePeriod = mode === "shifts" && data.shiftPeriod ? data.shiftPeriod : data.period;
  const activeSource = mode === "shifts" && data.shiftSource ? data.shiftSource : data.source;

  const now = new Date();
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonth = data.shiftMonths.find(x => x.month === monthKey(now));
  const previousMonth = data.shiftMonths.find(x => x.month === monthKey(previousMonthDate));

  return <div className="space-y-5 p-4 md:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 md:text-base">{activeSource} · {periodDate(activePeriod.from)}–{periodDate(activePeriod.to)} · {activePeriod.timezone}</p>
      </div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{mode === "shifts" ? `${number(data.completeness.shiftRows)} shifts imported` : "Historical snapshot"}</span>
    </div>

    {mode==="payments" && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Net payments" value={compactMoney(data.totals.netPayments)} detail={money(data.totals.netPayments)}/>
        <Card label="Transactions" value={compactNumber(data.totals.paymentTransactions)}/>
        <Card label="Refunds" value={compactMoney(data.totals.refunds)} detail={number(data.totals.refundTransactions)+" transactions"}/>
        <Card label="Discounts" value={compactMoney(data.totals.discounts)} detail={number(data.totals.discountsApplied)+" applications"}/>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4"/>{data.reconciliation.warning}</div>
      <Table headers={["Payment type","Transactions","Gross payments","Refund transactions","Refunds","Net amount"]} rows={data.paymentTypes.map(x=>[x.name,number(x.transactions),money(x.gross),number(x.refundTransactions),money(x.refunds),<b>{money(x.net)}</b>])}/>
      <h2 className="text-xl font-black text-slate-900">Discounts</h2>
      <Table headers={["Discount","Times applied","Amount discounted"]} rows={data.discounts.map(x=>[x.name,number(x.applied),money(x.amount)])}/>
    </>}

    {mode==="items" && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Modifier rows imported" value={compactNumber(data.completeness.modifierRows)}/>
        <Card label="Modifier quantity" value={compactNumber(data.totals.modifierQuantity)} detail={number(data.totals.modifierQuantity)}/>
        <Card label="Modifier net sales" value={compactMoney(data.totals.modifierNetSales)} detail={money(data.totals.modifierNetSales)}/>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><ReceiptText className="mr-2 inline h-4 w-4"/>This export contains modifiers and upsells. Standard menu-item sales will be added when the Loyverse item-sales export or complete receipt lines are supplied.</div>
      <Table headers={["Modifier group","Option","Qty sold","Qty refunded","Gross sales","Refunds","Net sales"]} rows={data.topModifiers.map(x=>[x.group,x.option,number(x.sold),number(x.refunded),money(x.gross),money(x.refunds),<b>{money(x.net)}</b>])}/>
    </>}

    {mode==="shifts" && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthCard label="Last month" month={previousMonth}/>
        <MonthCard label="Current month" month={currentMonth}/>
      </div>

      {data.completeness.missingShiftNumbers.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Loyverse shift number gap: {data.completeness.missingShiftNumbers.join(", ")}. These numbers are not present in the supplied CSV; no replacement figures have been invented.
      </div>}

      <h2 className="text-xl font-black text-slate-900">Monthly cash reconciliation</h2>
      <Table minWidth="1280px" headers={["Month","Shifts","Starting cash","Cash payments","Cash refunds","Paid in","Paid out","Expected cash","Actual cash","Difference"]} rows={data.shiftMonths.map(x=>[
        x.month,
        number(x.shifts),
        money(x.startingCash),
        money(x.cashPayments),
        money(x.cashRefunds),
        money(x.paidIn),
        money(x.paidOut),
        money(x.expected),
        money(x.actual),
        <span className={Math.abs(x.difference)>0.01?"font-bold text-red-600":"text-emerald-700"}>{money(x.difference)}</span>
      ])}/>

      <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
        <div>
          <h2 className="text-xl font-black text-slate-900">All imported shifts</h2>
          <p className="mt-1 text-sm text-slate-500">Every row from the supplied Loyverse shift export, newest first.</p>
        </div>
        {data.completeness.shiftNumberRange && <span className="text-xs font-semibold text-slate-500">Shift #{data.completeness.shiftNumberRange.from}–#{data.completeness.shiftNumberRange.to}</span>}
      </div>
      <Table minWidth="1700px" headers={["Shift","Opened","Closed","Starting cash","Cash payments","Cash refunds","Paid in","Paid out","Expected cash","Actual cash","Difference"]} rows={data.recentShifts.map(x=>[
        `#${x.number}`,
        x.opened,
        x.closed,
        money(x.startingCash),
        money(x.cash),
        money(x.cashRefunds),
        money(x.paidIn),
        money(x.paidOut),
        money(x.expected),
        money(x.actual),
        <span className={Math.abs(x.difference)>0.01?"font-bold text-red-600":"font-bold text-emerald-700"}>{money(x.difference)}</span>
      ])}/>
    </>}
  </div>;
}
