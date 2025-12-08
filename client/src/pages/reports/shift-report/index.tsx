// PATCH 3 — SHIFT REPORT DASHBOARD UI
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";

export default function ShiftReportDashboard() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["shift-report-latest"],
    queryFn: async () => {
      const res = await axios.get("/api/shift-report/latest");
      return res.data;
    },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Latest Shift Report</h1>

      {isLoading && <p>Loading...</p>}

      {!isLoading && !report && <p>No shift report available.</p>}

      {report && (
        <div className="border rounded p-4 mb-4" data-testid="latest-report">
          <strong>Shift Date:</strong>{" "}
          {new Date(report.shiftDate).toLocaleString("en-TH", {
            timeZone: "Asia/Bangkok",
          })}

          <div className="mt-2">
            <strong>Cash Variance:</strong> {report.variances?.cashVariance ?? "N/A"}
          </div>
          <div>
            <strong>QR Variance:</strong> {report.variances?.qrVariance ?? "N/A"}
          </div>
          <div>
            <strong>Grab Variance:</strong> {report.variances?.grabVariance ?? "N/A"}
          </div>
          <div>
            <strong>Total Sales Variance:</strong>{" "}
            {report.variances?.totalSalesVariance ?? "N/A"}
          </div>

          <div className="mt-4">
            <Link
              to={`/reports/shift-report/view/${report.id}`}
              className="px-4 py-2 bg-black text-white rounded"
              data-testid="button-view-full"
            >
              View Full Report
            </Link>
          </div>
        </div>
      )}

      <Link
        to="/reports/shift-report/history"
        className="px-4 py-2 bg-gray-700 text-white rounded"
        data-testid="button-view-history"
      >
        View History
      </Link>
    </div>
  );
}
