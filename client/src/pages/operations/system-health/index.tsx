import { useEffect, useState } from "react";
import axios from "axios";

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios.get("/api/system-health/run")
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  const Status = ({ pass }: { pass: boolean }) => (
    <span
      className={
        "px-2 py-1 text-sm font-bold rounded " +
        (pass ? "bg-green-500 text-black" : "bg-red-500 text-white")
      }
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );

  if (loading) return <div className="p-6">Running system health test…</div>;

  if (!data) return <div className="p-6">No data returned</div>;

  const r = data.results;

  return (
    <div className="p-6 font-[Poppins]">
      <h1 className="text-3xl font-extrabold mb-4">System Health Test</h1>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 border-4 border-black bg-yellow-300 shadow-lg">
          <h2 className="text-xl font-bold mb-3">Pipeline Status</h2>

          <ul className="space-y-2 text-lg">
            <li>Daily Sales Created: <Status pass={r.salesCreated} /></li>
            <li>Daily Stock Submitted: <Status pass={r.stockCreated} /></li>
            <li>Shopping List Generated: <Status pass={r.shoppingListGenerated} /></li>
            <li>Report Compiled: <Status pass={r.reportGenerated} /></li>
            <li>JSON Valid: <Status pass={r.jsonValid} /></li>
            <li>PDF Valid: <Status pass={r.pdfValid} /></li>
            <li>Report Listed: <Status pass={r.listValid} /></li>
          </ul>
        </div>

        {r.errors?.length > 0 && (
          <div className="p-4 border-4 border-red-600 bg-red-200 shadow-lg">
            <h2 className="text-xl font-bold mb-3">Errors</h2>
            <pre>{JSON.stringify(r.errors, null, 2)}</pre>
          </div>
        )}

        <div className="p-4 border-4 border-black bg-white shadow-lg">
          <h2 className="text-xl font-bold mb-3">Report ID</h2>
          <p>{data.reportId}</p>
          <a
            className="mt-3 inline-block px-4 py-2 bg-black text-yellow-300 font-bold"
            href={`/api/reports/${data.reportId}/pdf`}
            target="_blank"
          >
            View PDF
          </a>
        </div>
      </div>
    </div>
  );
}
