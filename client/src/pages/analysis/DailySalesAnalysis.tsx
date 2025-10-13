import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface DailySalesRow {
  id: string;
  shift_date: string;
  completed_by: string;
  total_sales: number;
  cash_sales: number;
  qr_sales: number;
  grab_sales: number;
  aroi_sales: number;
  shopping_total: number;
  wages_total: number;
  others_total: number;
  total_expenses: number;
  rolls_end: number;
  meat_end_g: number;
}

export default function DailySalesAnalysis() {
  const [exportDate, setExportDate] = useState("");

  const { data: rows = [], isLoading } = useQuery<DailySalesRow[]>({
    queryKey: ['/api/analysis/daily-sales'],
  });

  const handleDateExport = () => {
    if (exportDate) {
      window.open(`/api/analysis/daily-sales/export.csv?date=${exportDate}`, '_blank');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Daily Sales Analysis</h1>
      
      {/* Date Export Control */}
      <div className="mt-2 mb-4 flex items-center gap-2 text-xs sm:text-sm">
        <input
          id="export-by-date"
          type="date"
          value={exportDate}
          onChange={(e) => setExportDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          onClick={handleDateExport}
          className="border rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={!exportDate}
        >
          Export by Date (CSV)
        </button>
      </div>

      {isLoading && <p className="text-sm">Loading...</p>}

      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-gray-500">No data available</p>
      )}

      {/* Desktop Table */}
      {!isLoading && rows.length > 0 && (
        <div className="overflow-x-scroll" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' } as React.CSSProperties}>
          <table style={{ minWidth: '1400px' }} className="border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Completed By</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Cash</th>
                <th className="px-2 py-2 text-right">QR</th>
                <th className="px-2 py-2 text-right">Grab</th>
                <th className="px-2 py-2 text-right">Other</th>
                <th className="px-2 py-2 text-right">Shopping</th>
                <th className="px-2 py-2 text-right">Wages</th>
                <th className="px-2 py-2 text-right">Other Exp</th>
                <th className="px-2 py-2 text-right">Tot Exp</th>
                <th className="px-2 py-2 text-right">Rolls</th>
                <th className="px-2 py-2 text-right">Meat (g)</th>
                <th className="px-2 py-2 text-right">Export</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2">{r.shift_date}</td>
                  <td className="px-2 py-2">{r.completed_by}</td>
                  <td className="px-2 py-2 text-right">{r.total_sales.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.cash_sales.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.qr_sales.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.grab_sales.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.aroi_sales.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.shopping_total.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.wages_total.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.others_total.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.total_expenses.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.rolls_end}</td>
                  <td className="px-2 py-2 text-right">{r.meat_end_g}</td>
                  <td className="px-2 py-2 text-right">
                    <a
                      className="underline text-xs text-emerald-600 hover:text-emerald-700"
                      href={`/api/analysis/daily-sales/export.csv?id=${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Export CSV
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
