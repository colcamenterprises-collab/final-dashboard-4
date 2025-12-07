import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import Modal from "@/components/Modal";

export default function DailySummaryReportsPage() {
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<any>(null);

  // Load reports list
  const { data, refetch } = useQuery({
    queryKey: ["daily-reports-list"],
    queryFn: async () => {
      const res = await axios.get("/api/reports/list");
      return res.data.reports ?? [];
    },
  });

  const reports = Array.isArray(data) ? data : [];

  // Filter by search
  const filtered = reports.filter(r => 
    r.date.includes(search) ||
    (r.variance?.flags || "").toLowerCase().includes(search.toLowerCase())
  );

  // Filter by variance severity
  const visible = filtered.filter(r => {
    if (filter === "clean") return r.variance?.errorCount === 0;
    if (filter === "warnings") return r.variance?.errorCount > 0;
    return true;
  });

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

      <input 
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by date or variance..."
        className="mb-4 p-2 border rounded w-full"
      />

      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setFilter("all")} 
          className={`px-4 py-2 rounded border ${filter === "all" ? "bg-yellow-300 border-black" : "bg-white border-gray-300"}`}
        >
          All
        </button>
        <button 
          onClick={() => setFilter("clean")} 
          className={`px-4 py-2 rounded border ${filter === "clean" ? "bg-yellow-300 border-black" : "bg-white border-gray-300"}`}
        >
          Clean
        </button>
        <button 
          onClick={() => setFilter("warnings")} 
          className={`px-4 py-2 rounded border ${filter === "warnings" ? "bg-yellow-300 border-black" : "bg-white border-gray-300"}`}
        >
          Warnings
        </button>
      </div>

      {visible.length === 0 ? (
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
            {visible.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-300">{r.date}</td>
                <td className="p-2 border-r border-gray-300">
                  {new Date(r.createdAt).toLocaleString("en-GB")}
                </td>
                <td className="p-2 space-x-3">
                  <button
                    onClick={() => setPreview(r)}
                    className="text-purple-600 underline"
                  >
                    View
                  </button>
                  <a
                    className="text-blue-600 underline"
                    href={`/api/reports/${r.id}/json`}
                    target="_blank"
                  >
                    JSON
                  </a>
                  <a
                    className="text-green-600 underline"
                    href={`/api/reports/${r.id}/pdf`}
                    target="_blank"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {preview && (
        <Modal>
          <h2 className="text-xl font-bold mb-4">{preview.date} Report</h2>
          <pre className="bg-gray-100 p-4 rounded mb-4 text-xs overflow-auto max-h-96">
            {JSON.stringify(preview, null, 2)}
          </pre>
          <div className="flex gap-3">
            <a 
              href={`/api/reports/${preview.id}/pdf`} 
              target="_blank"
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Download PDF
            </a>
            <button 
              onClick={() => setPreview(null)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
