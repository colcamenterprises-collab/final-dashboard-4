import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

type ProductRow = {
  normalizedName: string;
  rawHits: string[];
  qty: number;
  patties: number;
  redMeatGrams: number;
  chickenGrams: number;
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

function getApiBase() {
  // Prefer relative /api when the dev proxy is active; otherwise fall back to explicit base
  const envBase = (import.meta as any).env?.VITE_API_BASE?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  return ""; // relative (proxy)
}

function toISODateSafe(s: string) {
  // Accept both "YYYY-MM-DD" and "MM/DD/YYYY"
  if (!s) return "";
  const d1 = DateTime.fromISO(s);
  if (d1.isValid) return d1.toISODate();
  const d2 = DateTime.fromFormat(s, "MM/dd/yyyy");
  if (d2.isValid) return d2.toISODate();
  return "";
}

export default function ReceiptsBurgerCounts() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string>("");
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [rawItems, setRawItems] = useState<any[]>([]);

  // leave empty by default
  const [date, setDate] = useState<string>("");

  const title = useMemo(() => {
    if (!metrics) return "Burger Counts";
    const fromOk = DateTime.fromISO(metrics.fromISO || "").isValid;
    const toOk   = DateTime.fromISO(metrics.toISO   || "").isValid;
    if (fromOk && toOk) {
      const from = DateTime.fromISO(metrics.fromISO).toFormat("dd LLL yyyy HH:mm");
      const to   = DateTime.fromISO(metrics.toISO).toFormat("dd LLL yyyy HH:mm");
      return `Burger Counts — Shift ${metrics.shiftDate} (${from} → ${to})`;
    }
    // Fallback: compute the shift window locally for the chosen date
    const iso = toISODateSafe(date) || metrics.shiftDate;
    const base = DateTime.fromISO(iso).startOf("day");
    const from = base.plus({ hours: 18 }).toFormat("dd LLL yyyy HH:mm");
    const to   = base.plus({ days: 1, hours: 3 }).toFormat("dd LLL yyyy HH:mm");
    return `Burger Counts — Shift ${iso} (${from} → ${to})`;
  }, [metrics, date]);

  async function load() {
    setLoading(true);
    setError("");
    setRawResponse(null);
    setMetrics(null);

    try {
      const base = (import.meta as any).env?.VITE_API_BASE?.trim() || "";
      const iso = toISODateSafe(date);
      const qs  = iso ? `?date=${encodeURIComponent(iso)}` : "";
      const url = base ? `${base}/api/receipts/shift/burgers${qs}` : `/api/receipts/shift/burgers${qs}`;

      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      const j = await r.json().catch(() => ({}));
      setRawResponse({ status: r.status, ok: r.ok, body: j });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!j?.ok) throw new Error(j?.error || "API returned ok=false");

      // Ensure fromISO/toISO fallback so UI never shows "Invalid DateTime"
      const d = j.data || {};
      if (!d.fromISO || !d.toISO) {
        const lbl = d.shiftDate || iso;
        const baseDay = DateTime.fromISO(lbl).startOf("day");
        d.fromISO = baseDay.plus({ hours: 18 }).toISO();
        d.toISO   = baseDay.plus({ days: 1, hours: 3 }).toISO();
      }
      setMetrics(d);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // auto-load once so you see something immediately
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRaw() {
    setRawItems([]);
    try {
      const base = (import.meta as any).env?.VITE_API_BASE?.trim() || "";
      const iso = toISODateSafe(date);
      const qs = iso ? `?date=${encodeURIComponent(iso)}` : "";
      const url = base 
        ? `${base}/api/receipts/debug/items${qs}`
        : `/api/receipts/debug/items${qs}`;
      const r = await fetch(url);
      const j = await r.json();
      setRawItems(j.items || []);
    } catch (e) {
      console.error("Failed to load raw items:", e);
      setRawItems([]);
    }
  }

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
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-sm font-medium">Shift date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border rounded-md px-3 py-2"
          />
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl shadow border">
          {loading ? "Loading…" : "Load shift"}
        </button>
        <button onClick={exportCSV} disabled={!metrics} className="px-4 py-2 rounded-xl shadow border">
          Export CSV
        </button>
        <button onClick={loadRaw} className="px-4 py-2 rounded-xl shadow border bg-blue-50 hover:bg-blue-100">
          Show raw items
        </button>
      </div>

      {rawItems.length > 0 && (
        <details className="border rounded-xl p-4 bg-gray-50">
          <summary className="font-semibold cursor-pointer mb-2">Raw items from database (top {rawItems.length})</summary>
          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-xs">
              <thead className="bg-white">
                <tr>
                  <th className="text-left p-2 border">Item Name</th>
                  <th className="text-right p-2 border">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rawItems.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 border">{item.item_name}</td>
                    <td className="p-2 border text-right">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {error && (
        <div className="p-3 border rounded bg-red-50 text-red-700">
          <div className="font-semibold mb-1">Error</div>
          <div>{error}</div>
        </div>
      )}

      <h2 className="text-xl font-bold">{title}</h2>

      {!metrics && !error && !loading && (
        <div className="text-sm text-gray-500">No data yet — pick a date and click "Load shift".</div>
      )}

      {metrics && metrics.products.filter(p => p.qty > 0).length === 0 && (
        <div className="text-sm text-gray-500">No burger items found for this shift window.</div>
      )}

      {metrics && metrics.products.filter(p => p.qty > 0).length > 0 && (
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
              {metrics.products.filter(p => p.qty > 0).map((p) => (
                <tr key={p.normalizedName} className="border-t">
                  <td className="p-3">{p.normalizedName}</td>
                  <td className="p-3 text-right">{p.qty}</td>
                  <td className="p-3 text-right">{p.patties}</td>
                  <td className="p-3 text-right">{p.redMeatGrams}</td>
                  <td className="p-3 text-right">{p.chickenGrams}</td>
                  <td className="p-3 text-right">{p.rolls}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right">{metrics.totals.burgers}</td>
                <td className="p-3 text-right">{metrics.totals.patties}</td>
                <td className="p-3 text-right">{metrics.totals.redMeatGrams}</td>
                <td className="p-3 text-right">{metrics.totals.chickenGrams}</td>
                <td className="p-3 text-right">{metrics.totals.rolls}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Debug panel so we can *see* what the API returns */}
      <details className="border rounded p-3">
        <summary className="cursor-pointer select-none">Debug (raw API response)</summary>
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(rawResponse, null, 2)}</pre>
        <div className="text-xs mt-2 text-gray-500">
          API Base: {(import.meta as any).env?.VITE_API_BASE || "(relative /api)"}
        </div>
      </details>
    </div>
  );
}
