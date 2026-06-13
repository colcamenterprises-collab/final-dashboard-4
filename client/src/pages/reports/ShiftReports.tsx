import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, XCircle } from "lucide-react";
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

function formatDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function PosStatusBadge({ report }: { report: ShiftReport }) {
  if (report.staffSalesStatus === "not_entered")
    return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border-slate-200">Not entered</span>;
  if (report.posStatus === "matched")
    return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">Matched</span>;
  if (report.posStatus === "mismatch")
    return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 border-red-200">Mismatch</span>;
  return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border-slate-200">No POS data</span>;
}

function FormStatusBadge({ status }: { status: ShiftReport["staffFormStatus"] }) {
  if (status === "submitted")
    return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 border-blue-200">Form ✓</span>;
  return <span className="inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border-amber-200">No form</span>;
}

export default function ShiftReports() {
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ["/api/shift-report/history"],
  });

  const reports = data?.reports ?? [];
  const blockers = data?.blockers ?? [];

  // Summary stats from most recent 7
  const recent = reports.slice(0, 7);
  const avgGross = recent.length > 0
    ? Math.round(recent.reduce((s, r) => s + (r.grossSales ?? 0), 0) / recent.length)
    : null;
  const totalReceipts = recent.reduce((s, r) => s + (r.receiptCount ?? 0), 0);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageTitle
        title="Shift Reports"
        meta={reports.length > 0 ? `${reports.length} shifts on record` : "Shift summaries from POS"}
        right={
          avgGross != null ? (
            <div className="text-right">
              <p className="text-xs text-slate-500">7-day avg sales</p>
              <p className="text-base font-bold text-slate-900">{fmt(avgGross)}</p>
            </div>
          ) : undefined
        }
      />

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Loading shift reports…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          Failed to load shift reports. Check server connection.
        </div>
      )}

      {!isLoading && !isError && blockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Data unavailable
          </div>
          {blockers.map((b) => <p key={b.code}>{b.message}</p>)}
        </div>
      )}

      {!isLoading && !isError && reports.length === 0 && blockers.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <Calendar className="h-10 w-10 opacity-30" />
          <p className="text-sm">No shift data found yet.</p>
        </div>
      )}

      {reports.length > 0 && (
        <>
          {/* Summary strip */}
          {recent.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Last 7 receipts", value: totalReceipts.toLocaleString() },
                { label: "Avg gross (7d)",  value: fmt(avgGross) },
                { label: "Forms complete",  value: `${recent.filter(r => r.staffFormStatus === "submitted").length}/${recent.length}` },
                { label: "POS matched",     value: `${recent.filter(r => r.posStatus === "matched").length}/${recent.length}` },
                { label: "With form data",  value: `${recent.filter(r => r.staffSalesStatus !== "not_entered" && r.staffFormStatus === "submitted").length}/${recent.length}` },
                { label: "Total on record", value: reports.length.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Main table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">POS Gross</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Cash</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Grab</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">QR</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Receipts</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Form</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">POS check</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px]">By</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{formatDate(r.shiftDate)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmt(r.grossSales)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.cashSales)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.grabSales)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.qrSales)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{r.receiptCount ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center"><FormStatusBadge status={r.staffFormStatus} /></td>
                      <td className="px-4 py-2.5 text-center"><PosStatusBadge report={r} /></td>
                      <td className="px-4 py-2.5 text-slate-500">{r.completedBy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
