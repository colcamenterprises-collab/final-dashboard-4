import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardList, FileText, Package, Receipt, ShoppingBag } from "lucide-react";

type StatusTone = "green" | "amber" | "red" | "neutral";

const quickActions = [
  { to: "/operations/daily-sales", label: "Daily Sales V2", icon: Receipt },
  { to: "/operations/daily-stock", label: "Daily Stock V2", icon: Package },
  { to: "/operations/daily-sales-v2/library", label: "Form Library", icon: ClipboardList },
  { to: "/reports/shift-reports", label: "Shift Reports", icon: FileText },
  { to: "/operations/loyverse-mirror", label: "Loyverse Mirror", icon: Activity },
  { to: "/operations/purchase-lodgement", label: "Purchasing", icon: ShoppingBag },
];

const thb = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? `฿${value.toLocaleString("en-TH", { maximumFractionDigits: 0 })}`
    : "Not available";

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Not available" : String(value);

const compact = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-TH") : "Not available";

function fmtDate(value: unknown) {
  if (!value || typeof value !== "string") return "Not available";
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function statusTone(status: string | null | undefined): StatusTone {
  const s = String(status || "").toUpperCase();
  if (["POS VERIFIED", "VERIFIED", "MATCH", "OK", "HEALTHY", "SUBMITTED"].includes(s)) return "green";
  if (["ACTION REQUIRED", "FAILED", "MISMATCH", "MISSING"].includes(s)) return "red";
  if (["NEEDS REVIEW", "WARNING", "PARTIAL", "NOT AVAILABLE"].includes(s)) return "amber";
  return "neutral";
}

function toneClasses(tone: StatusTone) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="flex min-h-[138px] flex-col justify-between p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div>
        <p className="truncate text-3xl font-black tracking-tight text-[#111111] md:text-4xl">{value}</p>
        {sub && <p className="mt-2 text-xs font-medium text-slate-500">{sub}</p>}
      </div>
    </Card>
  );
}

function Badge({ label }: { label: string }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${toneClasses(statusTone(label))}`}>{label}</span>;
}

function BarChart({ rows }: { rows: any[] }) {
  const max = Math.max(...rows.map((r) => Number(r.grossSales || 0)), 1);
  return (
    <div className="flex h-72 items-end gap-3 pt-8 md:h-96">
      {rows.map((r, idx) => {
        const height = Math.max(8, (Number(r.grossSales || 0) / max) * 100);
        return (
          <div key={r.date || idx} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end rounded-t-2xl bg-slate-100">
              <div className="w-full rounded-t-2xl bg-[#FFD400] shadow-[inset_0_-8px_0_rgba(17,17,17,0.08)]" style={{ height: `${height}%` }} title={thb(r.grossSales)} />
            </div>
            <p className="w-full truncate text-center text-[10px] font-bold text-slate-500">{String(r.date || "").slice(5)}</p>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ split }: { split: any[] }) {
  const total = split.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  let cursor = 0;
  const colors = ["#FFD400", "#111111", "#f59e0b", "#94a3b8"];
  const gradient = total > 0 ? split.map((p, i) => {
    const start = cursor;
    const end = cursor + ((Number(p.amount) || 0) / total) * 100;
    cursor = end;
    return `${colors[i % colors.length]} ${start}% ${end}%`;
  }).join(", ") : "#e2e8f0 0% 100%";
  return <div className="mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="relative left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" /></div>;
}

function LineTrend({ rows }: { rows: any[] }) {
  const max = Math.max(...rows.map((r) => Number(r.grossSales || 0)), 1);
  const points = rows.map((r, i) => `${(i / Math.max(rows.length - 1, 1)) * 100},${100 - (Number(r.grossSales || 0) / max) * 86}`).join(" ");
  return <svg className="h-44 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="#FFD400" strokeWidth="4" points={points} /><polyline fill="none" stroke="#111111" strokeWidth="1.5" points={rows.map((r, i) => `${(i / Math.max(rows.length - 1, 1)) * 100},${95 - Math.min(Number(r.receipts || 0), 100)}`).join(" ")} /></svg>;
}

export default function Home() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/dashboard-home"] });
  const latest = data?.data?.latestShift ?? {};
  const verification = data?.data?.verification ?? {};
  const paymentSplit = Array.isArray(data?.data?.paymentSplit) ? data.data.paymentSplit : [];
  const trend = Array.isArray(data?.data?.last7Shifts) ? [...data.data.last7Shifts].reverse() : [];
  const actions = Array.isArray(data?.data?.actions) ? data.data.actions : [];
  const stock = data?.data?.stock ?? {};
  const status = data?.status || (data?.ok ? "POS Verified" : "Action Required");

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden text-slate-900">
      <div className="rounded-[2rem] bg-[#111111] p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Operations Overview</h1>
            <p className="mt-2 text-sm font-medium text-slate-300">Latest completed shift: {fmtDate(latest.date)} · 18:00–03:00 Asia/Bangkok</p>
          </div>
          <Badge label={status} />
        </div>
      </div>

      {(isLoading || isError) && <Card className="p-5 text-sm font-semibold text-slate-500">{isLoading ? "Loading latest completed shift…" : "Could not load dashboard data."}</Card>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gross Sales" value={thb(latest.grossSales)} sub="Latest completed shift" />
        <KpiCard label="Receipts" value={compact(latest.receipts)} sub="Shift-level POS receipts" />
        <KpiCard label="Cash Variance" value={thb(verification.cashVariance)} sub="Expected/staff vs POS cash" />
        <KpiCard label="Verification" value={<Badge label={verification.overall || "Not available"} />} sub="Latest shift checks" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Last 7 Shifts Gross Sales</h2><span className="text-xs font-bold text-slate-400">THB</span></div>
          <BarChart rows={trend} />
        </Card>
        <Card className="p-5 md:p-6">
          <h2 className="text-xl font-black">Action Required</h2>
          <div className="mt-4 space-y-3">
            {actions.map((a: any, i: number) => <div key={i} className={`rounded-2xl border p-4 ${toneClasses(statusTone(a.status))}`}><p className="text-sm font-black">{a.label}</p><p className="mt-1 text-xs font-semibold opacity-75">{a.message}</p></div>)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><h3 className="font-black">Receipt Verification</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>POS Receipts</dt><dd className="font-black">{compact(verification.posReceipts)}</dd></div><div className="flex justify-between"><dt>Staff Receipts</dt><dd className="font-black">{compact(verification.staffReceipts)}</dd></div><div className="flex justify-between"><dt>Status</dt><dd><Badge label={verification.receiptStatus || "Not available"} /></dd></div></dl></Card>
        <Card className="p-5"><h3 className="font-black">Sales Verification</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>POS Gross Sales</dt><dd className="font-black">{thb(verification.posGrossSales)}</dd></div><div className="flex justify-between"><dt>Staff Gross Sales</dt><dd className="font-black">{thb(verification.staffGrossSales)}</dd></div><div className="flex justify-between"><dt>Status</dt><dd><Badge label={verification.salesStatus || "Not available"} /></dd></div></dl></Card>
        <Card className="p-5"><h3 className="font-black">Payment Breakdown</h3><div className="mt-4 space-y-2">{paymentSplit.map((p: any) => <div key={p.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold">{p.label}</span><span className="text-right font-black">{thb(p.amount)}<br /><span className="text-[10px] text-slate-400">{compact(p.count)} receipts</span></span></div>)}</div></Card>
        <Card className="p-5"><h3 className="font-black">Stock Verification</h3><dl className="mt-4 space-y-2 text-sm">{[["Rolls", stock.rolls], ["Meat", stock.meat], ["Drinks", stock.drinks], ["Fries", stock.fries], ["Purchases This Shift", stock.purchasesThisShift]].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt>{k}</dt><dd className="font-black">{shown(v)}</dd></div>)}<div className="flex justify-between"><dt>Status</dt><dd><Badge label={stock.status || "Not available"} /></dd></div></dl></Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5 md:p-6"><h2 className="text-xl font-black">Sales Mix</h2><div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]"><Donut split={paymentSplit} /><div className="space-y-2 self-center">{paymentSplit.map((p: any) => <div key={p.label} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold">{p.label}</span><span className="font-black">{thb(p.amount)}</span></div>)}</div></div></Card>
        <Card className="p-5 md:p-6"><h2 className="text-xl font-black">7 Day Trend</h2><div className="mt-8"><LineTrend rows={trend} /></div><div className="mt-4 flex gap-4 text-xs font-bold"><span className="text-[#FFD400]">Gross sales</span><span className="text-[#111111]">Receipts</span></div></Card>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {quickActions.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-black text-[#111111] shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFD400]"><Icon className="h-5 w-5 text-[#FFD400]" /><span>{label}</span></Link>)}
        </div>
      </div>
    </div>
  );
}
