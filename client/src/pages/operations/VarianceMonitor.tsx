import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const thb = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SEVERITY_STYLE: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border border-amber-200",
  critical: "bg-red-50 text-red-700 border border-red-200",
};

export default function VarianceMonitor() {
  const { data: refundData, isLoading: refundLoading } = useQuery({
    queryKey: ["/api/refunds"],
    queryFn: () => axios.get("/api/refunds").then(r => r.data),
  });

  const { data: varianceData, isLoading: varianceLoading } = useQuery({
    queryKey: ["/api/stock/variance"],
    queryFn: () => axios.get("/api/stock/variance").then(r => r.data),
  });

  const refunds: any[] = refundData?.refunds || [];
  const todayCount: number = refundData?.todayCount || 0;
  const todayTotal: number = refundData?.todayTotal || 0;
  const variances: any[] = varianceData?.variances || [];

  return (
    <div className="p-4 space-y-5 max-w-5xl mx-auto">
      <div>
        <div className="text-3xl font-bold text-slate-900">Variance Monitor</div>
        <div className="text-sm text-slate-500 mt-0.5">Refund logs and stock variance tracking</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-[4px] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Refunds Today</div>
          <div className="text-2xl font-bold text-slate-900">{todayCount}</div>
          <div className="text-sm text-slate-500">Total: {thb(todayTotal)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[4px] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Variance Records</div>
          <div className="text-2xl font-bold text-slate-900">{variances.length}</div>
          <div className="text-sm text-slate-500">
            Critical: {variances.filter((v) => v.severity === "critical").length} &nbsp;|&nbsp;
            Warn: {variances.filter((v) => v.severity === "warn").length}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[4px] p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Refund Log</div>
        {refundLoading ? (
          <div className="text-xs text-slate-400 animate-pulse">Loading...</div>
        ) : refunds.length === 0 ? (
          <div className="text-xs text-slate-400">No refunds recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Date</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Amount</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Platform</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Reason</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Logged By</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 px-2">{r.shiftDate || new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-1.5 px-2 text-red-700 font-medium">{thb(r.amount)}</td>
                    <td className="py-1.5 px-2 capitalize">{r.platform}</td>
                    <td className="py-1.5 px-2">{r.reason}</td>
                    <td className="py-1.5 px-2 text-slate-500">{r.loggedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-[4px] p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Stock Variance</div>
        {varianceLoading ? (
          <div className="text-xs text-slate-400 animate-pulse">Loading...</div>
        ) : variances.length === 0 ? (
          <div className="text-xs text-slate-400">No variance records. Variances are computed after each Form 2 submission.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Date</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Item</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Actual</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Variance</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Severity</th>
                </tr>
              </thead>
              <tbody>
                {variances.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 px-2">{v.shiftDate}</td>
                    <td className="py-1.5 px-2 font-medium">{v.itemName}</td>
                    <td className="py-1.5 px-2">{Number(v.actualQty).toFixed(1)} {v.unit}</td>
                    <td className="py-1.5 px-2">{Number(v.varianceQty).toFixed(1)} {v.unit}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase ${SEVERITY_STYLE[v.severity] || SEVERITY_STYLE.ok}`}>
                        {v.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
