import React, { useEffect, useState } from 'react';

export default function AnalysisList() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{(async()=>{
    try {
      setLoading(true);
      const r = await fetch('/api/analysis/list', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('Failed to load analysis data');
      setRows(await r.json());
    } catch(e:any){ 
      setErr(e.message); 
    } finally {
      setLoading(false);
    }
  })()},[]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200 mb-4" />
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (err) return <div className="p-6 text-rose-700">Error loading analysis: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Analysis</h1>
        <div className="text-sm text-gray-500">Last 14 shift snapshots</div>
      </div>
      
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="py-3 px-4">Shift Window (Bangkok Time)</th>
              <th className="py-3 px-4">Sales Revenue</th>
              <th className="py-3 px-4">Receipts</th>
              <th className="py-3 px-4">Reconcile State</th>
              <th className="py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.id} className={`border-t ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="py-3 px-4">
                  <div className="font-medium">
                    {new Date(r.windowStartUTC).toLocaleDateString('en-GB', { 
                      timeZone: 'Asia/Bangkok', 
                      year: 'numeric', 
                      month: 'short', 
                      day: '2-digit' 
                    })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(r.windowStartUTC).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })} → {' '}
                    {new Date(r.windowEndUTC).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })}
                  </div>
                </td>
                <td className="py-3 px-4 tabular-nums font-medium">
                  ฿{r.totalSalesTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 tabular-nums">{r.totalReceipts}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    r.reconcileState === 'OK' ? 'bg-emerald-100 text-emerald-700'
                    : r.reconcileState === 'MISSING_DATA' ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                  }`}>
                    {r.reconcileState}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <a 
                    className="text-blue-600 hover:text-blue-800 underline text-sm" 
                    href={`/analysis/${r.id}`}
                  >
                    View Details
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {rows.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No shift snapshots found. Complete some shifts to see analysis data.
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 text-center">
        Analysis shows the last 14 completed shift snapshots with purchases-aware variance calculations.
      </div>
    </div>
  );
}