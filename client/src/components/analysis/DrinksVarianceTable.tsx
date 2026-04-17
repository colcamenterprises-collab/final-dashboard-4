import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface DrinkVarianceRow {
  item_name: string;
  sku: string | null;
  category: string;
  starting_stock: number;
  purchased: number;
  items_sold: number;
  modifier_sold: number;
  end_stock: number;
  adjustment: number;
  variance: number;
}

interface DrinksVarianceResponse {
  ok: boolean;
  date: string;
  prev_date: string;
  row_count: number;
  data: DrinkVarianceRow[];
}

interface Props {
  date: string;
}

export default function DrinksVarianceTable({ date }: Props) {
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  const { data, isLoading, isError } = useQuery<DrinksVarianceResponse>({
    queryKey: ['/api/analysis/drinks-variance', date],
    queryFn: () =>
      fetch(`/api/analysis/drinks-variance?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  function getAdjustment(itemName: string): number {
    return adjustments[itemName] ?? 0;
  }

  function calcVariance(row: DrinkVarianceRow): number {
    return (
      row.starting_stock +
      row.purchased -
      row.items_sold -
      row.modifier_sold -
      row.end_stock +
      getAdjustment(row.item_name)
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded p-4 mb-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-800">Drinks Stock Variance</h2>
        <span className="text-xs text-slate-500">{date}</span>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-xs text-red-600">Failed to load drinks variance data.</p>
      )}

      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <p className="text-xs text-slate-500">No drinks data available for {date}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Item name</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">SKU</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Category</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Starting Stock</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Purchased</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Items Sold</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Modifier Sold</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">End Stock</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Adjustment</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => {
                    const adj = getAdjustment(row.item_name);
                    const variance = calcVariance(row);
                    return (
                      <tr
                        key={row.item_name}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      >
                        <td className="px-2 py-1.5 text-slate-800 font-medium whitespace-nowrap">{row.item_name}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500 tabular-nums">{row.sku ?? '—'}</td>
                        <td className="px-2 py-1.5 text-center text-slate-600">{row.category}</td>
                        <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.starting_stock}</td>
                        <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.purchased}</td>
                        <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.items_sold}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500 tabular-nums">{row.modifier_sold}</td>
                        <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.end_stock}</td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            value={adj}
                            onChange={(e) =>
                              setAdjustments((prev) => ({
                                ...prev,
                                [row.item_name]: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                            className="w-16 text-center text-xs border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className={`px-2 py-1.5 text-center font-semibold tabular-nums ${
                          variance > 0
                            ? 'text-red-600'
                            : variance < 0
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}>
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Variance = Starting Stock + Purchased &minus; Items Sold &minus; Modifier Sold &minus; End Stock + Adjustment.
            Starting stock sourced from {data.prev_date} end stock.
          </p>
        </>
      )}
    </div>
  );
}
