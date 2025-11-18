import React from "react";

export type StockItemQty = { id: string; label: string; qty: number; unit?: string };
export type CategoryBlock = { category: string; items: StockItemQty[] };

export function StockGrid({
  blocks,
  onChange,
}: {
  blocks: CategoryBlock[];
  onChange: (id: string, qty: number) => void;
}) {
  // Helper function for safe integer parsing
  const safeInt = (v: string) => {
    const n = parseInt((v ?? '').toString().replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <details data-accordion="catalog" key={block.category} className="rounded-[4px] border border-slate-200">
          <summary className="cursor-pointer select-none px-4 py-2 font-medium text-sm text-slate-700">
            {block.category}
          </summary>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {block.items.map((item) => (
                <div key={item.id} className="rounded-[4px] border border-slate-200 p-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{item.label}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    className="w-full rounded-[4px] border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={item.qty ?? 0}
                    onChange={(e) => onChange(item.id, safeInt(e.target.value))}
                    aria-label={`${item.label} quantity`}
                  />
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}