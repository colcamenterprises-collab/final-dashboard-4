import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

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

function formatDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function PosStatusBadge({ status }: { status: ShiftReport["posStatus"] }) {
  if (status === "matched")  return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border border-green-200">Matched</Badge>;
  if (status === "mismatch") return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border border-red-200">Mismatch</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-500 border border-slate-200">POS Missing</Badge>;
}

function FormStatusBadge({ status }: { status: ShiftReport["staffFormStatus"] }) {
  if (status === "submitted") return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border border-blue-200">Form ✓</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border border-amber-200">No Form</Badge>;
}

export default function ShiftReports() {
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ["/api/shift-report/history"],
  });

  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shift Reports</h1>
          <p className="text-xs text-slate-500">
            {reports.length > 0 ? `${reports.length} shifts — source: loyverse_shifts + daily_sales_v2` : "Latest generated shift summaries"}
          </p>
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-slate-400 text-xs">Loading reports...</div>}
      {isError && (
        <div className="flex items-center gap-2 py-6 px-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-xs text-red-600">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          Failed to load shift reports. Check server connection.
        </div>
      )}

      {!isLoading && !isError && blockers.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300 rounded-lg space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Data blockers
          </div>
          {blockers.map((b) => <p key={b.code}>{b.code}: {b.message}</p>)}
        </div>
      )}

      {!isLoading && !isError && reports.length === 0 && blockers.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <Calendar className="h-10 w-10 opacity-30" />
          <p className="text-xs">No shift data found in Loyverse.</p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">POS Gross</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Cash</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Grab</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">QR</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Receipts</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">Form</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">POS Check</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">By</th>
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
                      {formatDate(r.shiftDate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-white">
                      {fmt(r.grossSales)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      {fmt(r.cashSales)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      {fmt(r.grabSales)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      {fmt(r.qrSales)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                      {r.receiptCount ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <FormStatusBadge status={r.staffFormStatus} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PosStatusBadge status={r.posStatus} />
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {r.completedBy ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <p className="text-[10px] text-slate-400 text-right">
          Source: loyverse_shifts + lv_receipt + daily_sales_v2
        </p>
      )}
    </div>
  );
}
