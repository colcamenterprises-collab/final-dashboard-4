import React, { useEffect, useState } from "react";
import { formatDateDDMMYYYY } from "@/lib/format";

type RollsRow = {
  shift_date: string;
  rolls_start: number;
  rolls_purchased: number;
  burgers_sold: number;
  estimated_rolls_end: number;
  actual_rolls_end: number | null;
  variance: number;
  status: 'PENDING' | 'OK' | 'ALERT';
};

export default function RollsLedger() {
  const [rows, setRows] = useState<RollsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analysis/rolls-ledger/history')
      .then(r => r.json())
      .then(json => setRows(json?.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRebuildAll() {
    if (!confirm('Rebuild all 14 days of rolls ledger?')) return;
    setLoading(true);
    await fetch('/api/analysis/rolls-ledger/backfill-14', { method: 'POST' });
    const resp = await fetch('/api/analysis/rolls-ledger/history').then(r=>r.json());
    setRows(resp?.rows ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Rolls Ledger</h1>
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Rolls Ledger</h1>
        <button
          onClick={handleRebuildAll}
          className="px-4 py-2 rounded-[4px] bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 min-h-[44px] active:scale-95 transition-transform"
          data-testid="button-rebuild-all"
        >
          Rebuild All (14 Days)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs bg-white rounded-[4px] border border-slate-200">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Start</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Purchased</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Burgers Sold</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Est. End</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Actual End</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Variance</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.shift_date} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-900">{formatDateDDMMYYYY(row.shift_date)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.rolls_start}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.rolls_purchased}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.burgers_sold}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.estimated_rolls_end}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.actual_rolls_end ?? '—'}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {row.actual_rolls_end !== null ? (
                    <span className={row.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {row.variance >= 0 ? '+' : ''}{row.variance}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-1 rounded-[4px] text-xs font-medium ${
                    row.status === 'OK' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : row.status === 'ALERT' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-slate-600">
          No rolls ledger data found. Click "Rebuild All (14 Days)" to populate.
        </div>
      )}
    </div>
  );
}
