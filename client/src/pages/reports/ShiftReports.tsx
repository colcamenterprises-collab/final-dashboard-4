import { useEffect, useMemo, useState } from "react";
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
type VarianceStatus = "OK" | "Warning" | "Critical" | "Missing Data";
type OperationalVariance = { item: string; expectedUsage: number | null; actualUsage: number | null; difference: number | null; status: VarianceStatus; notes: string; unit?: string };
interface ShiftReport { id: string; shiftDate: string; receipts: MoneyBlock; shiftReport: Required<MoneyBlock>; dailySalesV2: Omit<MoneyBlock, "netSales">; posIntegrityStatus: PosStatus; staffVerificationStatus: StaffStatus; overallStatus: OverallStatus; comparisons: { posIntegrity: Record<string, Comparison>; staffVerification: Record<string, Comparison> }; issueExplanation: string; issues: Issue[]; operationalVariances?: OperationalVariance[]; }
interface HistoryResponse { reports: ShiftReport[]; blockers?: { code: string; message: string }[]; }

const ALL_FIELDS = ["grossSales", "netSales", "cash", "qr", "grab", "other", "receiptCount"] as const;
const LABELS: Record<string, string> = { grossSales: "Gross Sales", netSales: "Net Sales", cash: "Cash", qr: "QR", grab: "Grab", other: "Other", receiptCount: "Receipt Count" };

function fmtDate(d?: string) { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }
function fmtIssueDate(d?: string) { return fmtDate(d); }
function fmtMoney(n: number | null | undefined) { if (n == null) return "—"; return `฿${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function fmtCount(n: number | null | undefined) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }
function fmtVal(field: string, n: number | null | undefined) { return field === "receiptCount" ? fmtCount(n) : fmtMoney(n); }
function fmtUsage(n: number | null | undefined, unit?: string) { return n == null ? "—" : `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`; }
function fmtDiff(field: string, n: number | null | undefined, compact = false): { text: string; sign: "pos" | "neg" | "zero" | "na" } {
  if (n == null) return { text: "—", sign: "na" };
  if (Math.abs(n) < 0.005) return { text: field === "receiptCount" ? "0" : "฿0", sign: "zero" };
  const abs = Math.abs(n);
  const prefix = n > 0 ? "+" : "−";
  const text = field === "receiptCount"
    ? `${prefix}${abs}`
    : compact ? `${prefix}฿${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `${prefix}฿${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return { text, sign: n > 0 ? "pos" : "neg" };
}

function PosBadge({ status }: { status: PosStatus }) {
  if (status === "VERIFIED") return <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">POS ✓</span>;
  if (status === "MISSING_RECEIPTS") return <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Missing Receipts</span>;
  if (status === "MISSING_SHIFT_REPORT") return <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Missing Shift Report</span>;
  return <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">POS ✕</span>;
}

function StaffBadge({ status }: { status: StaffStatus }) {
  if (status === "VERIFIED") return <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Staff ✓</span>;
  if (status === "MISSING_FORM") return <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Missing Form</span>;
  return <span className="inline-flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Staff ✕</span>;
}

function CheckCell({ cmp, field }: { cmp: Comparison | undefined; field: string }) {
  if (!cmp || cmp.status === "NOT_AVAILABLE") return <td className="px-3 py-2 text-slate-300 text-center">—</td>;
  if (cmp.status === "MATCH") return <td className="px-3 py-2 text-center font-semibold text-emerald-600">✓</td>;
  const { text, sign } = fmtDiff(field, cmp.difference);
  return <td className={`px-3 py-2 text-center font-semibold ${sign === "neg" ? "text-red-600" : "text-orange-600"}`}>✕ {text}</td>;
}

function DiffPill({ cmp, field }: { cmp: Comparison | undefined; field: string }) {
  if (!cmp || cmp.status === "NOT_AVAILABLE") return <span className="text-slate-300">—</span>;
  if (cmp.status === "MATCH") return <span className="text-emerald-600 font-semibold">✓</span>;
  const { text, sign } = fmtDiff(field, cmp.difference, true);
  return <span className={`font-semibold ${sign === "neg" ? "text-red-600" : "text-orange-600"}`}>{text}</span>;
}

export default function ShiftReports() {
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery<HistoryResponse>({ queryKey: ["/api/shift-report/history"] });
  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];

  useEffect(() => {
    if (reports.length > 0 && openId === null) setOpenId(reports[0].id);
  }, [reports.length]);

  const filtered = useMemo(() => reports.filter((r) => filter === "ALL" || r.overallStatus === filter), [reports, filter]);
  const openIssues = useMemo(() => reports.flatMap((r) => r.issues ?? []), [reports]);

  const kpis: [string, number][] = [
    ["POS Verified", reports.filter((r) => r.posIntegrityStatus === "VERIFIED").length],
    ["POS Issues", reports.filter((r) => r.posIntegrityStatus !== "VERIFIED").length],
    ["Staff Issues", reports.filter((r) => r.staffVerificationStatus === "ISSUE").length],
    ["Missing Forms", reports.filter((r) => r.staffVerificationStatus === "MISSING_FORM").length],
  ];

  function toggle(id: string) { setOpenId(prev => prev === id ? null : id); }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageTitle title="Shift Verification" meta="Receipts → Shift Report → Daily Sales V2" />

      <div className="flex flex-wrap gap-2">
        {([["ALL","All"],["VERIFIED","Verified"],["POS ISSUE","POS Issues"],["STAFF ISSUE","Staff Issues"],["MISSING FORM","Missing Forms"]] as [FilterValue,string][]).map(([v, label]) =>
          <button key={v} onClick={() => setFilter(v)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
        )}
      </div>

      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading shift verification…</div>}
      {isError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="h-4 w-4" />Shift verification data unavailable.</div>}
      {!isLoading && !isError && blockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Data unavailable</div>
          {blockers.map((b) => <p key={b.code}>{b.message}</p>)}
        </div>
      )}
      {!isLoading && !isError && reports.length === 0 && blockers.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400"><Calendar className="h-10 w-10 opacity-30" /><p className="text-sm">No shift data found yet.</p></div>
      )}

      {reports.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(([label, v]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {filtered.map((r, idx) => {
              const isOpen = openId === r.id;
              const posGross = r.comparisons.posIntegrity?.grossSales;
              const posReceipts = r.comparisons.posIntegrity?.receiptCount;
              const posCash = r.comparisons.posIntegrity?.cash;
              const missingReceipts = r.posIntegrityStatus === "MISSING_RECEIPTS";
              const missingShift = r.posIntegrityStatus === "MISSING_SHIFT_REPORT";
              const missingForm = r.staffVerificationStatus === "MISSING_FORM";

              return (
                <div key={r.id} className={`${idx > 0 ? "border-t border-slate-100" : ""}`}>
                  {/* Collapsed row */}
                  <button
                    onClick={() => toggle(r.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors ${isOpen ? "bg-slate-50" : ""}`}
                  >
                    <span className="w-24 shrink-0 text-xs font-bold text-slate-800">{fmtDate(r.shiftDate)}</span>
                    <span className="shrink-0"><PosBadge status={r.posIntegrityStatus} /></span>
                    <span className="shrink-0"><StaffBadge status={r.staffVerificationStatus} /></span>
                    <span className="hidden md:flex items-center gap-4 flex-1 text-xs text-slate-600">
                      <span>Gross <DiffPill cmp={posGross} field="grossSales" /></span>
                      <span>Receipts <DiffPill cmp={posReceipts} field="receiptCount" /></span>
                      <span>Cash <DiffPill cmp={posCash} field="cash" /></span>
                    </span>
                    <span className="ml-auto shrink-0 text-slate-400">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4 space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              <th className="px-3 py-2">Field</th>
                              <th className="px-3 py-2">
                                Receipts
                                {missingReceipts && <span className="ml-1 font-normal normal-case text-amber-600">(Missing)</span>}
                              </th>
                              <th className="px-3 py-2">
                                Shift Report
                                {missingShift && <span className="ml-1 font-normal normal-case text-amber-600">(Missing)</span>}
                              </th>
                              <th className="px-3 py-2">
                                Daily Sales V2
                                {missingForm && <span className="ml-1 font-normal normal-case text-amber-600">(Missing Form)</span>}
                              </th>
                              <th className="px-3 py-2 text-center">POS Check</th>
                              <th className="px-3 py-2 text-center">Staff Check</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ALL_FIELDS.map((field) => {
                              const posCmp = r.comparisons.posIntegrity?.[field];
                              const staffCmp = r.comparisons.staffVerification?.[field];
                              const receiptsVal = r.receipts[field as keyof MoneyBlock];
                              const shiftVal = r.shiftReport[field as keyof Required<MoneyBlock>];
                              const dsv2Val = field === "netSales" ? null : r.dailySalesV2[field as keyof Omit<MoneyBlock, "netSales">];

                              return (
                                <tr key={field} className="border-t border-slate-100 hover:bg-slate-50/50">
                                  <td className="px-3 py-2 font-semibold text-slate-700">{LABELS[field]}</td>
                                  <td className="px-3 py-2 text-slate-600">{fmtVal(field, receiptsVal)}</td>
                                  <td className="px-3 py-2 text-slate-600">{fmtVal(field, shiftVal)}</td>
                                  <td className="px-3 py-2 text-slate-600">{missingForm ? "—" : fmtVal(field, dsv2Val)}</td>
                                  <CheckCell cmp={posCmp} field={field} />
                                  {field === "netSales"
                                    ? <td className="px-3 py-2 text-center text-slate-300">—</td>
                                    : <CheckCell cmp={staffCmp} field={field} />
                                  }
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>


                      {(r.operationalVariances ?? []).length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Operational Variance</p>
                            <p className="text-[11px] text-slate-500">Stock usage review from POS-derived expected usage and Daily Sales/Stock V2 counts. Missing inputs are labelled and not guessed.</p>
                          </div>
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2">Item</th>
                                <th className="px-3 py-2 text-right">Expected usage</th>
                                <th className="px-3 py-2 text-right">Actual / counted usage</th>
                                <th className="px-3 py-2 text-right">Difference</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Notes / investigation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(r.operationalVariances ?? []).map((v) => (
                                <tr key={v.item} className="border-t border-slate-100 hover:bg-slate-50/50">
                                  <td className="px-3 py-2 font-semibold text-slate-700">{v.item}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{fmtUsage(v.expectedUsage, v.unit)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{fmtUsage(v.actualUsage, v.unit)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{fmtUsage(v.difference, v.unit)}</td>
                                  <td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${v.status === "OK" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : v.status === "Critical" ? "border-red-200 bg-red-50 text-red-700" : v.status === "Warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{v.status}</span></td>
                                  <td className="px-3 py-2 text-slate-500">{v.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Issue Explanation</p>
                        <p className="text-sm text-slate-700 leading-6">{r.issueExplanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {openIssues.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 mb-3">Open Issues</h2>
              <div className="divide-y divide-slate-100">
                {openIssues.map((i, idx) => (
                  <div key={`${i.shiftDate}-${idx}`} className="py-2.5 grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{fmtIssueDate(i.shiftDate)}</span>
                    <span className={i.issueType === "POS Issue" ? "text-red-600 font-medium" : i.issueType === "Staff Issue" ? "text-orange-600 font-medium" : "text-amber-600 font-medium"}>{i.issueType}</span>
                    <span className="text-slate-500">{i.severity}</span>
                    <span className="col-span-3 md:col-span-1 text-slate-600">{i.explanation}</span>
                    <span className="text-slate-400">{i.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
