import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface ShoppingItem {
  name: string;
  unit?: string;
  quantity?: number;
  category?: string;
  estimatedCost?: number;
}

interface Blocker {
  code: string;
  message: string;
}

interface ShoppingListResponse {
  groupedList: Record<string, ShoppingItem[]>;
  source: string;
  totalItems: number;
  blockers?: Blocker[];
}

export default function ShoppingList() {
  const { data, isLoading, isError } = useQuery<ShoppingListResponse>({
    queryKey: ["/api/shopping-list"],
  });

  const groups = data?.groupedList ?? {};
  const categories = Object.keys(groups);
  const blockers = data?.blockers ?? [];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shopping List</h1>
          <p className="text-xs text-slate-500">
            {data?.totalItems ?? 0} items · Source: {data?.source ?? "—"}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading shopping list...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load shopping list.</div>
      )}

      {!isLoading && !isError && blockers.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 rounded-lg">
          <p className="font-semibold">Data unavailable</p>
          {blockers.map((blocker) => (
            <p key={blocker.code}>{blocker.code}: {blocker.message}</p>
          ))}
        </div>
      )}

      {!isLoading && !isError && blockers.length === 0 && categories.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <ShoppingCart className="h-10 w-10 opacity-30" />
          <p className="text-xs">Shopping list is empty.</p>
          <p className="text-[11px] text-slate-300">Items appear here when stock levels are low.</p>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{groups[cat].length}</Badge>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Qty</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Est. Cost (฿)</th>
                </tr>
              </thead>
              <tbody>
                {groups[cat].map((item, idx) => (
                  <tr
                    key={`${cat}-${idx}`}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{item.quantity ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{item.unit ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {item.estimatedCost != null ? `฿${item.estimatedCost.toFixed(2)}` : "—"}
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
