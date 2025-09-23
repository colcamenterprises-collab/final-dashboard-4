import React, { useEffect, useState } from "react";

export default function DailyShiftAnalysis() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/pos/summary/2025-09-19`) // TODO: dynamic date selector
      .then(res => res.json())
      .then(setSummary);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Daily Shift Analysis</h2>

      {!summary && <p>Loading...</p>}

      {summary && (
        <table className="table-auto border w-full text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Field</th>
              <th className="p-2">POS Report</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary).map(([key, value]) => (
              <tr key={key}>
                <td className="p-2 font-medium">{key}</td>
                <td className="p-2">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}