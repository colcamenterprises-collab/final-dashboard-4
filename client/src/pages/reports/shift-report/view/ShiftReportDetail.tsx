// PATCH 3 — SHIFT REPORT DETAIL VIEW
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams, Link } from "react-router-dom";

export default function ShiftReportDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: report, isLoading } = useQuery({
    queryKey: ["shift-report", id],
    queryFn: async () => {
      const res = await axios.get(`/api/shift-report/view/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) return <p className="p-6">Loading report...</p>;
  if (!report) return <p className="p-6">Report not found.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Report Details</h1>

      <button
        onClick={() => window.open(`/api/shift-report/pdf/${id}`, "_blank")}
        className="mb-4 px-4 py-2 bg-black text-white rounded"
        data-testid="button-download-pdf"
      >
        Download PDF
      </button>

      <div className="border rounded p-4 mb-4">
        <strong>Shift Date:</strong>{" "}
        {new Date(report.shiftDate).toLocaleString("en-TH", {
          timeZone: "Asia/Bangkok",
        })}
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Variances</h2>
        <div>Cash Variance: {report.variances?.cashVariance ?? "N/A"}</div>
        <div>QR Variance: {report.variances?.qrVariance ?? "N/A"}</div>
        <div>Grab Variance: {report.variances?.grabVariance ?? "N/A"}</div>
        <div>Total Sales Variance: {report.variances?.totalSalesVariance ?? "N/A"}</div>
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Sales Data</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
          {JSON.stringify(report.salesData, null, 2)}
        </pre>
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Stock Data</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
          {JSON.stringify(report.stockData, null, 2)}
        </pre>
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">POS Data</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
          {JSON.stringify(report.posData, null, 2)}
        </pre>
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">AI Insights</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm whitespace-pre-wrap">
          {report.aiInsights || "No insights available."}
        </pre>
      </div>

      <div className="mt-4 space-x-2">
        <Link
          to="/reports/shift-report"
          className="px-4 py-2 bg-gray-700 text-white rounded"
        >
          Back to Dashboard
        </Link>
        <Link
          to="/reports/shift-report/history"
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          View History
        </Link>
      </div>
    </div>
  );
}
