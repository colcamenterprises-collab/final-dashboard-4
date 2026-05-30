import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Calculator } from "lucide-react";

interface FoodCosting {
  key: string;
  name: string;
  supplier: string;
  cost: number;
  unit: string;
  portions: number;
}

export default function CostCalculator() {
  const [search, setSearch] = useState("");

  const { data: costings = [], isLoading, isError } = useQuery<FoodCosting[]>({
    queryKey: ["/api/food-costings"],
  });

  const filtered = costings.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.supplier || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Calculator className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Cost Calculator</h1>
          <p className="text-xs text-slate-500">{costings.length} items with cost data</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading cost data...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load cost data.</div>
      )}

      {!isLoading && !isError && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Item</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Pack Cost (฿)</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Portions</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Cost / Portion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
              {filtered.map((item, idx) => {
                const perPortion = item.portions > 0 ? item.cost / item.portions : null;
                return (
                  <tr
                    key={item.key}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-3 py-2 text-slate-500">{item.supplier || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      ฿{item.cost?.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{item.portions}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {perPortion !== null ? `฿${perPortion.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
