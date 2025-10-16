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
    <div className="p-6 space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium">Shift date (YYYY-MM-DD)</label>
          <input value={date} onChange={e => setDate(e.target.value)} placeholder="2025-10-15" className="border rounded-md px-3 py-2" />
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl shadow border">
          {loading ? "Loading…" : "Load shift"}
        </button>
        <button onClick={exportCSV} disabled={!metrics} className="px-4 py-2 rounded-xl shadow border">
          Export CSV
        </button>
      </div>

      <h2 className="text-xl font-bold">{title}</h2>

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Burger</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Beef Patties</th>
              <th className="text-right p-3">Red Meat (g)</th>
              <th className="text-right p-3">Chicken (g)</th>
              <th className="text-right p-3">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.products.map((p) => (
              <tr key={p.normalizedName} className="border-t">
                <td className="p-3">{p.normalizedName}</td>
                <td className="p-3 text-right">{p.qty}</td>
                <td className="p-3 text-right">{p.patties}</td>
                <td className="p-3 text-right">{p.redMeatGrams}</td>
                <td className="p-3 text-right">{p.chickenGrams}</td>
                <td className="p-3 text-right">{p.rolls}</td>
              </tr>
            ))}
            {metrics && (
              <tr className="border-t font-semibold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right">{metrics.totals.burgers}</td>
                <td className="p-3 text-right">{metrics.totals.patties}</td>
                <td className="p-3 text-right">{metrics.totals.redMeatGrams}</td>
                <td className="p-3 text-right">{metrics.totals.chickenGrams}</td>
                <td className="p-3 text-right">{metrics.totals.rolls}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {metrics && Object.keys(metrics.unmapped).length > 0 && (
        <div className="text-sm">
          <div className="font-semibold">Unmapped burger-like items (add to catalog):</div>
          <ul className="list-disc ml-6">
            {Object.entries(metrics.unmapped).map(([name, qty]) => (
              <li key={name}>{name}: {qty}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
