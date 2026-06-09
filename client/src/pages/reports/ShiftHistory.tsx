import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface ShiftReport {
  id: string;
  shiftDate?: string;
  createdAt?: string;
  totalSales?: number;
  totalExpenses?: number;
  netProfit?: number;
  transactionCount?: number;
  status?: string;
  [key: string]: unknown;
}

interface Blocker {
  code: string;
  message: string;
}

interface HistoryResponse {
  reports?: ShiftReport[];
  blockers?: Blocker[];
}

function fmt(n: number | undefined) {
  if (n === undefined || n === null) return "—";
  return `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
}

export default function ShiftHistory() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data, isLoading, isError, refetch } = useQuery<HistoryResponse>({
    queryKey: ["/api/shift-report/history"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/shift-report/generate", { shiftDate: generateDate }),
    onSuccess: () => refetch(),
  });

  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];

  const sorted = [...reports].sort((a, b) => {
    const da = a.shiftDate ?? a.createdAt ?? "";
    const db_ = b.shiftDate ?? b.createdAt ?? "";
    return db_.localeCompare(da);
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shift History</h1>
            <p className="text-xs text-slate-500">{reports.length} shift reports</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Generate Report</p>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            value={generateDate}
            onChange={(e) => setGenerateDate(e.target.value)}
          />
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-3 py-1.5 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? "Generating..." : "Generate"}
          </button>
        </div>
        {generateMutation.isError && (
          <p className="text-[10px] text-red-500">Failed to generate report. Check the date and try again.</p>
        )}
        {generateMutation.isSuccess && (
          <p className="text-[10px] text-green-600">Report generated successfully.</p>
        )}
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading shift history...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load shift history.</div>}

      {!isLoading && !isError && blockers.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 rounded-lg">
          <p className="font-semibold">Data unavailable</p>
          {blockers.map((blocker) => (
            <p key={blocker.code}>{blocker.code}: {blocker.message}</p>
          ))}
        </div>
      )}

      {!isLoading && !isError && blockers.length === 0 && sorted.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <FileText className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-400">No shift reports yet.</p>
          <p className="text-[10px] text-slate-400">Generate a report using the form above.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {sorted.map((report) => {
            const isOpen = expandedId === report.id;
            const date = report.shiftDate ?? report.createdAt;
            const profit = (report.netProfit !== undefined) ? report.netProfit : undefined;
            const profitPositive = profit !== undefined && Number(profit) >= 0;

            return (
              <div key={report.id} className="bg-white dark:bg-slate-900">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  onClick={() => setExpandedId(isOpen ? null : report.id)}
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmtDate(date)}</p>
                    {report.transactionCount !== undefined && (
                      <p className="text-[10px] text-slate-400">{report.transactionCount} transactions</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {report.totalSales !== undefined && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(Number(report.totalSales))}</p>
                        <p className="text-[10px] text-slate-400">Sales</p>
                      </div>
                    )}
                    {profit !== undefined && (
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${profitPositive ? "text-green-600" : "text-red-500"}`}>
                          {fmt(Number(profit))}
                        </p>
                        <p className="text-[10px] text-slate-400">Net</p>
                      </div>
                    )}
                    {report.status && (
                      <Badge className={`text-[10px] px-1.5 py-0 border ${report.status === "final" ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                        {report.status}
                      </Badge>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Sales", value: fmt(Number(report.totalSales)) },
                        { label: "Expenses", value: fmt(Number(report.totalExpenses)) },
                        { label: "Net Profit", value: fmt(Number(report.netProfit)) },
                      ].map((row) => (
                        <div key={row.label} className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white">{row.value}</p>
                          <p className="text-[10px] text-slate-400">{row.label}</p>
                        </div>
                      ))}
                    </div>

                    {Object.entries(report)
                      .filter(([k]) => !["id", "shiftDate", "createdAt", "totalSales", "totalExpenses", "netProfit", "transactionCount", "status"].includes(k))
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[10px]">
                          <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{String(v)}</span>
                        </div>
                      ))}
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
