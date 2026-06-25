import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface ShoppingItem {
  name: string;
  unit?: string;
  quantity?: number;
  category?: string;
  estimatedCost?: number | null;
  lineTotal?: number | null;
  estCost?: number | null;
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

const formatBaht = (amount: number) =>
  `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getRowEstimatedTotal(item: ShoppingItem): number | null {
  const value = item.lineTotal ?? item.estimatedCost ?? item.estCost;
  const amount = typeof value === "number" ? value : Number(value);

  return Number.isFinite(amount) ? amount : null;
}

function getSectionCost(items: ShoppingItem[]) {
  return items.reduce(
    (summary, item) => {
      const rowTotal = getRowEstimatedTotal(item);

      if (rowTotal == null) {
        summary.hasMissingCost = true;
        return summary;
      }

      summary.total += rowTotal;
      return summary;
    },
    { total: 0, hasMissingCost: false },
  );
}

function ShoppingListTable({ items, category }: { items: ShoppingItem[]; category: string }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[52%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <th className="text-left px-3 py-2 font-medium text-slate-500">Item</th>
            <th className="text-right px-3 py-2 font-medium text-slate-500">Qty</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
            <th className="text-right px-3 py-2 font-medium text-slate-500">Est. Cost (฿)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rowTotal = getRowEstimatedTotal(item);

            return (
              <tr
                key={`${category}-${idx}`}
                className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 break-words">
                  {item.name}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">{item.quantity ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500 break-words">{item.unit ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">
                  {rowTotal != null ? formatBaht(rowTotal) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ShoppingList() {
  const { data, isLoading, isError } = useQuery<ShoppingListResponse>({
    queryKey: ["/api/shopping-list"],
  });

  const groups = data?.groupedList ?? {};
  const categories = Object.keys(groups);
  const blockers = data?.blockers ?? [];
  const costSummary = Object.values(groups).reduce(
    (summary, items) => {
      const section = getSectionCost(items);
      summary.total += section.total;
      summary.hasMissingCost = summary.hasMissingCost || section.hasMissingCost;
      return summary;
    },
    { total: 0, hasMissingCost: false },
  );

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Shopping List</h1>
          <p className="text-xs text-slate-500">
            {data?.totalItems ?? 0} items · Total Estimated Cost: {formatBaht(costSummary.total)} ·
            Source: {data?.source ?? "—"}
          </p>
          {costSummary.hasMissingCost && (
            <p className="text-[11px] text-amber-600">Some items have no estimated cost.</p>
          )}
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

      {categories.map((cat) => {
        const sectionCost = getSectionCost(groups[cat]);

        return (
          <div key={cat} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {groups[cat].length}
              </Badge>
              <span className="text-[11px] font-medium text-slate-500">
                Subtotal: {formatBaht(sectionCost.total)}
              </span>
            </div>
            <ShoppingListTable items={groups[cat]} category={cat} />
          </div>
        );
      })}
    </div>
  );
}
