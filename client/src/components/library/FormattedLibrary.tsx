/**
 * Example usage of the new formatters as specified in the to-do document
 */
import { useState, useEffect } from "react";
import { fmtB, fmtDate } from "@/lib/format";

interface LibraryRecord {
  id: string;
  dateISO: string;
  staff: string;
  startingCash: number;
  closingCash: number;
  totalSales: number;
  status: string;
}

export default function FormattedLibrary() {
  const [data, setData] = useState<LibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/library/daily-sales");
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Failed to load library data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="p-4 text-sm">Loading...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Daily Sales Library (Formatted)</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Staff</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 uppercase tracking-wider">Cash Start</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 uppercase tracking-wider">Cash End</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 uppercase tracking-wider">Total Sales</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900">{fmtDate(record.dateISO)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{record.staff}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmtB(record.startingCash)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmtB(record.closingCash)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmtB(record.totalSales)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    record.status === 'Completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}