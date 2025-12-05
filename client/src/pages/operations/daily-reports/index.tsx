import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";

export default function DailySummaryReportsPage() {
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  // Load reports list
  const { data, refetch } = useQuery({
    queryKey: ["daily-reports-list"],
    queryFn: async () => {
      const res = await axios.get("/api/reports/list");
      return res.data.reports ?? [];
    },
  });

  const reports = Array.isArray(data) ? data : [];

  // Manual generation
  async function generateReportNow() {
    setLoadingGenerate(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await axios.post(`/api/reports/daily/generate?date=${today}&sendEmail=false`);
      await refetch();
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold font-[Poppins] mb-6">
        Daily Summary Reports
      </h1>

      <button
        onClick={generateReportNow}
        disabled={loadingGenerate}
        className="mb-6 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 font-semibold rounded border-2 border-black"
      >
        {loadingGenerate ? "Generating..." : "Generate Report Now"}
      </button>

      {reports.length === 0 ? (
        <p>No reports found.</p>
      ) : (
        <table className="min-w-full bg-white border border-gray-300 rounded">
          <thead>
            <tr className="bg-yellow-300 border-b border-black">
              <th className="p-2 border-r border-black text-left">Date</th>
              <th className="p-2 border-r border-black text-left">Created</th>
              <th className="p-2 border-black text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-300">{r.date}</td>
                <td className="p-2 border-r border-gray-300">
                  {new Date(r.createdAt).toLocaleString("en-GB")}
                </td>
                <td className="p-2 space-x-3">
                  <a
                    className="text-blue-600 underline"
                    href={`/api/reports/${r.id}/json`}
                    target="_blank"
                  >
                    View JSON
                  </a>
                  <a
                    className="text-green-600 underline"
                    href={`/api/reports/${r.id}/pdf`}
                    target="_blank"
                  >
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
