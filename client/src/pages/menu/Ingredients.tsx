import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Package } from "lucide-react";

interface Ingredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  portionUnit: string;
  baseUnit: string;
  unitCostPerBase: number;
}

export default function Ingredients() {
  const [search, setSearch] = useState("");

  const { data: ingredients = [], isLoading, isError } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const filtered = ingredients.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = filtered.reduce<Record<string, Ingredient[]>>((acc, ing) => {
    const cat = ing.category || "Uncategorised";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Ingredients</h1>
          <p className="text-xs text-slate-500">{ingredients.length} ingredients total</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search ingredients or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading ingredients...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load ingredients.</div>
      )}

      {!isLoading && !isError && Object.keys(byCategory).length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No ingredients found.</div>
      )}

      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
        <div key={category} className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <Package className="h-3 w-3 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{category}</span>
            <span className="text-xs text-slate-400">({items.length})</span>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Cost / Base Unit</th>
                </tr>
              </thead>
              <tbody>
                {items.sort((a, b) => a.name.localeCompare(b.name)).map((ing, idx) => (
                  <tr
                    key={ing.id}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{ing.name}</td>
                    <td className="px-3 py-2 text-slate-500">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ing.baseUnit || ing.unit}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      ฿{ing.unitCostPerBase?.toFixed(2) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
