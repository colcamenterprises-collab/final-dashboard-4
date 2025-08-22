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
  pdfPath?: string;
  type?: string;
  rolls?: number;
  meatGrams?: number;
  shiftId?: string;
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
            <th>Type</th>
            <th>Staff</th>
            <th className="text-right">Cash Start</th>
            <th className="text-right">Cash End</th>
            <th className="text-right">Total Sales</th>
            <th className="text-right">Status</th>
            <th className="text-right">PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: LibraryRecord) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{fmtDate(r.dateISO)}</td>
              <td>
                <span className={`px-2 py-1 text-xs rounded ${
                  r.type === "stock" 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-green-100 text-green-800"
                }`}>
                  {r.type === "stock" ? "Stock" : "Sales"}
                </span>
              </td>
              <td>{r.staff}</td>
              <td className="text-right">
                {r.type === "stock" ? 
                  `${r.rolls} rolls` : 
                  fmtB(r.startingCash)
                }
              </td>
              <td className="text-right">
                {r.type === "stock" ? 
                  `${r.meatGrams}g meat` : 
                  fmtB(r.closingCash)
                }
              </td>
              <td className="text-right">{fmtB(r.totalSales)}</td>
              <td className="text-right">{r.status}</td>
              <td className="text-right">
                {r.pdfPath ? (
                  <a href={r.pdfPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    View PDF
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}