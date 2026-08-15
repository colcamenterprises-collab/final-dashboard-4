import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  ExactDateTimeRange,
  reportingRangeParams,
  type ExactDateTimeRangeValue,
} from "@/components/reports/ExactDateTimeRange";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";

const money = (value: unknown) =>
  `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const number = (value: unknown) => Number(value || 0).toLocaleString("en-US");
const pct = (value: number, total: number) => (total ? `${((value / total) * 100).toFixed(1)}%` : "—");

function bangkokParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    hour: Number(read("hour")),
    time: `${read("hour")}:${read("minute")}`,
  };
}

function addDays(date: string, amount: number) {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().slice(0, 10);
}

function defaultDashboardRange(): ExactDateTimeRangeValue {
  const now = bangkokParts();
  if (now.hour >= 17) {
    return { fromDate: now.date, fromTime: "17:00", toDate: now.date, toTime: now.time, timezone: "Asia/Bangkok" };
  }
  if (now.hour < 3) {
    return { fromDate: addDays(now.date, -1), fromTime: "17:00", toDate: now.date, toTime: now.time, timezone: "Asia/Bangkok" };
  }
  return { fromDate: addDays(now.date, -1), fromTime: "17:00", toDate: now.date, toTime: "03:00", timezone: "Asia/Bangkok" };
}

async function jsonFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const body = await response.json();
  if (!response.ok || body?.ok === false || body?.success === false) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body;
}

type OverviewResponse = {
  overview: {
    receiptCount: number;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    averageOrder: number;
    historicalReceipts: number;
    liveReceipts: number;
    paymentSales: Record<string, number>;
  };
  breakdowns: {
    daily: Array<{ day: string; orders: number; netSales: number }>;
    hourly: Array<{ hour: number; orders: number; netSales: number }>;
    categories: Array<{ category: string; quantity: number; netSales: number }>;
    topProducts: Array<{ itemName: string; quantity: number; netSales: number }>;
  };
};

type ProfitLossResponse = {
  year: number;
  monthlyData: Record<string, {
    sales: number;
    bankDeposits: number | null;
    cogs: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
  }>;
};

type ShiftReconciliationResponse = {
  shiftCount: number;
  pos: { receiptCount: number; totalSales: number };
  dailySales: { formCount: number; totalSales: number | null };
  rows: Array<{ key: string; label: string; pos: number; dailySales: number | null; delta: number | null; status: string }>;
  allMatched: boolean;
};

function paymentGroup(name: string) {
  const key = name.toLowerCase();
  if (key.includes("grab")) return "Grab";
  if (key.includes("scan") || key.includes("prompt") || key.includes("qr") || key.includes("transfer")) return "QR";
  if (key.includes("cash")) return "Cash";
  if (key.includes("card")) return "Card";
  return "Other";
}

function Metric({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneClass = tone === "good"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "bad"
      ? "border-red-200 bg-red-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</div>
      {sub ? <div className="mt-1 truncate text-[10px] font-medium text-slate-500">{sub}</div> : null}
    </div>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-950">
      {children}<ArrowRight className="h-3 w-3" />
    </Link>
  );
}

const paymentColors = ["#111827", "#facc15", "#64748b", "#cbd5e1", "#94a3b8"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Home() {
  const [range, setRange] = useState<ExactDateTimeRangeValue>(() => defaultDashboardRange());
  const params = useMemo(() => reportingRangeParams(range), [range]);

  const overview = useQuery<OverviewResponse>({
    queryKey: ["home-unified-overview", params],
    queryFn: () => jsonFetch(`/api/reports/receipt-analytics/unified/overview?${params}`),
    refetchInterval: 60_000,
  });
  const shift = useQuery<ShiftReconciliationResponse>({
    queryKey: ["home-shift-reconciliation", params],
    queryFn: () => jsonFetch(`/api/reports/receipt-analytics/shift-review?${params}`),
    refetchInterval: 60_000,
  });
  const finance = useQuery<ProfitLossResponse>({
    queryKey: ["home-profit-loss"],
    queryFn: () => jsonFetch("/api/profit-loss"),
    staleTime: 60_000,
  });
  const loans = useQuery<any>({
    queryKey: ["home-loan-liabilities"],
    queryFn: () => jsonFetch("/api/finance/director-beneficiary-loans/summary"),
    staleTime: 60_000,
  });
  const operations = useQuery<any>({
    queryKey: ["home-owner-dashboard"],
    queryFn: () => jsonFetch("/api/operations-read/owner-dashboard"),
    refetchInterval: 120_000,
  });

  const data = overview.data?.overview;
  const breakdowns = overview.data?.breakdowns;
  const groupedPayments = useMemo(() => {
    const grouped: Record<string, number> = { Cash: 0, QR: 0, Grab: 0, Card: 0, Other: 0 };
    for (const [name, amount] of Object.entries(data?.paymentSales || {})) grouped[paymentGroup(name)] += Number(amount || 0);
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).filter((row) => row.value > 0);
  }, [data]);

  const financeRows = months
    .filter((month) => finance.data?.monthlyData?.[month])
    .map((month) => ({ month, ...finance.data!.monthlyData[month] }));
  const latestFinance = financeRows.at(-1);
  const ytd = financeRows.reduce((acc, row) => ({
    sales: acc.sales + Number(row.sales || 0),
    expenses: acc.expenses + Number(row.expenses || 0),
    cogs: acc.cogs + Number(row.cogs || 0),
    netProfit: acc.netProfit + Number(row.netProfit || 0),
  }), { sales: 0, expenses: 0, cogs: 0, netProfit: 0 });

  const actions = operations.data?.actionRequired || [];
  const stock = operations.data?.stockStatus || {};
  const loanBalance = Number(loans.data?.data?.total_balance || 0);
  const shiftRows = shift.data?.rows || [];
  const paymentTotal = groupedPayments.reduce((sum, row) => sum + row.value, 0);
  const chartDaily = breakdowns?.daily || [];
  const chartHourly = breakdowns?.hourly || [];
  const topProducts = breakdowns?.topProducts?.slice(0, 5) || [];
  const categories = breakdowns?.categories?.slice(0, 5) || [];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Smash Brothers Burgers</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Command Centre</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExpenseLodgmentModal triggerText="Expense" triggerClassName="bg-slate-950 text-white hover:bg-slate-800" />
          <Link to="/reports/overview" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
            Full reporting <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok" />

      {overview.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">Reporting data unavailable: {(overview.error as Error).message}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Net Sales" value={overview.isLoading ? "…" : money(data?.netSales)} sub={`Gross ${money(data?.grossSales)}`} />
        <Metric label="Orders" value={overview.isLoading ? "…" : number(data?.receiptCount)} sub={`${number(data?.liveReceipts)} live POS`} />
        <Metric label="Avg Order" value={overview.isLoading ? "…" : money(data?.averageOrder)} />
        <Metric label="Discounts" value={overview.isLoading ? "…" : money(Number(data?.discounts || 0) + Number(data?.refunds || 0))} />
        <Metric label="Month Expenses" value={finance.isLoading ? "…" : money(latestFinance?.expenses)} sub={latestFinance?.month || "Current month"} />
        <Metric
          label="Month Profit"
          value={finance.isLoading ? "…" : money(latestFinance?.netProfit)}
          sub={latestFinance ? pct(latestFinance.netProfit, latestFinance.sales) : "—"}
          tone={latestFinance ? (latestFinance.netProfit >= 0 ? "good" : "bad") : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Panel title="Sales Trend" action={<MiniLink to="/reports/overview">Overview</MiniLink>} className="md:col-span-8">
          <div className="h-[220px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDaily} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#111827" stopOpacity={0.22}/><stop offset="100%" stopColor="#111827" stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip formatter={(value: any) => [money(value), "Net sales"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                <Area type="monotone" dataKey="netSales" stroke="#111827" strokeWidth={2.5} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Payments" action={<MiniLink to="/reports/receipts">Receipts</MiniLink>} className="md:col-span-4">
          <div className="grid grid-cols-[1fr_1fr] items-center gap-2">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={groupedPayments} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2}>{groupedPayments.map((_, index) => <Cell key={index} fill={paymentColors[index % paymentColors.length]} />)}</Pie><Tooltip formatter={(value: any) => money(value)} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {groupedPayments.map((row, index) => (
                <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{row.name}</span>
                  <span className="font-black text-slate-950">{pct(row.value, paymentTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Panel title="Hourly Sales" className="md:col-span-7">
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartHourly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `${String(v).padStart(2, "0")}:00`} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: any) => [money(value), "Net sales"]} labelFormatter={(v) => `${String(v).padStart(2, "0")}:00`} />
                <Bar dataKey="netSales" fill="#111827" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Top Products" action={<MiniLink to="/reports/sales-by-item">Items</MiniLink>} className="md:col-span-5">
          <div className="space-y-3">
            {topProducts.map((row, index) => {
              const max = topProducts[0]?.netSales || 1;
              return (
                <div key={`${row.itemName}-${index}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700">{row.itemName}</span><span className="shrink-0 font-black text-slate-950">{money(row.netSales)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(4, row.netSales / max * 100)}%` }} /></div>
                </div>
              );
            })}
            {!topProducts.length ? <div className="py-10 text-center text-xs text-slate-400">No product data</div> : null}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Panel title="Finance" action={<MiniLink to="/finance/profit-loss">P&L</MiniLink>} className="md:col-span-8">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="YTD Sales" value={finance.isLoading ? "…" : money(ytd.sales)} />
            <Metric label="YTD COGS" value={finance.isLoading ? "…" : money(ytd.cogs)} />
            <Metric label="YTD Expenses" value={finance.isLoading ? "…" : money(ytd.expenses)} />
            <Metric label="YTD Profit" value={finance.isLoading ? "…" : money(ytd.netProfit)} tone={ytd.netProfit >= 0 ? "good" : "bad"} />
          </div>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeRows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip formatter={(value: any, name: string) => [money(value), name]} />
                <Bar dataKey="sales" name="Sales" fill="#111827" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 md:col-span-4 md:grid-cols-1">
          <Metric label="Loan Balance" value={loans.isLoading ? "…" : money(loanBalance)} sub="Director / beneficiary" tone={loanBalance > 0 ? "warn" : "default"} />
          <Metric label="Live POS Sales" value={overview.isLoading ? "…" : money(groupedPayments.reduce((sum, row) => sum + row.value, 0))} sub={`${number(data?.liveReceipts)} live orders`} />
          <Metric label="Categories" value={number(categories.length)} sub={categories[0]?.category ? `Top: ${categories[0].category}` : "Selected range"} />
          <Metric label="Data Sources" value={data ? `${data.historicalReceipts > 0 ? "History" : ""}${data.historicalReceipts > 0 && data.liveReceipts > 0 ? " + " : ""}${data.liveReceipts > 0 ? "Live" : ""}` || "—" : "…"} sub="Unified ledger" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Panel title="Shift Reconciliation" action={<MiniLink to="/reports/shift-reconciliation">Shift report</MiniLink>} className="md:col-span-8">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Metric label="POS Sales" value={shift.isLoading ? "…" : money(shift.data?.pos?.totalSales)} sub={`${number(shift.data?.pos?.receiptCount)} orders`} />
            <Metric label="Shift Form" value={shift.isLoading ? "…" : shift.data?.dailySales?.totalSales == null ? "Missing" : money(shift.data.dailySales.totalSales)} sub={`${number(shift.data?.dailySales?.formCount)} forms`} tone={shift.data?.dailySales?.totalSales == null ? "warn" : "default"} />
            <Metric label="Status" value={shift.isLoading ? "…" : shift.data?.allMatched ? "Matched" : "Review"} sub={`${number(shift.data?.shiftCount)} POS shifts`} tone={shift.data?.allMatched ? "good" : "warn"} />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {shiftRows.map((row) => (
              <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{row.label.replace(" (฿)", "")}</div>
                <div className="mt-1 text-sm font-black text-slate-900">{money(row.pos)}</div>
                <div className={`mt-1 text-[9px] font-bold ${row.status === "match" ? "text-emerald-600" : row.status === "missing" ? "text-amber-600" : "text-red-600"}`}>{row.status === "match" ? "MATCH" : row.status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Needs Attention" className="md:col-span-4">
          <div className="space-y-2">
            {actions.slice(0, 4).map((action: any, index: number) => (
              <div key={`${action.title || action.code}-${index}`} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <div className="min-w-0"><div className="truncate text-xs font-black text-amber-900">{action.title || action.code || "Review"}</div><div className="mt-0.5 line-clamp-2 text-[10px] text-amber-700">{action.message || action.detail}</div></div>
              </div>
            ))}
            {!actions.length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-700">No urgent exceptions</div> : null}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-xl border border-slate-200 p-2.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Stock Form</div><div className="mt-1 text-sm font-black text-slate-900">{stock.dailyStockSubmitted ? "Done" : "Missing"}</div></div>
              <div className="rounded-xl border border-slate-200 p-2.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Shopping</div><div className="mt-1 text-sm font-black text-slate-900">{number(stock.shoppingCount ?? stock.requestedShopping?.length ?? 0)}</div></div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {[
          { to: "/reports/overview", label: "Reporting", icon: TrendingUp },
          { to: "/reports/sales-by-item", label: "Products", icon: ShoppingBag },
          { to: "/reports/receipts", label: "Receipts", icon: Receipt },
          { to: "/finance", label: "Finance", icon: CircleDollarSign },
          { to: "/finance/expenses", label: "Expenses", icon: WalletCards },
          { to: "/reports/shift-reconciliation", label: "Shifts", icon: Banknote },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50">
            <span className="flex items-center gap-2"><item.icon className="h-4 w-4 text-slate-400" />{item.label}</span><ArrowRight className="h-3 w-3 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
