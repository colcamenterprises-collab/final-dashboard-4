import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import Modal from "@/components/Modal";

export default function ViewReportPage() {
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  // Get report ID from URL params (for future implementation)
  // For now, load reports list and let user select

  const { data: reportsData } = useQuery({
    queryKey: ["daily-reports-list"],
    queryFn: async () => {
      const res = await axios.get("/api/reports/list");
      return res.data.reports ?? [];
    },
  });

  const reports = Array.isArray(reportsData) ? reportsData : [];

  const selectedReport = selectedReportId
    ? reports.find(r => r.id === selectedReportId)
    : null;

  const { data: reportDetail } = useQuery({
    queryKey: ["/api/reports", selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return null;
      const res = await axios.get(`/api/reports/${selectedReportId}/json`);
      return res.data.report;
    },
    enabled: !!selectedReportId,
  });

  const report = reportDetail || selectedReport;

  async function refreshInsights() {
    if (!selectedReportId) return;
    const res = await axios.get(`/api/insights/${selectedReportId}/live`);
    // Update the report insights
    if (report) {
      report.insights = res.data.insights;
    }
  }

  if (!selectedReportId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold font-[Poppins] mb-6">View Report</h1>
        <div className="grid gap-4">
          {reports.length === 0 ? (
            <p>No reports available.</p>
          ) : (
            reports.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedReportId(r.id)}
                className="p-4 bg-white border border-slate-200 rounded text-left hover:bg-slate-50"
              >
                <div className="font-bold">{r.date}</div>
                <div className="text-xs text-slate-600">
                  {new Date(r.createdAt).toLocaleString("en-GB")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!report) {
    return <div className="p-6">Loading report...</div>;
  }

  return (
    <div className="p-6">
      <button
        onClick={() => setSelectedReportId(null)}
        className="mb-6 px-4 py-2 bg-slate-200 rounded text-sm"
      >
        ← Back to Reports
      </button>

      <h1 className="text-2xl font-bold font-[Poppins] mb-6">
        Report: {report.shiftDate || report.date}
      </h1>

      {/* AI Insights Section */}
      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-4">AI Insights (Jussi)</h2>
        
        {report.insights ? (
          <>
            <div className="mb-4">
              <div className="text-sm font-bold text-slate-600">Risk Score</div>
              <div className="text-2xl font-bold text-emerald-600">
                {report.insights.riskScore || 0}/100
              </div>
            </div>

            <div className="space-y-3">
              {report.insights.insights && report.insights.insights.length > 0 ? (
                report.insights.insights.map((i: any, idx: number) => (
                  <div key={idx} className="border-l-4 border-slate-200 pl-4 py-2">
                    <div className="font-semibold text-sm">{i.type.toUpperCase()}</div>
                    <div
                      className={`text-sm ${
                        i.severity === "high" ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {i.message}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No insights generated.</p>
              )}
            </div>

            <button
              className="mt-4 px-4 py-2 bg-black text-white rounded text-sm"
              onClick={refreshInsights}
            >
              Refresh Insights
            </button>
          </>
        ) : (
          <p className="text-slate-600">No insights available.</p>
        )}
      </div>

      {/* Sales Summary */}
      {report.sales && (
        <div className="bg-white shadow p-4 rounded mb-6">
          <h2 className="text-lg font-bold mb-4">Sales Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-600">Cash Sales</div>
              <div className="font-bold">{report.sales.cashSales}</div>
            </div>
            <div>
              <div className="text-xs text-slate-600">QR Sales</div>
              <div className="font-bold">{report.sales.qrSales}</div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Grab Sales</div>
              <div className="font-bold">{report.sales.grabSales}</div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Total Sales</div>
              <div className="font-bold">{report.sales.totalSales}</div>
            </div>
          </div>
        </div>
      )}

      {/* Variance Summary */}
      {report.variance && (
        <div className="bg-white shadow p-4 rounded mb-6">
          <h2 className="text-lg font-bold mb-4">Variance Summary</h2>
          <div className="space-y-3">
            <div className="border-b pb-2">
              <div className="text-sm font-bold">Rolls</div>
              <div className="text-xs text-slate-600">
                Expected: {report.variance.rolls?.expected || 0}, Actual: {report.variance.rolls?.actual || 0}, Variance: {report.variance.rolls?.diff || 0}
              </div>
            </div>
            <div className="border-b pb-2">
              <div className="text-sm font-bold">Meat</div>
              <div className="text-xs text-slate-600">
                Expected: {report.variance.meat?.expectedKg || "0.00"} kg, Actual: {report.variance.meat?.actualKg || "0.00"} kg, Variance: {report.variance.meat?.diffKg || "0.00"} kg
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/api/reports/${report.id || selectedReportId}/pdf`}
          target="_blank"
          className="px-4 py-2 bg-green-600 text-white rounded text-sm"
        >
          Download PDF
        </a>
        <a
          href={`/api/reports/${report.id || selectedReportId}/json`}
          target="_blank"
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
        >
          View JSON
        </a>
      </div>
    </div>
  );
}
