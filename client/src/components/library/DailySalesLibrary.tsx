import { useState, useEffect } from "react";
import { fmtB, fmtDate } from "@/lib/format";

interface LibraryRecord {
  id: string;
  dateISO: string;
  staff: string;
  startingCash: number;
  closingCash: number;
  totalSales: number;
  totalExpenses: number;
  bankCash: number;
  bankQr: number;
  status: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DailySalesLibrary() {
  const [data, setData] = useState<{ data: LibraryRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetcher("/api/library/daily-sales");
        setData(result);
      } catch (error) {
        console.error("Failed to load library data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="p-4 text-sm">Loading library...</div>;
  }

  const rows = data?.data ?? [];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Daily Sales Library</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Date</th>
            <th>Staff</th>
            <th className="text-right">Cash Start</th>
            <th className="text-right">Cash End</th>
            <th className="text-right">Total Sales</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: LibraryRecord) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{fmtDate(r.dateISO)}</td>
              <td>{r.staff}</td>
              <td className="text-right">{fmtB(r.startingCash)}</td>
              <td className="text-right">{fmtB(r.closingCash)}</td>
              <td className="text-right">{fmtB(r.totalSales)}</td>
              <td className="text-right">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}