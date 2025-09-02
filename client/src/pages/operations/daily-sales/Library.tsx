// Do not do this:
// – Do not rename, move, or split this file
// – Do not change API routes
// – Do not add dependencies
// – Only apply exactly what is written below

import React, { useEffect, useState } from "react";

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type RecordType = {
  id: string;
  date: string;
  staff: string;
  cashStart: number;
  cashEnd: number;
  totalSales: number;
  buns: string;
  meat: string;
  status: string;
  payload: {
    balanced: boolean;
  };
};

export default function DailySalesLibrary() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch("/api/forms/daily-sales/v2");
        const data = await res.json();
        if (data.ok && data.records) {
          setRecords(data.records);
        } else {
          setError("No records found");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold font-[Poppins] mb-4">
        Daily Sales Library
      </h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
            <th className="p-2 border-b">Date</th>
            <th className="p-2 border-b">Staff</th>
            <th className="p-2 border-b">Cash Start</th>
            <th className="p-2 border-b">Cash End</th>
            <th className="p-2 border-b">Total Sales</th>
            <th className="p-2 border-b">Buns (End)</th>
            <th className="p-2 border-b">Meat (End)</th>
            <th className="p-2 border-b">Status</th>
            <th className="p-2 border-b">Balanced</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={9} className="p-4 text-center text-gray-500">
                No records found
              </td>
            </tr>
          ) : (
            records.map((rec) => (
              <tr key={rec.id} className="text-sm font-[Poppins]">
                <td className="p-2 border-b">
                  {new Date(rec.date).toLocaleDateString()}
                </td>
                <td className="p-2 border-b">{rec.staff}</td>
                <td className="p-2 border-b">{thb(rec.cashStart)}</td>
                <td className="p-2 border-b">{thb(rec.cashEnd)}</td>
                <td className="p-2 border-b">{thb(rec.totalSales)}</td>
                <td className="p-2 border-b">{rec.buns}</td>
                <td className="p-2 border-b">{rec.meat}</td>
                <td className="p-2 border-b">{rec.status}</td>
                <td className="p-2 border-b">
                  {rec.payload.balanced ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700">
                      Balanced
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700">
                      Not Balanced
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}