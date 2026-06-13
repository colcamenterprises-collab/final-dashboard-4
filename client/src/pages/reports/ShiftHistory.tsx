import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PageTitle } from "@/components/ui/sbb-cards";

interface VarianceSummary {
  posGross: number;
  staffTotal: number;
  variance: number;
  absVariance: number;
  level: "GREEN" | "YELLOW" | "RED";
}

interface ShiftReport {
  id: string;
  shiftDate: string;
  grossSales: number | null;
  netSales: number | null;
  cashSales: number | null;
  grabSales: number | null;
  qrSales: number | null;
  receiptCount: number | null;
  receiptGross: number | null;
  staffFormStatus: "submitted" | "missing";
  posStatus: "matched" | "mismatch" | "missing";
  varianceSummary: VarianceSummary | null;
  completedBy: string | null;
  staffTotal: number | null;
  staffExpenses: number | null;
  source: string;
}

interface HistoryResponse {
  reports: ShiftReport[];
  blockers?: { code: string; message: string }[];
}

interface GenerateResponse {
  success: boolean;
  report: ShiftReport | null;
  persistenceSkipped?: boolean;
  blockers?: { code: string; message: string }[];
}

function fmtDate(s?: string) {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function VariancePill({ vs }: { vs: VarianceSummary | null }) {
  if (!vs) return null;
  const cls = {
    GREEN:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    YELLOW: "bg-amber-100 text-amber-700 border-amber-200",
    RED:    "bg-red-100 text-red-700 border-red-200",
  }[vs.level];
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {vs.variance >= 0 ? "+" : ""}{Math.round(vs.variance)} ฿
    </span>
  );
}

export default function ShiftHistory() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<HistoryResponse>({
    queryKey: ["/api/shift-report/history"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/shift-report/generate", {
        method: "POST",
        body: JSON.stringify({ shiftDate: generateDate }),
      });
      return res as GenerateResponse;
    },
    onSuccess: (result) => {
      setGenerateResult(result);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/shift-report/history"] });
      }
    },
    onError: (err: any) => {
      setGenerateResult({
        success: false,
        report: null,
        blockers: [{ code: "REQUEST_FAILED", message: err?.message ?? "Request failed" }],
      });
    },
  });

  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];
  const sorted = [...reports].sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <PageTitle
        title="Shift History"
        meta={reports.length > 0 ? `${reports.length} shifts` : "Expandable shift detail view"}
        right={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {/* Generate panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">Generate Report</p>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/20"
            value={generateDate}
            onChange={(e) => { setGenerateDate(e.target.value); setGenerateResult(null); }}
          />
          <button
            onClick={() => { setGenerateResult(null); generateMutation.mutate(); }}
            disabled={generateMutation.isPending}
            className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? "Generating…" : "Generate"}
          </button>
        </div>

        {generateResult && !generateMutation.isPending && (
          <div className={`p-3 rounded-xl text-xs border ${
            generateResult.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {generateResult.success ? (
              <div className="flex items-start gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Report generated</span>
                  {generateResult.persistenceSkipped && (
                    <span className="ml-1 text-amber-600">(some data was skipped)</span>
                  )}
                  {generateResult.report && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      <div>POS Gross: <strong>{fmt(generateResult.report.grossSales)}</strong></div>
                      <div>Receipts: <strong>{generateResult.report.receiptCount ?? "—"}</strong></div>
                      <div>Form: <strong className="capitalize">{generateResult.report.staffFormStatus}</strong></div>
                      <div>POS match: <strong className="capitalize">{generateResult.report.posStatus}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Generation failed</span>
                  {(generateResult.blockers ?? []).map((b) => (
                    <p key={b.code} className="mt-0.5">{b.message}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Loading shift history…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          Failed to load shift history.
        </div>
      )}

      {/* Data blockers */}
      {!isLoading && !isError && blockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Data unavailable
          </div>
          {blockers.map((b) => <p key={b.code}>{b.message}</p>)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && blockers.length === 0 && sorted.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <FileText className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-400">No shift data yet.</p>
        </div>
      )}

      {/* Report list */}
      {sorted.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
          {sorted.map((report) => {
            const isOpen = expandedId === report.id;
            return (
              <div key={report.id}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : report.id)}
                >
                  {isOpen
                    ? <ChevronDown  className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{fmtDate(report.shiftDate)}</p>
                    <p className="text-[10px] text-slate-400">
                      {report.receiptCount != null ? `${report.receiptCount} receipts` : "receipts unknown"}
                      {report.completedBy ? ` · ${report.completedBy}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-900">{fmt(report.grossSales)}</p>
                      <p className="text-[10px] text-slate-400">POS gross</p>
                    </div>
                    {report.varianceSummary && <VariancePill vs={report.varianceSummary} />}
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                      report.staffFormStatus === "submitted"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    }`}>
                      {report.staffFormStatus === "submitted" ? "Form ✓" : "No form"}
                    </span>
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                      report.posStatus === "matched"  ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                      report.posStatus === "mismatch" ? "bg-red-100 text-red-700 border-red-200" :
                                                        "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {report.posStatus === "matched" ? "Matched" : report.posStatus === "mismatch" ? "Mismatch" : "No POS"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-2 bg-slate-50/60 space-y-4 border-t border-slate-100">

                    {/* POS breakdown */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">POS breakdown</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Gross sales",   value: fmt(report.grossSales) },
                          { label: "Net sales",     value: fmt(report.netSales) },
                          { label: "Receipt gross", value: fmt(report.receiptGross) },
                          { label: "Cash",          value: fmt(report.cashSales) },
                          { label: "Grab",          value: fmt(report.grabSales) },
                          { label: "QR",            value: fmt(report.qrSales) },
                        ].map((row) => (
                          <div key={row.label} className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                            <p className="text-sm font-bold text-slate-900">{row.value}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{row.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff form data */}
                    {report.staffFormStatus === "submitted" && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Staff form</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Staff total",    value: fmt(report.staffTotal) },
                            { label: "Expenses",       value: fmt(report.staffExpenses) },
                            { label: "Completed by",   value: report.completedBy ?? "—" },
                          ].map((row) => (
                            <div key={row.label} className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                              <p className="text-sm font-bold text-slate-900">{row.value}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{row.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Variance */}
                    {report.varianceSummary && (
                      <div className={`text-xs p-3 rounded-xl border font-medium ${
                        report.varianceSummary.level === "GREEN"  ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                        report.varianceSummary.level === "YELLOW" ? "bg-amber-50 border-amber-200 text-amber-800" :
                                                                    "bg-red-50 border-red-200 text-red-800"
                      }`}>
                        Variance: {fmt(report.varianceSummary.variance)}
                        {" · "}Staff {fmt(report.staffTotal)} vs POS {fmt(report.grossSales)}
                        {" · "}
                        <span className="font-bold">{report.varianceSummary.level}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
