import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

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
  staffSalesStatus?: "entered" | "not_entered";
  staffSalesMessage?: string | null;
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
  const colours = {
    GREEN:  "bg-green-100 text-green-700 border-green-200",
    YELLOW: "bg-amber-100 text-amber-700 border-amber-200",
    RED:    "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge className={`text-[10px] px-1.5 py-0 border ${colours[vs.level]}`}>
      {vs.variance >= 0 ? "+" : ""}{Math.round(vs.variance)} ฿
    </Badge>
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
    <div className="p-4 space-y-4 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shift History</h1>
            <p className="text-xs text-slate-500">{reports.length} shifts from Loyverse</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Generate panel */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Generate Report</p>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            value={generateDate}
            onChange={(e) => { setGenerateDate(e.target.value); setGenerateResult(null); }}
          />
          <button
            onClick={() => { setGenerateResult(null); generateMutation.mutate(); }}
            disabled={generateMutation.isPending}
            className="px-3 py-1.5 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? "Generating..." : "Generate"}
          </button>
        </div>

        {/* Generate result */}
        {generateResult && !generateMutation.isPending && (
          <div className={`p-2 rounded-lg text-[10px] border ${
            generateResult.success
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20"
              : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20"
          }`}>
            {generateResult.success ? (
              <div className="flex items-start gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Report generated</span>
                  {generateResult.persistenceSkipped && (
                    <span className="ml-1 text-amber-600">(persistence skipped — shift_report_v2 write failed)</span>
                  )}
                  {generateResult.report && (
                    <div className="mt-1 space-y-0.5">
                      <div>POS Gross: {fmt(generateResult.report.grossSales)}</div>
                      <div>Receipts: {generateResult.report.receiptCount ?? "—"}</div>
                      <div>Staff form: {generateResult.report.staffFormStatus}</div>
                      <div>POS status: {generateResult.report.posStatus}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Generation failed</span>
                  {(generateResult.blockers ?? []).map((b) => (
                    <p key={b.code} className="mt-0.5">{b.code}: {b.message}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading / error */}
      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading shift history...</div>}
      {isError && (
        <div className="flex items-center gap-2 py-6 px-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-xs text-red-600">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          Failed to load shift history.
        </div>
      )}

      {/* Data blockers */}
      {!isLoading && !isError && blockers.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300 rounded-lg space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Data unavailable
          </div>
          {blockers.map((b) => <p key={b.code}>{b.code}: {b.message}</p>)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && blockers.length === 0 && sorted.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <FileText className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-400">No shift data in Loyverse yet.</p>
        </div>
      )}

      {/* Report list */}
      {sorted.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {sorted.map((report) => {
            const isOpen = expandedId === report.id;
            return (
              <div key={report.id} className="bg-white dark:bg-slate-900">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  onClick={() => setExpandedId(isOpen ? null : report.id)}
                >
                  {isOpen
                    ? <ChevronDown  className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">
                      {fmtDate(report.shiftDate)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {report.receiptCount != null ? `${report.receiptCount} receipts` : "receipts unknown"}
                      {report.completedBy ? ` · ${report.completedBy}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(report.grossSales)}</p>
                      <p className="text-[10px] text-slate-400">POS gross</p>
                    </div>
                    {report.varianceSummary && <VariancePill vs={report.varianceSummary} />}
                    <Badge className={`text-[10px] px-1.5 py-0 border ${
                      report.staffFormStatus === "submitted"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    }`}>
                      {report.staffFormStatus === "submitted" ? "Form ✓" : "No Form"}
                    </Badge>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${
                      report.staffSalesStatus === "not_entered" ? "bg-slate-100 text-slate-600 border-slate-200" :
                      report.posStatus === "matched"  ? "bg-green-100 text-green-700 border-green-200"  :
                      report.posStatus === "mismatch" ? "bg-red-100 text-red-700 border-red-200" :
                                                        "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {report.staffSalesStatus === "not_entered" ? "Staff sales not entered" : report.posStatus === "matched" ? "Matched" : report.posStatus === "mismatch" ? "Mismatch" : "No POS"}
                    </Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "POS Gross",    value: fmt(report.grossSales) },
                        { label: "POS Net",       value: fmt(report.netSales) },
                        { label: "Receipt Gross", value: fmt(report.receiptGross) },
                        { label: "Cash",          value: fmt(report.cashSales) },
                        { label: "Grab",          value: fmt(report.grabSales) },
                        { label: "QR",            value: fmt(report.qrSales) },
                      ].map((row) => (
                        <div key={row.label} className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white">{row.value}</p>
                          <p className="text-[10px] text-slate-400">{row.label}</p>
                        </div>
                      ))}
                    </div>

                    {report.staffFormStatus === "submitted" && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Staff Sales",    value: report.staffSalesStatus === "not_entered" ? "Staff sales not entered" : fmt(report.staffTotal) },
                          { label: "Staff Expenses", value: fmt(report.staffExpenses) },
                          { label: "Completed By",   value: report.completedBy ?? "—" },
                        ].map((row) => (
                          <div key={row.label} className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{row.value}</p>
                            <p className="text-[10px] text-slate-400">{row.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {report.varianceSummary && (
                      <div className={`text-[10px] p-2 rounded-lg border ${
                        report.varianceSummary.level === "GREEN"  ? "bg-green-50 border-green-200 text-green-700"  :
                        report.varianceSummary.level === "YELLOW" ? "bg-amber-50 border-amber-200 text-amber-700" :
                                                                    "bg-red-50 border-red-200 text-red-700"
                      }`}>
                        Variance: {fmt(report.varianceSummary.variance)} (staff {fmt(report.staffTotal)} vs POS {fmt(report.grossSales)}) — {report.varianceSummary.level}
                      </div>
                    )}

                    <p className="text-[9px] text-slate-400">Source: {report.source}</p>
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
