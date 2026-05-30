import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar } from "lucide-react";

interface ShiftReport {
  id: string | number;
  shiftDate?: string;
  date?: string;
  completedBy?: string;
  status?: string;
  totalSales?: number;
  createdAt?: string;
}

interface HistoryResponse {
  reports: ShiftReport[];
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

export default function ShiftReports() {
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ["/api/shift-report/history"],
  });

  const reports = data?.reports ?? [];

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shift Reports</h1>
          <p className="text-xs text-slate-500">{reports.length} reports generated</p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading reports...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load reports.</div>
      )}

      {!isLoading && !isError && reports.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <Calendar className="h-10 w-10 opacity-30" />
          <p className="text-xs">No shift reports have been generated yet.</p>
          <p className="text-[11px] text-slate-300">Reports are auto-generated after each shift closes.</p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Completed By</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Status</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Total Sales (฿)</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Generated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                    {formatDate(r.shiftDate || r.date)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.completedBy || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {r.status || "Generated"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {r.totalSales != null
                      ? r.totalSales.toLocaleString("en-TH", { minimumFractionDigits: 0 })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 font-mono">
                    {formatDate(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
