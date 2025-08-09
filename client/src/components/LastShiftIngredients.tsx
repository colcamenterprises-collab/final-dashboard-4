import React, { useEffect, useState } from 'react';

export default function LastShiftIngredients() {
  const [d, setD] = useState<any>(null);
  
  useEffect(() => { 
    fetch('/api/pos/ingredient-usage')
      .then(r => r.json())
      .then(setD)
      .catch(() => {}); 
  }, []);
  
  if (!d) return <div className="rounded-2xl border p-4">Loading ingredients…</div>;
  
  const u = d.usage || {};
  return (
    <div className="rounded-2xl border p-4">
      <div className="font-semibold">Ingredient usage (last shift)</div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Metric label="Buns (units)" value={u.bun || 0} />
        <Metric label="Meat (kg)" value={((u.patty_grams || 0) / 1000).toFixed(2)} />
        <Metric label="Fries (kg)" value={((u.fries_grams || 0) / 1000).toFixed(2)} />
        <Metric label="Cheese (kg)" value={((u.cheese_grams || 0) / 1000).toFixed(2)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}