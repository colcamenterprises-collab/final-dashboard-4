// PATCH 3 — SHIFT REPORT HISTORY PAGE
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";

export default function ShiftReportHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["shift-report-history"],
    queryFn: async () => {
      const res = await axios.get("/api/shift-report/history");
      return res.data;
    },
  });

  const reports: any[] = data?.reports || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Report History</h1>

      {isLoading && <p>Loading...</p>}

      {!isLoading && reports.length === 0 && <p>No shift reports found.</p>}

      <ul className="space-y-3">
        {reports.map((r: any) => (
          <li key={r.id} className="border rounded p-4" data-testid={`history-item-${r.id}`}>
            <strong>
              {new Date(r.shiftDate).toLocaleString("en-TH", {
                timeZone: "Asia/Bangkok",
              })}
            </strong>

            <div className="mt-2">
              <Link
                to={`/reports/shift-report/view/${r.id}`}
                className="px-3 py-1 bg-black text-white rounded"
                data-testid={`button-view-${r.id}`}
              >
                View Report
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Link
          to="/reports/shift-report"
          className="px-4 py-2 bg-gray-700 text-white rounded"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
