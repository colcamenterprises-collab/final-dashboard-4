// client/src/pages/ReceiptsBurgerCounts.tsx
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

type ProductRow = {
  normalizedName: string;
  rawHits: string[];
  qty: number;
  patties: number;       // beef
  redMeatGrams: number;  // beef grams
  chickenGrams: number;  // chicken grams
  rolls: number;
};

type Metrics = {
  shiftDate: string;
  fromISO: string;
  toISO: string;
  products: ProductRow[];
  totals: {
    burgers: number;
    patties: number;
    redMeatGrams: number;
    chickenGrams: number;
    rolls: number;
  };
  unmapped: Record<string, number>;
};

export default function ReceiptsBurgerCounts() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [date, setDate] = useState("");

  const title = useMemo(() => {
    if (!metrics) return "Last Shift — Burger Counts";
    const from = DateTime.fromISO(metrics.fromISO).toFormat("dd LLL yyyy HH:mm");
    const to = DateTime.fromISO(metrics.toISO).toFormat("dd LLL yyyy HH:mm");
    return `Burger Counts — Shift ${metrics.shiftDate} (${from} → ${to})`;
  }, [metrics]);

  async function load() {
    setLoading(true);
    try {
      const url = new URL("/api/receipts/shift/burgers", window.location.origin);
      if (date) url.searchParams.set("date", date);
      const r = await fetch(url.toString());
      const j = await r.json();
      if (j.ok) setMetrics(j.data);
      else throw new Error(j.error || "Failed to fetch");
    } catch (e) {
      console.error(e);
      alert("Failed to load burger counts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function exportCSV() {
    if (!metrics) return;
    const rows = [
      ["Burger", "Qty", "Beef Patties", "Red Meat (g)", "Chicken (g)", "Rolls"],
      ...metrics.products.map(p => [
        p.normalizedName, p.qty, p.patties, p.redMeatGrams, p.chickenGrams, p.rolls
      ]),
      ["TOTAL", metrics.totals.burgers, metrics.totals.patties, metrics.totals.redMeatGrams, metrics.totals.chickenGrams, metrics.totals.rolls],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `burger_counts_${metrics.shiftDate}.csv`;
    a.click();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="w-full sm:w-auto">
          <label className="block text-[12px] font-medium mb-1">Shift date (YYYY-MM-DD)</label>
          <input 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            placeholder="2025-10-15" 
            className="w-full border-2 rounded-[8px] px-3 py-2 text-[12px] placeholder:text-[12px] min-h-[44px] focus:outline-none focus:border-blue-500" 
          />
        </div>
        <button 
          onClick={load} 
          disabled={loading} 
          className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm rounded-[8px] border-2 border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 min-h-[44px] font-medium transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading…" : "Load shift"}
        </button>
        <button 
          onClick={exportCSV} 
          disabled={!metrics} 
          className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm rounded-[8px] bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 min-h-[44px] font-semibold transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Export CSV
        </button>
      </div>

      <h2 className="text-xl font-bold">{title}</h2>

      <div className="overflow-x-auto border-2 rounded-[8px] shadow-md">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-sm font-semibold">Burger</th>
              <th className="text-right p-3 text-sm font-semibold">Qty</th>
              <th className="text-right p-3 text-sm font-semibold">Beef Patties</th>
              <th className="text-right p-3 text-sm font-semibold">Red Meat (g)</th>
              <th className="text-right p-3 text-sm font-semibold">Chicken (g)</th>
              <th className="text-right p-3 text-sm font-semibold">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.products.map((p) => (
              <tr key={p.normalizedName} className="border-t">
                <td className="p-3 text-sm">{p.normalizedName}</td>
                <td className="p-3 text-sm text-right">{p.qty}</td>
                <td className="p-3 text-sm text-right">{p.patties}</td>
                <td className="p-3 text-sm text-right">{p.redMeatGrams}</td>
                <td className="p-3 text-sm text-right">{p.chickenGrams}</td>
                <td className="p-3 text-sm text-right">{p.rolls}</td>
              </tr>
            ))}
            {metrics && (
              <tr className="border-t bg-gray-50 font-bold">
                <td className="p-3 text-sm">TOTAL</td>
                <td className="p-3 text-sm text-right">{metrics.totals.burgers}</td>
                <td className="p-3 text-sm text-right">{metrics.totals.patties}</td>
                <td className="p-3 text-sm text-right">{metrics.totals.redMeatGrams}</td>
                <td className="p-3 text-sm text-right">{metrics.totals.chickenGrams}</td>
                <td className="p-3 text-sm text-right">{metrics.totals.rolls}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {metrics && Object.keys(metrics.unmapped).length > 0 && (
        <div className="rounded-[8px] border-2 border-yellow-300 bg-yellow-50 p-3">
          <div className="text-sm font-semibold text-yellow-800 mb-2">Unmapped burger-like items (add to catalog):</div>
          <ul className="list-disc ml-6 text-sm text-yellow-700">
            {Object.entries(metrics.unmapped).map(([name, qty]) => (
              <li key={name}>{name}: {qty}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
