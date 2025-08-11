import React, { useEffect, useState } from 'react';

export function IngredientSearch({ onClose, onPick }: { onClose:()=>void; onPick:(ing:any)=>void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{ (async()=>{
    if(!q.trim()) { setRows([]); return; }
    const r = await fetch('/api/ingredients/search?q='+encodeURIComponent(q));
    if(r.ok) setRows(await r.json());
  })() },[q]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Find Ingredient</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <input autoFocus placeholder="Search ingredient…" className="w-full rounded-lg border px-3 py-2 mb-3" value={q} onChange={e=>setQ(e.target.value)} />
        <div className="max-h-80 overflow-auto divide-y">
          {rows.map((r:any)=>(
            <button key={r.id} onClick={()=>onPick(r)} className="w-full text-left px-2 py-3 hover:bg-gray-50">
              <div className="font-medium text-gray-900">{r.name}</div>
              <div className="text-xs text-gray-500">{r.category || '—'} · {r.uom || 'unit'}</div>
            </button>
          ))}
          {!rows.length && <div className="text-sm text-gray-500 p-3">Start typing to search…</div>}
        </div>
      </div>
    </div>
  );
}