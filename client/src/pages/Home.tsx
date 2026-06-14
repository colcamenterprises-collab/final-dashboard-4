import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  AlertTriangle, CheckCircle, ArrowRight, Receipt, Package,
  ShoppingBag, FileText, Activity, TrendingUp, AlertCircle,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return "฿" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtShortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()} ${hrs}:${min}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, badge,
}: {
  label: string; value: React.ReactNode; sub?: string; accent: string; badge?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 space-y-1 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">{label}</p>
        {badge}
      </div>
      <p className="text-2xl font-black tracking-tight leading-none">{value}</p>
      {sub && <p className="text-[10px] opacity-50 pt-0.5">{sub}</p>}
    </div>
  );
}

function VerifyCard({
  label, status, detail,
}: { label: string; status: "ok" | "warn" | "missing" | "unknown"; detail?: string }) {
  const colours = {
    ok:      "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn:    "border-amber-200 bg-amber-50 text-amber-900",
    missing: "border-red-200 bg-red-50 text-red-900",
    unknown: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const Icon = status === "ok" ? CheckCircle : status === "warn" ? AlertTriangle : status === "missing" ? AlertCircle : AlertCircle;
  const iconColour = {
    ok: "text-emerald-500", warn: "text-amber-500", missing: "text-red-500", unknown: "text-slate-400",
  };
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${colours[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColour[status]}`} />
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">{label}</p>
      </div>
      <p className="text-sm font-bold leading-tight">
        {status === "ok" ? "Verified" : status === "warn" ? "Needs attention" : status === "missing" ? "Missing" : "Not available"}
      </p>
      {detail && <p className="text-[10px] opacity-60 leading-snug">{detail}</p>}
    </div>
  );
}

function ActionBadge({ severity, title, message }: { severity: string; title: string; message: string }) {
  const isHigh = severity === "high";
  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-0.5 ${isHigh ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center gap-1.5">
        <AlertTriangle className={`h-3 w-3 shrink-0 ${isHigh ? "text-red-500" : "text-amber-500"}`} />
        <p className={`text-xs font-bold ${isHigh ? "text-red-900" : "text-amber-900"}`}>{title}</p>
      </div>
      <p className={`text-[10px] pl-4.5 ${isHigh ? "text-red-700" : "text-amber-700"}`}>{message}</p>
    </div>
  );
}

const quickActions = [
  { to: "/operations/daily-sales",        label: "Daily Sales",        icon: Receipt,     colour: "bg-blue-50 text-blue-800 border-blue-100" },
  { to: "/operations/daily-stock",        label: "Daily Stock",        icon: Package,     colour: "bg-emerald-50 text-emerald-800 border-emerald-100" },
  { to: "/operations/purchase-lodgement", label: "Purchases",          icon: ShoppingBag, colour: "bg-amber-50 text-amber-800 border-amber-100" },
  { to: "/reports/shift-reports",         label: "Shift Reports",      icon: FileText,    colour: "bg-purple-50 text-purple-800 border-purple-100" },
  { to: "/operations/loyverse-mirror",    label: "POS Verification",   icon: Activity,    colour: "bg-slate-50 text-slate-800 border-slate-200" },
  { to: "/finance/expenses-import",       label: "Expenses",           icon: TrendingUp,  colour: "bg-rose-50 text-rose-800 border-rose-100" },
];

const PIE_COLORS = { Cash: "#10b981", QR: "#3b82f6", Grab: "#f97316", Other: "#94a3b8" };

const CHART_TOOLTIP_STYLE = {
  contentStyle: { borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  itemStyle: { color: "#1e293b" },
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/operations-read/owner-dashboard"],
    refetchInterval: 120_000,
  });

  const shift    = data?.latestShift     ?? null;
  const staff    = data?.staffComparison ?? {};
  const stock    = data?.stockStatus     ?? {};
  const actions  = data?.actionRequired  ?? [];
  const seven    = data?.lastSevenShifts ?? [];
  const mix      = data?.salesMix        ?? {};
  const health   = data?.syncHealth      ?? {};

  const highCount = actions.filter((a: any) => a.severity === "high").length;

  const chartData = [...seven].reverse().map((s: any) => ({
    date: fmtShortDate(s.date),
    grossSales: s.grossSales,
    receipts: s.receipts,
    cash: s.cash,
    qr: s.qr,
    grab: s.grab,
  }));

  const trendData = chartData;

  const pieData = Object.entries(mix)
    .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: Number(v ?? 0) }))
    .filter(d => d.value > 0);

  const receiptVerifyStatus: "ok" | "warn" | "missing" | "unknown" =
    staff.receiptDifference === null ? "unknown" :
    staff.receiptDifference === 0   ? "ok"      :
    Math.abs(staff.receiptDifference) <= 2 ? "warn" : "warn";

  const salesVerifyStatus: "ok" | "warn" | "missing" | "unknown" =
    staff.salesDifference === null   ? "unknown" :
    !staff.staffSalesEntered         ? "missing" :
    staff.staffGrossSales === 0      ? "warn"    :
    Math.abs(staff.salesDifference) < 50 ? "ok" : "warn";

  const stockVerifyStatus: "ok" | "warn" | "missing" | "unknown" =
    stock.dailyStockSubmitted ? "ok" : "missing";

  const cashVarianceStatus: "ok" | "warn" | "missing" | "unknown" =
    staff.cashVariance === null          ? "unknown" :
    Math.abs(staff.cashVariance) <= 1    ? "ok"      :
    Math.abs(staff.cashVariance) <= 200  ? "warn"    : "missing";

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-1">Loading…</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-bold text-red-800">Failed to load dashboard</p>
          <p className="text-xs text-red-600 mt-1">Check your connection and refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Latest completed shift:{" "}
            <span className="font-semibold text-slate-600">{fmtDate(shift?.date)}</span>
            <span className="ml-2">· 18:00–03:00 Asia/Bangkok</span>
          </p>
        </div>
        {highCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {highCount} action{highCount > 1 ? "s" : ""} required
          </span>
        )}
        {highCount === 0 && shift && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            All clear
          </span>
        )}
      </div>

      {/* ── 4 KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Gross Sales"
          value={fmtMoney(shift?.grossSales)}
          sub={`${shift?.receiptCount ?? "—"} receipts`}
          accent="border-purple-200 bg-purple-50 text-purple-900"
        />
        <KpiCard
          label="Receipts"
          value={shift?.receiptCount ?? "—"}
          sub={`POS · ${fmtDate(shift?.date)}`}
          accent="border-blue-200 bg-blue-50 text-blue-900"
        />
        <KpiCard
          label="Cash Variance"
          value={staff.cashVariance != null ? fmtMoney(Math.abs(staff.cashVariance)) : "—"}
          sub={staff.cashVariance === null ? "No form data" : Math.abs(staff.cashVariance) <= 1 ? "Balanced" : "Difference detected"}
          accent={
            cashVarianceStatus === "ok"      ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
            cashVarianceStatus === "warn"    ? "border-amber-200 bg-amber-50 text-amber-900" :
            cashVarianceStatus === "missing" ? "border-red-200 bg-red-50 text-red-900" :
            "border-slate-200 bg-slate-50 text-slate-700"
          }
        />
        <KpiCard
          label="Sync Status"
          value={health.status === "ok" ? "Healthy" : health.status === "warning" ? "Warning" : "—"}
          sub={health.latestReceiptAt ? `Latest receipt: ${fmtDateTime(health.latestReceiptAt)}` : "No receipts yet"}
          accent={
            health.status === "ok"      ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
            health.status === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" :
            "border-slate-200 bg-slate-50 text-slate-700"
          }
        />
      </div>

      {/* ── Main chart row (70/30) ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-5">

        {/* Bar chart — 70% */}
        <div className="col-span-1 md:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Last 7 Shifts — Gross Sales
          </p>
          {chartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              No shift data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`}
                  width={48}
                />
                <Tooltip
                  {...CHART_TOOLTIP_STYLE}
                  formatter={(v: any, name: string) => {
                    const labels: Record<string, string> = { grossSales: "Gross Sales", cash: "Cash", qr: "QR", grab: "Grab" };
                    return [fmtMoney(v), labels[name] ?? name];
                  }}
                />
                <Bar dataKey="grossSales" fill="#8b5cf6" radius={[4,4,0,0]} name="Gross Sales" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Payment breakdown mini-bars */}
          {shift && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
              {[
                { label: "Cash",  value: shift.cash,  colour: "bg-emerald-400" },
                { label: "QR",    value: shift.qr,    colour: "bg-blue-400" },
                { label: "Grab",  value: shift.grab,  colour: "bg-orange-400" },
              ].map(({ label, value, colour }) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">{label}</span>
                    <span className="text-[10px] font-bold text-slate-700">{fmtMoney(value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colour}`}
                      style={{ width: shift.grossSales > 0 ? `${Math.round((value / shift.grossSales) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action required — 30% */}
        <div className="col-span-1 md:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Action Required
          </p>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-700">All clear</p>
              <p className="text-[10px] text-slate-400">No actions required</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((a: any, i: number) => (
                <ActionBadge key={i} severity={a.severity} title={a.title} message={a.message} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Verification row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <VerifyCard
          label="Receipt Verification"
          status={receiptVerifyStatus}
          detail={
            staff.receiptDifference === null
              ? "No staff form data"
              : staff.receiptDifference === 0
              ? `POS & staff agree: ${shift?.receiptCount ?? "—"} receipts`
              : `POS ${shift?.receiptCount ?? "—"} · Staff ${staff.staffReceiptCount ?? "—"}`
          }
        />
        <VerifyCard
          label="Sales Verification"
          status={salesVerifyStatus}
          detail={
            staff.staffGrossSales === null
              ? "No staff sales data"
              : staff.staffGrossSales === 0
              ? "Staff entered ฿0 — check form"
              : `POS ${fmtMoney(shift?.grossSales)} · Staff ${fmtMoney(staff.staffGrossSales)}`
          }
        />
        <VerifyCard
          label="Payment Breakdown"
          status={shift ? "ok" : "unknown"}
          detail={shift ? `Cash ${fmtMoney(shift.cash)} · QR ${fmtMoney(shift.qr)} · Grab ${fmtMoney(shift.grab)}` : "No POS data"}
        />
        <VerifyCard
          label="Stock Verification"
          status={stockVerifyStatus}
          detail={
            stock.dailyStockSubmitted
              ? `Rolls: ${stock.rollsStatus} · Meat: ${stock.meatStatus}`
              : "Stock count not submitted"
          }
        />
      </div>

      {/* ── Secondary charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-5">

        {/* Sales mix donut */}
        <div className="col-span-1 md:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Sales Mix
          </p>
          {pieData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400">No data</div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <PieChart width={140} height={140}>
                <Pie
                  data={pieData}
                  cx={65}
                  cy={65}
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => fmtMoney(v)}
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px" }}
                />
              </PieChart>
              <div className="w-full space-y-1">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[d.name as keyof typeof PIE_COLORS] ?? "#94a3b8" }}
                      />
                      <span className="text-slate-600 font-medium">{d.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{fmtMoney(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 7-day trend */}
        <div className="col-span-1 md:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            7-Day Trend — Gross Sales
          </p>
          {trendData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  width={36}
                />
                <Tooltip
                  {...CHART_TOOLTIP_STYLE}
                  formatter={(v: any, name: string) => {
                    if (name === "grossSales") return [fmtMoney(v), "Gross Sales"];
                    return [v, "Receipts"];
                  }}
                />
                <Bar dataKey="grossSales" fill="#6366f1" radius={[3,3,0,0]} name="grossSales" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Receipts mini row */}
          {trendData.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-100">
              {trendData.map((d: any) => (
                <div key={d.date} className="flex flex-col items-center min-w-0 flex-1">
                  <span className="text-[9px] text-slate-400">{d.date}</span>
                  <span className="text-[10px] font-bold text-slate-700">{d.receipts}</span>
                  <span className="text-[8px] text-slate-400">rcpts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {quickActions.map(({ to, label, icon: Icon, colour }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-[10px] font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 ${colour}`}
            >
              <Icon className="h-4 w-4" />
              <span className="leading-tight">{label}</span>
              <ArrowRight className="h-2.5 w-2.5 opacity-40" />
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
