import React, { useMemo, useState } from "react";

type ShiftItem = {
  sku: string | null;
  name: string;
  category: "burger" | "drink" | "side" | "modifier" | "bundle" | "other";
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

const CATS = ["all", "burger", "drink", "side", "modifier", "bundle", "other"] as const;
type CatTab = typeof CATS[number];

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

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((x) => x.category === tab);
  }, [items, tab]);

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-base font-semibold">Shift Analytics</h1>
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-600 min-w-[60px]">Shift date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2 text-xs min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          data-testid="input-shift-date"
        />
        <button 
          onClick={loadShift} 
          disabled={loading} 
          className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
          data-testid="button-load-shift"
        >
          {loading ? "Loading…" : "Load Shift"}
        </button>
        <button 
          onClick={exportCSV} 
          className="px-4 py-2 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
          data-testid="button-export-csv"
        >
          Export CSV
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-4 py-2 rounded border text-xs font-medium whitespace-nowrap min-h-[44px] min-w-[44px] active:scale-95 transition-all ${
              tab === c 
                ? "bg-slate-900 text-white border-slate-900" 
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
            data-testid={`tab-${c}`}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left p-3 font-semibold text-slate-700">SKU</th>
              <th className="text-left p-3 font-semibold text-slate-700">Item</th>
              <th className="text-left p-3 font-semibold text-slate-700">Category</th>
              <th className="text-right p-3 font-semibold text-slate-700">Qty</th>
              <th className="text-right p-3 font-semibold text-slate-700">Patties</th>
              <th className="text-right p-3 font-semibold text-slate-700">Beef (g)</th>
              <th className="text-right p-3 font-semibold text-slate-700">Chicken (g)</th>
              <th className="text-right p-3 font-semibold text-slate-700">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, idx) => (
              <tr 
                key={idx} 
                className="border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                data-testid={`row-item-${idx}`}
              >
                <td className="p-3 font-mono text-slate-600">{it.sku ?? "—"}</td>
                <td className="p-3 text-slate-900">{it.name}</td>
                <td className="p-3 text-slate-600 capitalize">{it.category}</td>
                <td className="p-3 text-right font-semibold text-slate-900">{fmt(it.qty)}</td>
                <td className="p-3 text-right text-slate-700">{fmt(it.patties ?? 0)}</td>
                <td className="p-3 text-right text-slate-700">{fmt(getMeat(it, "red_meat_g", "redMeatGrams"))}</td>
                <td className="p-3 text-right text-slate-700">{fmt(getMeat(it, "chicken_g", "chickenGrams"))}</td>
                <td className="p-3 text-right text-slate-700">{fmt(it.rolls ?? 0)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                  No items for this shift. Select a date and click "Load Shift".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
