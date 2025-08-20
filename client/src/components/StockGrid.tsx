import React from "react";

export type StockItemQty = { id: string; label: string; qty: number };
export type CategoryBlock = { category: string; items: StockItemQty[] };

export function StockGrid({
  blocks,
  onChange,
}: {
  blocks: CategoryBlock[];
  onChange: (id: string, qty: number) => void;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <details data-accordion="catalog" key={block.category} open className="rounded-lg border">
          <summary className="cursor-pointer select-none px-4 py-2 font-medium text-[14px]">
            {block.category}
          </summary>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {block.items.map((it) => (
                <div key={it.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                  <div className="text-[14px] font-medium leading-snug">{it.label}</div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="w-20 border rounded-md px-2 py-1 text-[14px]"
                    value={it.qty}
                    onChange={(e) => onChange(it.id, Number(e.target.value || 0))}
                    placeholder="0"
                    aria-label={`qty-${it.label}`}
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