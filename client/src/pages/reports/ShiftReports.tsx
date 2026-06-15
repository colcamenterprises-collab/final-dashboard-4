import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type CompareStatus = "MATCH" | "DIFFERENCE" | "NOT_AVAILABLE";
type PosStatus = "VERIFIED" | "ISSUE" | "MISSING_RECEIPTS" | "MISSING_SHIFT_REPORT";
type StaffStatus = "VERIFIED" | "ISSUE" | "MISSING_FORM";
type OverallStatus = "VERIFIED" | "POS ISSUE" | "STAFF ISSUE" | "MISSING FORM";
type FilterValue = "ALL" | "VERIFIED" | "POS ISSUE" | "STAFF ISSUE" | "MISSING FORM";

type MoneyBlock = { grossSales: number | null; netSales?: number | null; cash: number | null; qr: number | null; grab: number | null; other: number | null; receiptCount: number | null };
type Comparison = { receiptsValue?: number | null; shiftReportValue: number | null; dailySalesV2Value?: number | null; difference: number | null; status: CompareStatus };
type Issue = { shiftDate: string; issueType: "POS Issue" | "Staff Issue" | "Missing Form"; severity: "Low" | "Medium" | "High"; explanation: string; status: "Open" };
interface ShiftReport { id: string; shiftDate: string; receipts: MoneyBlock; shiftReport: Required<MoneyBlock>; dailySalesV2: Omit<MoneyBlock, "netSales">; posIntegrityStatus: PosStatus; staffVerificationStatus: StaffStatus; overallStatus: OverallStatus; comparisons: { posIntegrity: Record<string, Comparison>; staffVerification: Record<string, Comparison> }; issueExplanation: string; issues: Issue[]; }
interface HistoryResponse { reports: ShiftReport[]; blockers?: { code: string; message: string }[]; }

const fields = ["grossSales", "netSales", "cash", "qr", "grab", "other", "receiptCount"] as const;
const staffFields = ["grossSales", "cash", "qr", "grab", "other", "receiptCount"] as const;
const labels: Record<string, string> = { grossSales: "Gross Sales", netSales: "Net Sales", cash: "Cash", qr: "QR", grab: "Grab", other: "Other", receiptCount: "Receipt Count" };

function formatDate(d?: string) { if (!d) return "Not Available"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }
function formatIssueDate(d?: string) { if (!d) return "Not Available"; const dt = new Date(`${d}T00:00:00Z`); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); }
function money(n: number | null | undefined) { if (n == null) return "Not Available"; return `฿${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function count(n: number | null | undefined) { return n == null ? "Not Available" : Number(n).toLocaleString("en-US"); }
function value(field: string, n: number | null | undefined) { return field === "receiptCount" ? count(n) : money(n); }
function diffText(field: string, n: number | null | undefined) { if (n == null) return "Not Available"; if (n === 0) return field === "receiptCount" ? "0 receipts" : "฿0"; const prefix = n > 0 ? "+" : "-"; return field === "receiptCount" ? `${prefix}${Math.abs(n)} receipts` : `${prefix}฿${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function statusMark(status: CompareStatus) { if (status === "MATCH") return "✓"; if (status === "DIFFERENCE") return "✕"; return "Not Available"; }

function StatusBadge({ status }: { status: OverallStatus }) {
  const styles = status === "VERIFIED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : status === "MISSING FORM" ? "bg-amber-100 text-amber-800 border-amber-200" : status === "STAFF ISSUE" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-red-100 text-red-800 border-red-200";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${styles}`}>{status}</span>;
}

function SourceBlock({ title, data, includeNet = false }: { title: string; data: MoneyBlock | Omit<MoneyBlock, "netSales">; includeNet?: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3 min-w-[180px]"><h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</h3><dl className="mt-2 space-y-1 text-xs">
    <Line label="Gross Sales" value={money(data.grossSales)} />
    {includeNet && <Line label="Net Sales" value={money((data as MoneyBlock).netSales)} />}
    <Line label="Cash" value={money(data.cash)} /><Line label="QR" value={money(data.qr)} /><Line label="Grab" value={money(data.grab)} /><Line label="Other" value={money(data.other)} /><Line label="Receipt Count" value={count(data.receiptCount)} />
  </dl></div>;
}
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value}</dd></div>; }
function Relation({ title, comparison, missing }: { title: string; comparison: Comparison; missing?: boolean }) {
  if (missing) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{title}<br />Warning: Missing Form</div>;
  const isMatch = comparison.status === "MATCH";
  return <div className={`rounded-lg border p-3 text-xs font-semibold ${isMatch ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{title}<br />{isMatch ? "✓ Match" : `✕ Difference ${diffText("grossSales", comparison.difference)}`}</div>;
}

export default function ShiftReports() {
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError } = useQuery<HistoryResponse>({ queryKey: ["/api/shift-report/history"] });
  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];
  const filtered = useMemo(() => reports.filter((r) => filter === "ALL" || r.overallStatus === filter), [reports, filter]);
  const openIssues = reports.flatMap((r) => r.issues ?? []);
  const kpis = [["POS Verified", reports.filter((r) => r.posIntegrityStatus === "VERIFIED").length], ["POS Issues", reports.filter((r) => r.posIntegrityStatus !== "VERIFIED").length], ["Staff Issues", reports.filter((r) => r.staffVerificationStatus === "ISSUE").length], ["Missing Forms", reports.filter((r) => r.staffVerificationStatus === "MISSING_FORM").length]];

  return <div className="space-y-5 max-w-7xl mx-auto">
    <PageTitle title="Shift Verification" meta="Receipts → Shift Report → Daily Sales V2" />
    <div className="flex flex-wrap gap-2">{[["ALL","All"],["VERIFIED","Verified"],["POS ISSUE","POS Issues"],["STAFF ISSUE","Staff Issues"],["MISSING FORM","Missing Forms"]].map(([v, label]) => <button key={v} onClick={() => setFilter(v as FilterValue)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{label}</button>)}</div>
    {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading shift verification.</div>}
    {isError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="h-4 w-4" />Shift verification data unavailable. Check server connection.</div>}
    {!isLoading && !isError && blockers.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Data unavailable</div>{blockers.map((b) => <p key={b.code}>{b.message}</p>)}</div>}
    {!isLoading && !isError && reports.length === 0 && blockers.length === 0 && <div className="flex flex-col items-center py-16 gap-3 text-slate-400"><Calendar className="h-10 w-10 opacity-30" /><p className="text-sm">No shift data found yet.</p></div>}
    {reports.length > 0 && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kpis.map(([label, v]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{v}</p></div>)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs min-w-[1220px]"><thead><tr className="border-b border-slate-100 bg-slate-50">{["Date","Receipts","Shift Report","Daily Sales V2","Status","Action"].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">{h}</th>)}</tr></thead><tbody>{filtered.map((r, idx) => <Fragment key={r.id}>
        <tr onClick={() => setOpenRows(o => ({ ...o, [r.id]: !o[r.id] }))} className={`border-b border-slate-100 align-top hover:bg-blue-50/30 cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}><td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{formatDate(r.shiftDate)}</td><td className="px-4 py-3"><SourceBlock title="Receipts" data={r.receipts} /></td><td className="px-4 py-3"><div className="space-y-2"><Relation title="Receipts → Shift Report" comparison={r.comparisons.posIntegrity.grossSales} /><SourceBlock title="Shift Report" data={r.shiftReport} includeNet /></div></td><td className="px-4 py-3"><div className="space-y-2"><Relation title="Shift Report → Daily Sales V2" comparison={r.comparisons.staffVerification.grossSales} missing={r.staffVerificationStatus === "MISSING_FORM"} /><SourceBlock title="Daily Sales V2" data={r.dailySalesV2} /></div></td><td className="px-4 py-3"><div className="space-y-1"><StatusBadge status={r.overallStatus} /><p className="text-[11px] text-slate-500">POS: {r.posIntegrityStatus}</p><p className="text-[11px] text-slate-500">Staff: {r.staffVerificationStatus}</p></div></td><td className="px-4 py-3 text-slate-600 whitespace-nowrap"><span className="inline-flex items-center gap-1">{openRows[r.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}View Details</span></td></tr>
        {openRows[r.id] && <tr className="border-b border-slate-100 bg-slate-50"><td colSpan={6} className="px-4 py-4"><div className="grid gap-4 lg:grid-cols-3"><ComparisonTable title="POS Integrity" subtitle="Receipts vs Shift Report" fields={fields} leftTitle="Receipts" rightTitle="Shift Report" comparisons={r.comparisons.posIntegrity} /><ComparisonTable title="Staff Verification" subtitle="Shift Report vs Daily Sales V2" fields={staffFields} leftTitle="Shift Report" rightTitle="Daily Sales V2" comparisons={r.comparisons.staffVerification} /><div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-slate-800">Issue Explanation</h3><p className="mt-2 text-sm text-slate-700 leading-6">{r.issueExplanation}</p></div></div></td></tr>}
      </Fragment>)}</tbody></table></div></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Open Issues</h2>{openIssues.length === 0 ? <p className="mt-3 text-sm text-slate-500">No open issues.</p> : <div className="mt-3 divide-y divide-slate-100">{openIssues.map((i, idx) => <div key={`${i.shiftDate}-${idx}`} className="py-3 grid gap-1 md:grid-cols-5 text-sm"><p className="font-semibold text-slate-800">{formatIssueDate(i.shiftDate)}</p><p>{i.issueType}</p><p><span className="text-slate-500">Severity:</span> {i.severity}</p><p>{i.explanation}</p><p><span className="text-slate-500">Status:</span> {i.status}</p></div>)}</div>}</section>
    </>}
  </div>;
}

function ComparisonTable({ title, subtitle, fields, leftTitle, rightTitle, comparisons }: { title: string; subtitle: string; fields: readonly string[]; leftTitle: string; rightTitle: string; comparisons: Record<string, Comparison> }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto"><h3 className="font-bold text-slate-800">{title}</h3><p className="text-xs text-slate-500 mb-3">{subtitle}</p><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="py-2">Field</th><th>{leftTitle}</th><th>{rightTitle}</th><th>Difference</th><th>Status</th></tr></thead><tbody>{fields.map((f) => { const c = comparisons[f]; return <tr key={f} className="border-t border-slate-100"><td className="py-2 font-semibold text-slate-700">{labels[f]}</td><td>{value(f, c?.receiptsValue ?? c?.shiftReportValue)}</td><td>{value(f, c?.dailySalesV2Value ?? c?.shiftReportValue)}</td><td>{diffText(f, c?.difference)}</td><td>{statusMark(c?.status ?? "NOT_AVAILABLE")}</td></tr>; })}</tbody></table></div>;
}
