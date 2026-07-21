import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CreditCard, History, Puzzle, ReceiptText } from "lucide-react";

type Data = {
  source: string;
  period: { from: string; to: string; timezone: string };
  reconciliation: { difference: number; warning: string };
  totals: Record<string, number>;
  paymentTypes: Array<{name:string;transactions:number;gross:number;refundTransactions:number;refunds:number;net:number}>;
  discounts: Array<{name:string;applied:number;amount:number}>;
  topModifiers: Array<{group:string;option:string;sold:number;refunded:number;gross:number;refunds:number;net:number}>;
  shiftMonths: Array<{month:string;shifts:number;cashPayments:number;cashRefunds:number;paidIn:number;paidOut:number;difference:number}>;
  recentShifts: Array<{number:number;opened:string;closed:string;cash:number;paidOut:number;expected:number;actual:number;difference:number}>;
  completeness: {modifierRows:number;shiftRows:number;missingShiftNumbers:number[]};
};

const money = (value: number) => new Intl.NumberFormat("en-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-TH").format(value);

function Card({ label, value, detail }: { label:string; value:string; detail?:string }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-900">{value}</p>{detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}</div>;
}

function Table({ headers, rows }: { headers:string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map((r,i)=><tr key={i} className="hover:bg-slate-50">{r.map((c,j)=><td key={j} className={"px-4 py-3 "+(j>0?"text-right":"font-medium")}>{c}</td>)}</tr>)}</tbody></table></div>;
}

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
  const icon = mode==="payments" ? <CreditCard/> : mode==="items" ? <Puzzle/> : <History/>;

  return <div className="space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="flex items-center gap-3 text-slate-900">{icon}<h1 className="text-3xl font-black">{title}</h1></div><p className="mt-2 text-slate-500">{data.source} · 1 Jan–21 Jul 2026 · Asia/Bangkok</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Historical snapshot</span>
    </div>

    {mode==="payments" && <>
      <div className="grid gap-4 md:grid-cols-4"><Card label="Net payments" value={money(data.totals.netPayments)}/><Card label="Transactions" value={number(data.totals.paymentTransactions)}/><Card label="Refunds" value={money(data.totals.refunds)} detail={number(data.totals.refundTransactions)+" transactions"}/><Card label="Discounts" value={money(data.totals.discounts)} detail={number(data.totals.discountsApplied)+" applications"}/></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4"/>{data.reconciliation.warning}</div>
      <Table headers={["Payment type","Transactions","Gross payments","Refund transactions","Refunds","Net amount"]} rows={data.paymentTypes.map(x=>[x.name,number(x.transactions),money(x.gross),number(x.refundTransactions),money(x.refunds),<b>{money(x.net)}</b>])}/>
      <h2 className="text-xl font-black">Discounts</h2>
      <Table headers={["Discount","Times applied","Amount discounted"]} rows={data.discounts.map(x=>[x.name,number(x.applied),money(x.amount)])}/>
    </>}

    {mode==="items" && <>
      <div className="grid gap-4 md:grid-cols-3"><Card label="Modifier rows imported" value={number(data.completeness.modifierRows)}/><Card label="Modifier quantity" value={number(data.totals.modifierQuantity)}/><Card label="Modifier net sales" value={money(data.totals.modifierNetSales)}/></div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><ReceiptText className="mr-2 inline h-4 w-4"/>This export contains modifiers and upsells. Standard menu-item sales will be added when the Loyverse item-sales export or complete receipt lines are supplied.</div>
      <Table headers={["Modifier group","Option","Qty sold","Qty refunded","Gross sales","Refunds","Net sales"]} rows={data.topModifiers.map(x=>[x.group,x.option,number(x.sold),number(x.refunded),money(x.gross),money(x.refunds),<b>{money(x.net)}</b>])}/>
    </>}

    {mode==="shifts" && <>
      <div className="grid gap-4 md:grid-cols-4"><Card label="Shifts imported" value={number(data.totals.shifts)}/><Card label="Cash payments" value={money(data.shiftMonths.reduce((s,x)=>s+x.cashPayments,0))}/><Card label="Paid out" value={money(data.shiftMonths.reduce((s,x)=>s+x.paidOut,0))}/><Card label="Missing shift numbers" value={data.completeness.missingShiftNumbers.join(", ")}/></div>
      <h2 className="text-xl font-black">Monthly cash reconciliation</h2>
      <Table headers={["Month","Shifts","Cash payments","Cash refunds","Paid in","Paid out","Difference"]} rows={data.shiftMonths.map(x=>[x.month,number(x.shifts),money(x.cashPayments),money(x.cashRefunds),money(x.paidIn),money(x.paidOut),<span className={Math.abs(x.difference)>0.01?"font-bold text-red-600":"text-emerald-700"}>{money(x.difference)}</span>])}/>
      <h2 className="text-xl font-black">Latest imported shifts</h2>
      <Table headers={["Shift","Opened","Closed","Cash payments","Paid out","Expected","Actual","Difference"]} rows={data.recentShifts.map(x=>["#"+x.number,x.opened,x.closed,money(x.cash),money(x.paidOut),money(x.expected),money(x.actual),<span className={Math.abs(x.difference)>0.01?"font-bold text-red-600":"font-bold text-emerald-700"}>{money(x.difference)}</span>])}/>
    </>}
  </div>;
}
