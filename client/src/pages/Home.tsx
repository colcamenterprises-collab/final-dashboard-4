import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ArrowUpRight, Banknote, CreditCard, Receipt, ShoppingBag, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { DateTime } from "luxon";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";

const money = (value: number | null | undefined) => `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const compactMoney = (value: number) => value >= 1000 ? `฿${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `฿${value}`;
const pct = (value: number, total: number) => total ? `${((value / total) * 100).toFixed(1)}%` : "—";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

type HourRow = { bucketStart: string; orders: number; netSales: number };
type CategoryRow = { category: string; quantity: number; netSales: number };
type ProductRow = { itemName: string; quantity: number; netSales: number };
type OverviewResponse = {
  ok: boolean;
  source: string;
  filters: ExactDateTimeRangeValue & { fromInstant: string; toInstant: string };
  sourcesIncluded: string[];
  overview: { receiptCount: number; grossSales: number; discounts: number; refunds: number; netSales: number; averageOrder: number; historicalReceipts: number; liveReceipts: number; paymentSales: Record<string, number> };
  labor: { laborCost: number; paidStaffCount: number; laborCostPct: number | null; source: string };
  breakdowns: { daily: Array<{ day: string; orders: number; netSales: number }>; hourly: HourRow[]; categories: CategoryRow[]; topProducts: ProductRow[] };
};
type ProfitLossResponse = { year: number; monthlyData: Record<string, { sales: number; bankDeposits: number | null; cogs: number; expenses: number; grossProfit: number; netProfit: number }> };
type ShiftResponse = { shiftCount: number; pos: { receiptCount: number; totalSales: number }; dailySales: { formCount: number; totalSales: number | null }; rows: Array<{ key: string; label: string; pos: number; dailySales: number | null; delta: number | null; status: string }>; allMatched: boolean };

async function jsonFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const body = await response.json();
  if (!response.ok || body?.ok === false || body?.success === false) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
}

const cardTones = {
  blue: "from-blue-500 to-indigo-600 text-white",
  amber: "from-amber-300 to-orange-400 text-slate-950",
  mint: "from-emerald-300 to-teal-400 text-slate-950",
  violet: "from-violet-400 to-fuchsia-500 text-white",
  light: "from-white to-slate-100 text-slate-950",
};

function MetricCard({ label, value, sub, tone = "light", icon: Icon }: { label: string; value: string; sub: string; tone?: keyof typeof cardTones; icon: any }) {
  return <article className={`relative min-h-40 overflow-hidden rounded-[28px] bg-gradient-to-br p-5 shadow-[0_18px_50px_rgba(0,0,0,.24)] ${cardTones[tone]}`}>
    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
    <div className="relative flex items-start justify-between"><p className="text-xs font-black uppercase tracking-[.18em] opacity-70">{label}</p><span className="rounded-full bg-black/10 p-2.5"><Icon className="h-4 w-4" /></span></div>
    <p className="relative mt-7 text-3xl font-black tracking-tight">{value}</p><p className="relative mt-2 text-xs font-semibold opacity-65">{sub}</p>
  </article>;
}

function Panel({ title, subtitle, children, className = "", action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)] ${className}`}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">{title}</h2>{subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}</div>{action}</div>
    <div className="mt-5">{children}</div>
  </section>;
}

function HorizontalBar({ label, value, max, meta, color }: { label: string; value: number; max: number; meta: string; color: string }) {
  const width = max > 0 ? Math.max(3, Math.min(100, value / max * 100)) : 0;
  return <div className="space-y-2"><div className="flex justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700">{label}</span><span className="shrink-0 text-slate-500">{meta}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
}

function paymentGroup(name: string) {
  const key = name.toLowerCase();
  if (key.includes("grab")) return "Grab";
  if (key.includes("scan") || key.includes("prompt") || key.includes("qr") || key.includes("transfer")) return "QR";
  if (key.includes("cash")) return "Cash";
  if (key.includes("card")) return "Card";
  return "Other";
}
const paymentStyle: Record<string, { icon: any; color: string }> = {
  Cash: { icon: Banknote, color: "bg-emerald-400" }, QR: { icon: WalletCards, color: "bg-blue-400" }, Grab: { icon: ShoppingBag, color: "bg-lime-300" }, Card: { icon: CreditCard, color: "bg-violet-400" }, Other: { icon: Sparkles, color: "bg-orange-300" },
};

function buildHourlySeries(rows: HourRow[], range: OverviewResponse["filters"]) {
  const totals = new Map(rows.map(row => [DateTime.fromISO(row.bucketStart).toUTC().startOf("hour").toISO(), row]));
  const start = DateTime.fromISO(range.fromInstant).toUTC().startOf("hour");
  const end = DateTime.fromISO(range.toInstant).toUTC().startOf("hour");
  const result = []; let cursor = start;
  while (cursor <= end) {
    const key = cursor.toISO(); const row = totals.get(key);
    result.push({ bucketStart: key, label: cursor.setZone(range.timezone).toFormat("ha").toLowerCase(), sales: row?.netSales || 0, orders: row?.orders || 0 });
    cursor = cursor.plus({ hours: 1 });
  }
  return result;
}

function SmallStat({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${good === true ? "border-emerald-200 bg-emerald-50" : good === false ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p>{sub ? <p className="mt-1 text-[11px] text-slate-500">{sub}</p> : null}</div>;
}

export default function Home() {
  const [range, setRange] = useState<ExactDateTimeRangeValue>({ fromDate: localDate(-1), fromTime: "17:00", toDate: localDate(), toTime: "03:00", timezone: "Asia/Bangkok" });
  const params = useMemo(() => reportingRangeParams(range), [range]);
  const overview = useQuery<OverviewResponse>({ queryKey: ["home-overview", params], queryFn: () => jsonFetch(`/api/reports/receipt-analytics/unified/overview?${params}`), refetchInterval: 60_000 });
  const finance = useQuery<ProfitLossResponse>({ queryKey: ["home-finance"], queryFn: () => jsonFetch("/api/profit-loss"), staleTime: 60_000 });
  const shift = useQuery<ShiftResponse>({ queryKey: ["home-shift", params], queryFn: () => jsonFetch(`/api/reports/receipt-analytics/shift-review?${params}`), refetchInterval: 60_000 });
  const loans = useQuery<any>({ queryKey: ["home-loans"], queryFn: () => jsonFetch("/api/finance/director-beneficiary-loans/summary"), staleTime: 60_000 });
  const operations = useQuery<any>({ queryKey: ["home-ops"], queryFn: () => jsonFetch("/api/operations-read/owner-dashboard"), refetchInterval: 120_000 });

  const data = overview.data?.overview;
  const labor = overview.data?.labor;
  const breakdowns = overview.data?.breakdowns;
  const hourly = useMemo(() => overview.data ? buildHourlySeries(overview.data.breakdowns.hourly, overview.data.filters) : [], [overview.data]);
  const paymentGroups = useMemo(() => { const grouped: Record<string, number> = { Cash: 0, QR: 0, Grab: 0, Card: 0, Other: 0 }; for (const [name, amount] of Object.entries(data?.paymentSales || {})) grouped[paymentGroup(name)] += Number(amount || 0); return grouped; }, [data]);
  const categoryMax = Math.max(0, ...(breakdowns?.categories || []).map(row => row.netSales));
  const productMax = Math.max(0, ...(breakdowns?.topProducts || []).map(row => row.netSales));
  const financeRows = months.filter(m => finance.data?.monthlyData?.[m]).map(m => ({ month: m, ...finance.data!.monthlyData[m] }));
  const ytd = financeRows.reduce((acc, row) => ({ sales: acc.sales + row.sales, cogs: acc.cogs + row.cogs, expenses: acc.expenses + row.expenses, grossProfit: acc.grossProfit + row.grossProfit, netProfit: acc.netProfit + row.netProfit }), { sales: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 });
  const latestFinance = financeRows.at(-1);
  const loanBalance = Number(loans.data?.data?.total_balance || 0);
  const actions = operations.data?.actionRequired || [];
  const stock = operations.data?.stockStatus || {};

  return <div className="min-h-screen rounded-[32px] bg-slate-50 p-4 text-slate-950 md:p-6">
    <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.25em] text-blue-600">Restaurant intelligence</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Command Centre</h1><p className="mt-2 text-sm text-slate-500">Sales, finance and operations from one trusted dashboard.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-sm"><ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok" /></div><div className="flex gap-2"><ExpenseLodgmentModal triggerText="Expense" triggerClassName="bg-slate-950 text-white hover:bg-slate-800" /><Link to="/reports/overview" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm">Full reporting <ArrowRight className="h-3.5 w-3.5" /></Link></div></div>
    </header>

    {overview.isLoading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500">Loading dashboard…</div> : null}
    {overview.isError ? <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{(overview.error as Error).message}</div> : null}

    {data ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Gross sales" value={money(data.grossSales)} sub="Before discounts and refunds" tone="blue" icon={ArrowUpRight} />
        <MetricCard label="Net sales" value={money(data.netSales)} sub={`${money(data.discounts + data.refunds)} adjustments`} tone="light" icon={Banknote} />
        <MetricCard label="Orders" value={data.receiptCount.toLocaleString()} sub={`${data.historicalReceipts} historical · ${data.liveReceipts} live`} tone="amber" icon={Receipt} />
        <MetricCard label="Average order" value={money(data.averageOrder)} sub="Net sales per paid receipt" tone="mint" icon={ShoppingBag} />
        <MetricCard label="Labor cost" value={labor?.laborCostPct == null ? "—" : `${labor.laborCostPct.toFixed(1)}%`} sub={`${money(labor?.laborCost || 0)} · ${labor?.paidStaffCount || 0} paid staff`} tone="violet" icon={UsersRound} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Panel title="Hourly Sales" subtitle={`One bar per trading hour · ${range.fromTime} opening to ${range.toTime} closing`}>
          <ResponsiveContainer width="100%" height={300}><BarChart data={hourly} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}><defs><linearGradient id="homeHourly" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#4f46e5" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} width={50} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={compactMoney} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16 }} formatter={(value: number, _name: string, entry: any) => [`${money(value)} · ${entry.payload.orders} orders`, "Sales"]} /><Bar dataKey="sales" fill="url(#homeHourly)" radius={[10, 10, 3, 3]} maxBarSize={58} /></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Payment Mix" subtitle="Net sales by payment channel">
          <div className="space-y-3">{Object.entries(paymentGroups).map(([label, amount]) => { const Style = paymentStyle[label]; const Icon = Style.icon; const share = data.netSales > 0 ? amount / data.netSales * 100 : 0; return <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span className={`rounded-xl p-2 ${Style.color}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex justify-between text-xs"><span className="font-bold text-slate-700">{label}</span><span className="font-black">{money(amount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${Style.color}`} style={{ width: `${Math.max(share ? 3 : 0, share)}%` }} /></div></div><span className="w-10 text-right text-[10px] font-bold text-slate-500">{share.toFixed(0)}%</span></div>; })}</div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Category Mix" subtitle="What guests spent on" action={<Link to="/reports/items" className="text-[10px] font-black uppercase text-slate-500">Items →</Link>}><div className="space-y-4">{(breakdowns?.categories || []).slice(0, 6).map((row, index) => <HorizontalBar key={row.category} label={row.category} value={row.netSales} max={categoryMax} meta={`${money(row.netSales)} · ${row.quantity.toLocaleString()} sold`} color={["bg-blue-400", "bg-orange-300", "bg-emerald-300", "bg-violet-400"][index % 4]} />)}</div></Panel>
        <Panel title="Top Products" subtitle="Ranked by net sales" action={<Link to="/reports/items" className="text-[10px] font-black uppercase text-slate-500">Items →</Link>}><div className="space-y-4">{(breakdowns?.topProducts || []).slice(0, 6).map((row, index) => <HorizontalBar key={row.itemName} label={`${index + 1}. ${row.itemName}`} value={row.netSales} max={productMax} meta={`${money(row.netSales)} · ${row.quantity.toLocaleString()} sold`} color="bg-gradient-to-r from-blue-500 to-indigo-500" />)}</div></Panel>
      </div>
    </> : null}

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Panel title="Finance" subtitle={`${finance.data?.year || ""} year to date`} action={<Link to="/finance/profit-loss" className="text-[10px] font-black uppercase text-slate-500">P&L →</Link>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><SmallStat label="YTD Sales" value={money(ytd.sales)} /><SmallStat label="YTD COGS" value={money(ytd.cogs)} /><SmallStat label="YTD Expenses" value={money(ytd.expenses)} /><SmallStat label="YTD Profit" value={money(ytd.netProfit)} good={ytd.netProfit >= 0} /></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><SmallStat label="Current Month Profit" value={money(latestFinance?.netProfit)} sub={latestFinance?.month || "Current month"} good={(latestFinance?.netProfit || 0) >= 0} /><SmallStat label="Loan Balance" value={money(loanBalance)} sub="Director / beneficiary" /></div>
      </Panel>
      <Panel title="Shift Reconciliation" subtitle="POS against shift form" action={<Link to="/reports/shift-reconciliation" className="text-[10px] font-black uppercase text-slate-500">Shift report →</Link>}>
        <div className="grid grid-cols-3 gap-3"><SmallStat label="POS Sales" value={money(shift.data?.pos?.totalSales)} sub={`${shift.data?.pos?.receiptCount || 0} orders`} /><SmallStat label="Shift Form" value={shift.data?.dailySales?.formCount ? money(shift.data.dailySales.totalSales) : "Missing"} sub={`${shift.data?.dailySales?.formCount || 0} forms`} good={Boolean(shift.data?.dailySales?.formCount)} /><SmallStat label="Status" value={shift.data?.allMatched ? "Matched" : "Review"} sub={`${shift.data?.shiftCount || 0} POS shifts`} good={shift.data?.allMatched} /></div>
      </Panel>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Panel title="Needs Attention" subtitle="Only exceptions that need owner action"><div className="grid gap-3 sm:grid-cols-2">{actions.length ? actions.slice(0, 6).map((action: any, index: number) => <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-900">{action.title || action.message || "Needs review"}</p><p className="mt-1 text-[11px] text-amber-700">{action.message || action.detail || "Open the related section for details."}</p></div>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800">No urgent exceptions</div>}</div></Panel>
      <Panel title="Operations" subtitle="Current forms and stock status"><div className="grid grid-cols-2 gap-3"><SmallStat label="Stock Form" value={stock.dailyStockSubmitted ? "Verified" : "Missing"} good={Boolean(stock.dailyStockSubmitted)} /><SmallStat label="Shopping" value={`${stock.requestedShopping?.length || 0}`} sub="Requested items" /><SmallStat label="Rolls" value={stock.rolls != null ? String(stock.rolls) : "—"} /><SmallStat label="Meat" value={stock.meat != null ? String(stock.meat) : "—"} /></div></Panel>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[["Reporting", "/reports/overview"], ["Products", "/reports/items"], ["Receipts", "/reports/receipts"], ["Finance", "/finance"], ["Expenses", "/finance/expenses"], ["Shifts", "/reports/shift-reconciliation"]].map(([label, to]) => <Link key={label} to={to} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm">{label}<ArrowRight className="h-3.5 w-3.5 text-slate-400" /></Link>)}</div>
  </div>;
}
