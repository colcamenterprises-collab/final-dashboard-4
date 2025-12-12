import React, { useEffect, useState } from 'react';
import { fetchWithLegacyFallback } from '@/lib/api';
import { LegacyDataAlert } from '@/components/ui/legacy-data-alert';

type Expense = {
  id: string; expenseDate: string; type: 'PURCHASE'|'GENERAL'|'WAGE';
  supplier?: string | null; notes?: string | null; totalTHB: number;
  lines: { id:string; name:string; qty?:number; uom?:string; lineTotalTHB?:number }[];
};

const currency = (n:number)=> new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(n);

export default function ExpensesList() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [source, setSource] = useState<'v2' | 'legacy'>('v2');

  useEffect(()=>{(async()=>{
    try{
      setErr(null); setLoading(true);
      const result = await fetchWithLegacyFallback<Expense>(
        '/api/expensesV2',
        '/api/legacy-bridge/expenses'
      );
      setRows(result.rows);
      setSource(result.source);
    }catch(e:any){setErr(e.message)}finally{setLoading(false)}
  })()},[]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Purchasing</h1>
        <a href="/finance/expenses/new" className="rounded-lg bg-gray-900 text-white text-sm px-4 py-2">+ New Purchase</a>
      </div>
      {err ? <div className="rounded border bg-rose-50 p-4 text-rose-700">{err}</div> : null}
      <LegacyDataAlert source={source} />
      <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_2px_16px_rgba(16,24,40,.06)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Lines</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(r=>(
              <tr key={r.id} className="border-t">
                <td className="py-3 px-4 text-gray-900">{new Date(r.expenseDate).toLocaleString('en-GB',{timeZone:'Asia/Bangkok'})}</td>
                <td className="py-3 px-4 text-gray-700">{r.supplier ?? '—'}</td>
                <td className="py-3 px-4 text-gray-700">{r.type}</td>
                <td className="py-3 px-4 text-gray-500">{r.lines?.length ?? 0}</td>
                <td className="py-3 px-4 font-medium text-gray-900">{currency(r.totalTHB ?? 0)}</td>
                <td className="py-3 px-4"><a className="text-xs underline text-gray-700" href={`/finance/expenses/${r.id}`}>Open</a></td>
              </tr>
            ))}
            {!rows.length && !loading && (<tr><td className="py-6 px-4 text-gray-500" colSpan={6}>No purchases yet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}