import React, { useMemo, useState } from "react";
import { formatDateDDMMYYYY, convertFromInputDate } from "@/lib/format";

type ShiftItem = {
  sku: string | null;
  name: string;
  category: string; // Allow any category from Loyverse
  qty: number;
  patties?: number;
  red_meat_g?: number;
  redMeatGrams?: number;
  chicken_g?: number;
  chickenGrams?: number;
  rolls?: number;
};

type ShiftResp =
  | {
      ok: true;
      sourceUsed: "live" | "cache";
      shiftDate: string;
      fromISO: string;
      toISO: string;
      items: ShiftItem[];
      totalsByCategory?: Record<string, number>;
    }
  | {
      ok: true;
      sourceUsed: "cache";
      date: string;
      items: ShiftItem[];
    };

// Dynamic categories - extracted from actual data
type CatTab = "all" | string;

function fmt(n: number | undefined) {
  if (n == null) return "";
  return n.toLocaleString("en-US");
}

function getMeat(it: ShiftItem, keyA: keyof ShiftItem, keyB: keyof ShiftItem) {
  const a = it[keyA] as number | undefined;
  const b = it[keyB] as number | undefined;
  return a ?? b ?? 0;
}

export default function ShiftAnalyticsMM() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [sourceUsed, setSourceUsed] = useState<"live" | "cache" | "">("");
  const [fromISO, setFromISO] = useState("");
  const [toISO, setToISO] = useState("");
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [tab, setTab] = useState<CatTab>("all");
  const [error, setError] = useState<string>("");

  async function fetchJSON(url: string, init?: RequestInit) {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  async function loadShift() {
    setError("");
    setLoading(true);
    try {
      const res: ShiftResp = await fetchJSON(`/api/analysis/shift/items?date=${date}`);
      const used = ("sourceUsed" in res ? res.sourceUsed : "cache") as "live" | "cache";
      setSourceUsed(used);
      if ("shiftDate" in res) {
        setFromISO(res.fromISO);
        setToISO(res.toISO);
        setItems(res.items || []);
      } else {
        setFromISO("");
        setToISO("");
        setItems(res.items || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadShift();
  }, []);

  function exportCSV() {
    const headers = ["SKU", "Item", "Category", "Qty", "Patties", "RedMeat(g)", "Chicken(g)", "Rolls"];
    const rows = filtered.map((it) => [
      it.sku ?? "",
      it.name,
      it.category,
      it.qty,
      (it.patties ?? 0).toString(),
      getMeat(it, "red_meat_g", "redMeatGrams").toString(),
      getMeat(it, "chicken_g", "chickenGrams").toString(),
      (it.rolls ?? 0).toString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift-${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Extract unique categories from items
  const categories = useMemo(() => {
    const cats = new Set(items.map(x => x.category));
    return ["all", ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((x) => x.category === tab);
  }, [items, tab]);

  // Group items by category for display
  const itemsByCategory = useMemo(() => {
    const groups: Record<string, ShiftItem[]> = {};
    filtered.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filtered]);

  const totals = useMemo(() => {
    const totalQty = filtered.reduce((sum, it) => sum + (it.qty || 0), 0);
    const totalPatties = filtered.reduce((sum, it) => sum + (it.patties || 0), 0);
    const totalBeef = filtered.reduce((sum, it) => sum + getMeat(it, "red_meat_g", "redMeatGrams"), 0);
    const totalChicken = filtered.reduce((sum, it) => sum + getMeat(it, "chicken_g", "chickenGrams"), 0);
    const totalRolls = filtered.reduce((sum, it) => sum + (it.rolls || 0), 0);
    return { totalQty, totalPatties, totalBeef, totalChicken, totalRolls };
  }, [filtered]);

  return (
    <div className="max-w-7xl mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Header and Controls - with padding */}
      <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-base font-semibold">F&B Analysis</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
              Window: 5 PM → 3 AM (Bangkok)
            </span>
            {sourceUsed && (
              <span className={`px-2 py-1 rounded text-xs ${sourceUsed === "live" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {sourceUsed === "live" ? "Live Data" : "Cached"}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Shift date:</label>
            <span className="text-xs font-medium text-slate-900">{convertFromInputDate(date)}</span>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 sm:px-3 py-2 text-xs min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            data-testid="input-shift-date"
          />
          <button 
            onClick={loadShift} 
            disabled={loading} 
            className="px-3 sm:px-4 py-2 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
            data-testid="button-load-shift"
          >
            {loading ? "Loading…" : "Load Shift"}
          </button>
          <button 
            onClick={exportCSV} 
            className="px-3 sm:px-4 py-2 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
            data-testid="button-export-csv"
          >
            Export CSV
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`px-3 sm:px-4 py-2 rounded border text-xs font-medium whitespace-nowrap min-h-[44px] min-w-[44px] active:scale-95 transition-all ${
                tab === c 
                  ? "bg-emerald-600 text-white border-emerald-600" 
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
              data-testid={`tab-${c}`}
            >
              {c === "all" ? "ALL" : c.toUpperCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Table - Full Width Scrollable (no padding) */}
      <div 
        className="w-full overflow-x-auto overflow-y-visible bg-white" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollBehavior: 'smooth'
        }}
      >
        <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="border-b border-slate-300">
              <th className="hidden sm:table-cell px-2 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">SKU</th>
              <th className="px-2 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">Item</th>
              <th className="hidden md:table-cell px-2 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">Category</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">Qty</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">Patties</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">Beef (g)</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">Chicken (g)</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
              <React.Fragment key={category}>
                {/* Category Header Row */}
                <tr className="bg-emerald-50 border-t border-emerald-200">
                  <td colSpan={8} className="px-2 py-2 font-semibold text-emerald-900 text-xs uppercase tracking-wide">
                    {category} ({categoryItems.length} items)
                  </td>
                </tr>
                {/* Items in this category */}
                {categoryItems.map((it, idx) => (
                  <tr 
                    key={`${category}-${it.sku ?? it.name}-${idx}`} 
                    className="border-b border-slate-200 hover:bg-slate-50"
                    data-testid={`row-item-${category}-${idx}`}
                  >
                    <td className="hidden sm:table-cell px-2 py-2 font-mono text-slate-600 text-[10px] sm:text-xs whitespace-nowrap">{it.sku ?? "—"}</td>
                    <td className="px-2 py-2 text-slate-900 whitespace-nowrap">{it.name}</td>
                    <td className="hidden md:table-cell px-2 py-2 text-slate-600 whitespace-nowrap">{it.category}</td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">{fmt(it.qty)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap">{fmt(it.patties ?? 0)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap">{fmt(getMeat(it, "red_meat_g", "redMeatGrams"))}</td>
                    <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap">{fmt(getMeat(it, "chicken_g", "chickenGrams"))}</td>
                    <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap">{fmt(it.rolls ?? 0)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-slate-500 text-xs">
                  No items for this shift. Select a date and click "Load Shift".
                </td>
              </tr>
            )}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-slate-400 bg-slate-100 font-semibold">
                <td className="hidden sm:table-cell px-2 py-2 text-slate-900 whitespace-nowrap">TOTALS</td>
                <td className="px-2 py-2 text-slate-900 whitespace-nowrap">TOTALS</td>
                <td className="hidden md:table-cell px-2 py-2"></td>
                <td className="px-2 py-2 text-right text-slate-900 whitespace-nowrap">{fmt(totals.totalQty)}</td>
                <td className="px-2 py-2 text-right text-slate-900 whitespace-nowrap">{fmt(totals.totalPatties)}</td>
                <td className="px-2 py-2 text-right text-slate-900 whitespace-nowrap">{fmt(totals.totalBeef)}</td>
                <td className="px-2 py-2 text-right text-slate-900 whitespace-nowrap">{fmt(totals.totalChicken)}</td>
                <td className="px-2 py-2 text-right text-slate-900 whitespace-nowrap">{fmt(totals.totalRolls)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
