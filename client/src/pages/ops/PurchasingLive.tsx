import React, { useEffect, useMemo, useState } from 'react';
import { getPurchasingPlan, Need } from '@/lib/purchasingApi';

type Ingredient = {
  id: string;
  name: string;
  supplier?: string | null;
  purchaseUnit?: string | null;
  purchaseQty?: number | null;
  packageCost?: number | null;
  portionUnit?: string | null;
  portionQty?: number | null;
};

export default function PurchasingLive() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [rows, setRows] = useState<Array<{ingredientId: string; qty: number; unit: 'kg'|'g'|'L'|'ml'|'each'}>>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/ingredients'); // assumes our enriched route or fallback returning items
        const j = await r.json();
        const items: Ingredient[] = (j.items ?? j) as any;
        setIngredients(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!onlyMissing) return ingredients;
    return ingredients.filter(i => !i.purchaseUnit || !i.purchaseQty || !i.packageCost);
  }, [ingredients, onlyMissing]);

  const addRow = (id?: string) => {
    const first = id ?? ingredients[0]?.id ?? '';
    setRows(prev => [...prev, { ingredientId: first, qty: 1, unit: 'kg' }]);
  };

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const buildPlan = async () => {
    const needs: Need[] = rows.map(r => ({ ingredientId: r.ingredientId, requiredQty: Number(r.qty) || 0, requiredUnit: r.unit }));
    const plan = await getPurchasingPlan(needs);
    alert(JSON.stringify(plan, null, 2)); // quick visibility; wire to your UI table as needed
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-extrabold">Purchasing & Ingredients (Live)</h1>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
          Show Missing Pack Data
        </label>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={() => addRow()}>Add Need</button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Ingredient</th>
              <th className="p-2 text-left">Supplier</th>
              <th className="p-2 text-left">Pack Size</th>
              <th className="p-2 text-left">Pack Cost (THB)</th>
              <th className="p-2 text-left">Portion (Costing)</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-2" colSpan={6}>Loading…</td></tr>
            )}
            {!loading && filtered.map(i => {
              const packOk = !!i.purchaseUnit && !!i.purchaseQty && !!i.packageCost;
              return (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.name}</td>
                  <td className="p-2">{i.supplier ?? '-'}</td>
                  <td className="p-2">{packOk ? `${i.purchaseQty} ${i.purchaseUnit}` : '-'}</td>
                  <td className="p-2">{packOk ? Number(i.packageCost).toFixed(2) : '-'}</td>
                  <td className="p-2">{i.portionQty ? `${i.portionQty} ${i.portionUnit ?? ''}` : '-'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${packOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {packOk ? 'Pack OK' : 'Missing Pack'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="font-bold">Quick Plan Builder</h2>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <select className="border rounded p-2"
                      value={r.ingredientId}
                      onChange={e => setRows(prev => prev.map((x,i)=>i===idx?{...x,ingredientId:e.target.value}:x))}>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input className="border rounded p-2 w-24" type="number" min="0" step="0.01"
                     value={r.qty}
                     onChange={e => setRows(prev => prev.map((x,i)=>i===idx?{...x,qty:Number(e.target.value)}:x))}/>
              <select className="border rounded p-2"
                      value={r.unit}
                      onChange={e => setRows(prev => prev.map((x,i)=>i===idx?{...x,unit:e.target.value as any}:x))}>
                <option>kg</option><option>g</option><option>L</option><option>ml</option><option>each</option>
              </select>
              <button className="px-3 py-2 rounded border" onClick={() => removeRow(idx)}>Remove</button>
            </div>
          ))}
        </div>
        {rows.length > 0 && (
          <button className="px-3 py-2 rounded bg-black text-white" onClick={buildPlan}>Build Plan</button>
        )}
      </div>
    </div>
  );
}
