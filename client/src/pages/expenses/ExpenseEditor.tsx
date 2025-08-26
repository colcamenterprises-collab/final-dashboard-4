import React, { useEffect, useMemo, useState } from 'react';
import { IngredientSearch } from './IngredientSearch';

type Line = { id?:string; ingredientId?:string|null; name:string; qty?:number|null; uom?:string|null; unitPriceTHB?:number|null; lineTotalTHB?:number|null };
const currency = (n:number)=> new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(n);

export default function ExpenseEditor() {
  const [id, setId] = useState<string|undefined>(undefined); // if /:id, parse from router
  const [shiftDate, setShiftDate] = useState<string>(()=>new Date().toISOString());
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ name:'', qty:null, uom:null, unitPriceTHB:null, lineTotalTHB:null }]);
  const [showFinderIdx, setShowFinderIdx] = useState<number|null>(null);
  const total = useMemo(()=>lines.reduce((s,l)=> s + (l.lineTotalTHB ?? ((l.qty||0)*(l.unitPriceTHB||0))),0),[lines]);

  function updateLine(i:number, patch:Partial<Line>) {
    setLines(prev => prev.map((l,idx)=> idx===i ? {...l, ...patch} : l));
  }
  function addLine() { setLines(prev => [...prev, { name:'', qty:null, uom:null, unitPriceTHB:null, lineTotalTHB:null }]); }
  function removeLine(i:number) { setLines(prev => prev.filter((_,idx)=> idx!==i)); }

  async function save() {
    const body = {
      id, shiftDate, supplier, notes, type:'PURCHASE',
      lines: lines.filter(l => l.name.trim()).map(l => ({
        ingredientId: l.ingredientId ?? null,
        name: l.name.trim(),
        qty: l.qty!=null? Number(l.qty): null,
        uom: l.uom ?? null,
        unitPriceTHB: l.unitPriceTHB!=null? Number(l.unitPriceTHB): null,
        lineTotalTHB: l.lineTotalTHB!=null? Number(l.lineTotalTHB): null,
      })),
    };
    const res = await fetch('/api/expensesV2', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { alert('Save failed'); return; }
    const out = await res.json();
    window.location.href = '/finance/expenses';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Edit Purchase' : 'New Purchase'}</h1>
        <div className="text-sm text-gray-500">Total: <span className="tabular-nums font-semibold text-gray-900">{currency(total)}</span></div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_2px_16px_rgba(16,24,40,.06)] md:col-span-1">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-700 mb-1">Date</div>
              <input type="datetime-local" value={shiftDate.slice(0,16)} onChange={e=>setShiftDate(new Date(e.target.value).toISOString())} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>
            <div>
              <div className="text-gray-700 mb-1">Supplier</div>
              <input value={supplier} onChange={e=>setSupplier(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="e.g. Makro Rawai" />
            </div>
            <div>
              <div className="text-gray-700 mb-1">Notes</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" rows={3} placeholder="Optional notes" />
            </div>
            <button onClick={save} className="mt-2 w-full rounded-lg bg-gray-900 text-white text-sm px-4 py-2">Save & Recompute</button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_2px_16px_rgba(16,24,40,.06)] md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Lines</h3>
            <button onClick={addLine} className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700">+ Add line</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Ingredient / Name</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">UOM</th>
                  <th className="py-2">Unit Price</th>
                  <th className="py-2">Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-2 pr-2">
                      <div className="flex gap-2">
                        <button onClick={()=>setShowFinderIdx(i)} className="rounded border border-gray-200 px-2 text-gray-700">🔍</button>
                        <input className="w-full rounded border border-gray-200 px-2 py-1" placeholder="Buns Pack / Ground Beef / Water…" value={l.name} onChange={e=>updateLine(i,{name:e.target.value})} />
                      </div>
                      {l.ingredientId ? <div className="text-xs text-emerald-600 mt-1">Linked to ingredient</div> : <div className="text-xs text-gray-500 mt-1">Free text (not linked)</div>}
                    </td>
                    <td className="py-2 pr-2"><input type="number" className="w-24 rounded border border-gray-200 px-2 py-1" value={l.qty ?? ''} onChange={e=>updateLine(i,{qty: e.target.value === '' ? null : Number(e.target.value)})} /></td>
                    <td className="py-2 pr-2"><input className="w-24 rounded border border-gray-200 px-2 py-1" value={l.uom ?? ''} onChange={e=>updateLine(i,{uom:e.target.value})} placeholder="unit/g/ml" /></td>
                    <td className="py-2 pr-2"><input type="number" className="w-28 rounded border border-gray-200 px-2 py-1" value={l.unitPriceTHB ?? ''} onChange={e=>updateLine(i,{unitPriceTHB: e.target.value === '' ? null : Number(e.target.value)})} /></td>
                    <td className="py-2 pr-2 font-medium text-gray-900">{currency(l.lineTotalTHB ?? ((l.qty||0)*(l.unitPriceTHB||0)))}</td>
                    <td className="py-2"><button onClick={()=>removeLine(i)} className="text-rose-600 text-sm">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showFinderIdx!=null && (
        <IngredientSearch
          onClose={()=>setShowFinderIdx(null)}
          onPick={(ing)=>{ updateLine(showFinderIdx, { ingredientId: ing.id, name: ing.name, uom: ing.uom ?? null }); setShowFinderIdx(null); }}
        />
      )}
    </div>
  );
}