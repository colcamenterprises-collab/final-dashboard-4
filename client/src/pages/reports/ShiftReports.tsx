import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type VerificationStatus = "VERIFIED" | "ISSUE" | "MISSING_FORM" | "MISSING_STOCK";
type FilterValue = "ALL" | "VERIFIED" | "ISSUES" | "MISSING_FORM";

interface VerificationCheck { label: string; status: "MATCH" | "DIFFERENCE" | "NOT_AVAILABLE"; message: string; }
interface ShiftReport {
  id: string; shiftDate: string;
  pos: { grossSales: number | null; cash: number | null; qr: number | null; grab: number | null; receipts: number | null };
  staff: { grossSales: number | null; cash: number | null; qr: number | null; grab: number | null; receipts: number | null };
  differences: { grossSales: number | null; receipts: number | null; cash: number | null };
  status: VerificationStatus; issueExplanation: string; issueSummary: string | null; severity: "Low" | "Medium" | "High" | null;
  hasDailySalesV2: boolean; hasDailyStockV2: boolean; verification: VerificationCheck[];
}
interface HistoryResponse { reports: ShiftReport[]; blockers?: { code: string; message: string }[]; }

function formatDate(d?: string) { if (!d) return "Not Available"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }
function formatIssueDate(d?: string) { if (!d) return "Not Available"; const dt = new Date(`${d}T00:00:00Z`); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); }
function money(n: number | null | undefined) { if (n == null) return "Not Available"; return `฿${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function count(n: number | null | undefined) { return n == null ? "Not Available" : Number(n).toLocaleString("en-US"); }
function signedMoney(n: number | null | undefined) { if (n == null) return "Not Available"; if (n === 0) return "฿0"; return `${n > 0 ? "+" : "-"}฿${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function signedCount(n: number | null | undefined) { if (n == null) return "Not Available"; if (n === 0) return "0"; return `${n > 0 ? "+" : ""}${n}`; }

function StatusBadge({ status }: { status: VerificationStatus }) {
  const styles = {
    VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ISSUE: "bg-red-100 text-red-800 border-red-200",
    MISSING_FORM: "bg-amber-100 text-amber-800 border-amber-200",
    MISSING_STOCK: "bg-orange-100 text-orange-800 border-orange-200",
  }[status];
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${styles}`}>{status.replace("_", " ")}</span>;
}

export default function ShiftReports() {
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError } = useQuery<HistoryResponse>({ queryKey: ["/api/shift-report/history"] });
  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];
  const filtered = useMemo(() => reports.filter((r) => filter === "ALL" || (filter === "ISSUES" ? r.status === "ISSUE" || r.status === "MISSING_STOCK" : r.status === filter)), [reports, filter]);
  const openIssues = reports.filter((r) => r.status !== "VERIFIED");
  const kpis = [
    ["Verified Shifts", reports.filter((r) => r.status === "VERIFIED").length],
    ["Shifts With Issues", reports.filter((r) => r.status === "ISSUE").length],
    ["Missing Forms", reports.filter((r) => r.status === "MISSING_FORM").length],
    ["Open Issues", openIssues.length],
  ];

  return <div className="space-y-5 max-w-7xl mx-auto">
    <PageTitle title="Shift Verification" meta="Latest 30 shifts" />
    <div className="flex flex-wrap gap-2">{[["ALL","All"],["VERIFIED","Verified"],["ISSUES","Issues"],["MISSING_FORM","Missing Form"]].map(([value, label]) => <button key={value} onClick={() => setFilter(value as FilterValue)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{label}</button>)}</div>
    {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading shift verification…</div>}
    {isError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="h-4 w-4" />Shift verification data unavailable. Check server connection.</div>}
    {!isLoading && !isError && blockers.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Data unavailable</div>{blockers.map((b) => <p key={b.code}>{b.message}</p>)}</div>}
    {!isLoading && !isError && reports.length === 0 && blockers.length === 0 && <div className="flex flex-col items-center py-16 gap-3 text-slate-400"><Calendar className="h-10 w-10 opacity-30" /><p className="text-sm">No shift data found yet.</p></div>}
    {reports.length > 0 && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kpis.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs min-w-[1040px]"><thead><tr className="border-b border-slate-100 bg-slate-50">{["Date","POS Gross","Staff Gross","Difference","POS Receipts","Staff Receipts","Difference","Cash Difference","Status","Action"].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">{h}</th>)}</tr></thead><tbody>{filtered.map((r, idx) => <Fragment key={r.id}>
        <tr key={r.id} onClick={() => setOpenRows(o => ({...o, [r.id]: !o[r.id]}))} className={`border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}><td className="px-4 py-2.5 font-semibold text-slate-800">{formatDate(r.shiftDate)}</td><td className="px-4 py-2.5">{money(r.pos.grossSales)}</td><td className="px-4 py-2.5">{money(r.staff.grossSales)}</td><td className="px-4 py-2.5 font-semibold">{signedMoney(r.differences.grossSales)}</td><td className="px-4 py-2.5">{count(r.pos.receipts)}</td><td className="px-4 py-2.5">{count(r.staff.receipts)}</td><td className="px-4 py-2.5 font-semibold">{signedCount(r.differences.receipts)}</td><td className="px-4 py-2.5 font-semibold">{signedMoney(r.differences.cash)}</td><td className="px-4 py-2.5"><StatusBadge status={r.status} /></td><td className="px-4 py-2.5 text-slate-600"><span className="inline-flex items-center gap-1">{openRows[r.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Details</span></td></tr>
        {openRows[r.id] && <tr key={`${r.id}-details`} className="border-b border-slate-100 bg-slate-50"><td colSpan={10} className="px-4 py-4"><div className="grid gap-4 md:grid-cols-4"><Detail title="POS" rows={[["Gross Sales", money(r.pos.grossSales)],["Cash", money(r.pos.cash)],["QR", money(r.pos.qr)],["Grab", money(r.pos.grab)],["Receipts", count(r.pos.receipts)]]} /><Detail title="Staff" rows={[["Gross Sales", money(r.staff.grossSales)],["Cash", money(r.staff.cash)],["QR", money(r.staff.qr)],["Grab", money(r.staff.grab)],["Receipts", count(r.staff.receipts)]]} /><div><h3 className="font-bold text-slate-800 mb-2">Verification</h3>{r.verification.map(v => <p key={v.label} className="text-sm text-slate-700"><span className="font-semibold">{v.label}</span>: {v.message}</p>)}</div><div><h3 className="font-bold text-slate-800 mb-2">Issue Explanation</h3><p className="text-sm text-slate-700">{r.issueExplanation}</p></div></div></td></tr>}
      </Fragment>)}</tbody></table></div></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Open Issues</h2>{openIssues.length === 0 ? <p className="mt-3 text-sm text-slate-500">No open issues.</p> : <div className="mt-3 divide-y divide-slate-100">{openIssues.map(i => <div key={i.id} className="py-3 grid gap-1 md:grid-cols-4 text-sm"><p className="font-semibold text-slate-800">{formatIssueDate(i.shiftDate)}</p><p><span className="text-slate-500">Severity:</span> {i.severity ?? "Medium"}</p><p><span className="text-slate-500">Issue:</span> {i.issueSummary ?? i.issueExplanation}</p><p><span className="text-slate-500">Status:</span> Open</p></div>)}</div>}</section>
    </>}
  </div>;
}
function Detail({ title, rows }: { title: string; rows: string[][] }) { return <div><h3 className="font-bold text-slate-800 mb-2">{title}</h3>{rows.map(([k,v]) => <p key={k} className="flex justify-between gap-4 text-sm"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-800">{v}</span></p>)}</div>; }
