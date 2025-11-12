import React, { useMemo, useState, useEffect } from "react";
import { formatDateDDMMYYYY, convertFromInputDate } from "@/lib/format";

type RollsRow = {
  shift_date: string;
  rolls_start: number;
  rolls_purchased: number;
  burgers_sold: number;
  estimated_rolls_end: number;
  actual_rolls_end: number | null;
  variance: number;
  status: 'PENDING' | 'OK' | 'ALERT';
};

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

// Utility to normalize date to YYYY-MM-DD
const toYMD = (v: string) => {
  // Accept "YYYY-MM-DD" or "DD/MM/YYYY"
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Safari date input returns "YYYY-MM-DD"
  try { return new Date(v).toISOString().slice(0,10); } catch { return v; }
};

export default function ShiftAnalyticsMM() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [sourceUsed, setSourceUsed] = useState<"live" | "cache" | "">("");
  const [fromISO, setFromISO] = useState("");
  const [toISO, setToISO] = useState("");
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [tab, setTab] = useState<CatTab>("all");
  const [error, setError] = useState<string>("");
  const [rolls, setRolls] = useState<RollsRow | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    const ymd = toYMD(date);
    try {
      // Fetch items first
      const a = await fetch(`/api/analysis/shift/items?date=${ymd}`).then(r => r.json());
      setItems(a?.items ?? []);
      setSourceUsed(a?.sourceUsed ?? "");
      if ("shiftDate" in a) {
        setFromISO(a.fromISO);
        setToISO(a.toISO);
      } else {
        setFromISO("");
        setToISO("");
      }
      // Fetch rolls ledger after items so status bar reflects same key
      const b = await fetch(`/api/analysis/rolls-ledger?date=${ymd}`).then(r => r.json());
      setRolls(b?.row ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setItems([]);
      setRolls(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function exportCSV() {
    const headers = ["SKU", "Item", "Category", "Qty", "Patties", "RedMeat(g)", "Chicken(g)", "Rolls"];
    const rows = items.length
      ? items.map((it) => [
          it.sku ?? "",
          it.name,
          it.category,
          it.qty,
          it.patties ?? 0,
          (it as any).red_meat_g ?? (it as any).redMeatGrams ?? 0,
          (it as any).chicken_g ?? (it as any).chickenGrams ?? 0,
          it.rolls ?? 0,
        ])
      : []; // Allow header-only export
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift-${toYMD(date)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
          <h1 className="text-3xl font-semibold text-slate-900">F&B Analysis</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded-[4px] bg-slate-100 text-slate-700 text-xs">
              Window: 5 PM → 3 AM (Bangkok)
            </span>
            {sourceUsed && (
              <span className={`px-2 py-1 rounded-[4px] text-xs ${sourceUsed === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {sourceUsed === "live" ? "Live Data" : "Cached"}
              </span>
            )}
          </div>
        </div>

        {/* Controls - Better tablet layout */}
        <div className="space-y-2">
          {/* Date row */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 whitespace-nowrap">Shift date</label>
            <input
              type="date"
              value={toYMD(date)}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-[4px] px-3 py-2 text-xs min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 border-slate-200"
              data-testid="input-shift-date"
            />
            <span className="text-xs text-slate-500">Key: {toYMD(date)}</span>
          </div>
          
          {/* Button row */}
          <div className="flex gap-2">
            <button 
              onClick={loadAll} 
              disabled={loading} 
              className="px-4 py-2 rounded-[4px] bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex-1 sm:flex-none active:scale-95 transition-transform"
              data-testid="button-load-shift"
            >
              {loading ? "Loading…" : "Load Shift"}
            </button>
            <button 
              onClick={exportCSV} 
              className="px-4 py-2 rounded-[4px] bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 min-h-[44px] flex-1 sm:flex-none active:scale-95 transition-transform border border-slate-200"
              data-testid="button-export-csv"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Category Tabs - Horizontal scroll on tablet */}
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-2 min-w-max">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setTab(c)}
                className={`px-4 py-2 rounded-[4px] border text-xs font-medium whitespace-nowrap min-h-[44px] active:scale-95 transition-all ${
                  tab === c 
                    ? "bg-emerald-600 text-white border-emerald-600" 
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                data-testid={`tab-${c}`}
              >
                {c === "all" ? "ALL" : c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Rolls Ledger Status Bar */}
        {rolls && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
              <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
                <div className="text-slate-600">Start</div>
                <div className="font-medium text-slate-900">{rolls.rolls_start}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
                <div className="text-slate-600">Purchased</div>
                <div className="font-medium text-slate-900">{rolls.rolls_purchased}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
                <div className="text-slate-600">Burgers Sold</div>
                <div className="font-medium text-slate-900">{rolls.burgers_sold}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
                <div className="text-slate-600">Estimated End</div>
                <div className="font-medium text-slate-900">{rolls.estimated_rolls_end}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
                <div className="text-slate-600">Actual End</div>
                <div className="font-medium text-slate-900">{rolls.actual_rolls_end ?? '—'}</div>
              </div>
              <div className={`p-2 border rounded-[4px] font-bold text-center ${rolls.status === 'OK' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : rolls.status === 'ALERT' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                <div className="text-xs">{rolls.status}</div>
                {rolls.actual_rolls_end !== null && (
                  <div className="text-xs">({rolls.variance >= 0 ? '+' : ''}{rolls.variance})</div>
                )}
              </div>
            </div>
            <button
              className="px-3 py-1 border border-slate-200 rounded-[4px] text-xs hover:bg-slate-50 active:scale-95 transition-transform"
              onClick={async () => {
                const ymd = toYMD(date);
                await fetch(`/api/analysis/rolls-ledger/rebuild?date=${ymd}`, { method: 'POST' });
                const resp = await fetch(`/api/analysis/rolls-ledger?date=${ymd}`).then(r=>r.json());
                setRolls(resp?.row ?? null);
              }}
              data-testid="button-refresh-rolls"
            >
              Refresh Rolls
            </button>
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
            <tr className="border-b border-slate-200">
              <th className="hidden sm:table-cell px-2 py-2 text-left font-medium text-slate-700 whitespace-nowrap">SKU</th>
              <th className="px-2 py-2 text-left font-medium text-slate-700 whitespace-nowrap">Item</th>
              <th className="hidden md:table-cell px-2 py-2 text-left font-medium text-slate-700 whitespace-nowrap">Category</th>
              <th className="px-2 py-2 text-right font-medium text-slate-700 whitespace-nowrap">Qty</th>
              <th className="px-2 py-2 text-right font-medium text-slate-700 whitespace-nowrap">Patties</th>
              <th className="px-2 py-2 text-right font-medium text-slate-700 whitespace-nowrap">Beef (g)</th>
              <th className="px-2 py-2 text-right font-medium text-slate-700 whitespace-nowrap">Chicken (g)</th>
              <th className="px-2 py-2 text-right font-medium text-slate-700 whitespace-nowrap">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
              <React.Fragment key={category}>
                {/* Category Header Row */}
                <tr className="bg-emerald-50 border-t border-emerald-200">
                  <td colSpan={8} className="px-2 py-2 font-medium text-emerald-900 text-xs uppercase tracking-wide">
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
                    <td className="hidden sm:table-cell px-2 py-2 font-mono text-slate-600 text-xs whitespace-nowrap">{it.sku ?? "—"}</td>
                    <td className="px-2 py-2 text-slate-900 text-xs whitespace-nowrap">{it.name}</td>
                    <td className="hidden md:table-cell px-2 py-2 text-slate-600 text-xs whitespace-nowrap">{it.category}</td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900 text-xs whitespace-nowrap">{fmt(it.qty)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 text-xs whitespace-nowrap">{fmt(it.patties ?? 0)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 text-xs whitespace-nowrap">{fmt(getMeat(it, "red_meat_g", "redMeatGrams"))}</td>
                    <td className="px-2 py-2 text-right text-slate-700 text-xs whitespace-nowrap">{fmt(getMeat(it, "chicken_g", "chickenGrams"))}</td>
                    <td className="px-2 py-2 text-right text-slate-700 text-xs whitespace-nowrap">{fmt(it.rolls ?? 0)}</td>
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
              <tr className="border-t-2 border-slate-400 bg-slate-100 font-medium">
                <td className="hidden sm:table-cell px-2 py-2 text-slate-900 text-xs whitespace-nowrap">TOTALS</td>
                <td className="px-2 py-2 text-slate-900 text-xs whitespace-nowrap">TOTALS</td>
                <td className="hidden md:table-cell px-2 py-2"></td>
                <td className="px-2 py-2 text-right text-slate-900 text-xs whitespace-nowrap">{fmt(totals.totalQty)}</td>
                <td className="px-2 py-2 text-right text-slate-900 text-xs whitespace-nowrap">{fmt(totals.totalPatties)}</td>
                <td className="px-2 py-2 text-right text-slate-900 text-xs whitespace-nowrap">{fmt(totals.totalBeef)}</td>
                <td className="px-2 py-2 text-right text-slate-900 text-xs whitespace-nowrap">{fmt(totals.totalChicken)}</td>
                <td className="px-2 py-2 text-right text-slate-900 text-xs whitespace-nowrap">{fmt(totals.totalRolls)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
