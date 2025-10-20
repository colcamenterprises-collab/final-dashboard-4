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
      const res: ShiftResp = await fetchJSON(`/api/shift-analysis/${date}`);
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

  async function rebuildShift() {
    setError("");
    setLoading(true);
    try {
      const res = await fetchJSON(`/api/shift-analysis/${date}/compute`, { method: "POST" });
      setSourceUsed("live");
      setFromISO(res.fromISO);
      setToISO(res.toISO);
      setItems(res.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function showRaw() {
    try {
      const res = await fetchJSON(`/api/loyverse/items/${date}`);
      alert(
        `Raw line items (${res.length} total):\n\n` +
          res.slice(0, 20).map((r: any) => `${r.sku ?? "no-sku"}\t${r.name}\t${r.quantity}`).join("\n") +
          (res.length > 20 ? `\n\n... and ${res.length - 20} more` : "")
      );
    } catch (e: any) {
      alert(`Raw fetch failed: ${e.message}`);
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
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Shift Analytics (MM v1.0)</h1>
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm">
          Window: 17:00 → 03:00 (Asia/Bangkok)
        </span>
        {sourceUsed && (
          <span className={`px-2 py-1 rounded text-sm ${sourceUsed === "live" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            Source: {sourceUsed.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">Shift date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button onClick={loadShift} disabled={loading} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Loading…" : "Load shift"}
        </button>
        <button onClick={rebuildShift} disabled={loading} className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
          Rebuild cache
        </button>
        <button onClick={showRaw} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">
          Raw items
        </button>
        <button onClick={exportCSV} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">
          Export CSV
        </button>
        {(fromISO && toISO) ? (
          <span className="text-sm text-slate-500">[{fromISO} → {toISO}]</span>
        ) : null}
      </div>

      <div className="flex gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-3 py-1 rounded border ${tab === c ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Item</th>
              <th className="text-left p-2">Category</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Patties</th>
              <th className="text-right p-2">Red Meat (g)</th>
              <th className="text-right p-2">Chicken (g)</th>
              <th className="text-right p-2">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, idx) => (
              <tr key={idx} className="border-b hover:bg-slate-50">
                <td className="p-2 font-mono">{it.sku ?? ""}</td>
                <td className="p-2">{it.name}</td>
                <td className="p-2">{it.category}</td>
                <td className="p-2 text-right">{fmt(it.qty)}</td>
                <td className="p-2 text-right">{fmt(it.patties ?? 0)}</td>
                <td className="p-2 text-right">{fmt(getMeat(it, "red_meat_g", "redMeatGrams"))}</td>
                <td className="p-2 text-right">{fmt(getMeat(it, "chicken_g", "chickenGrams"))}</td>
                <td className="p-2 text-right">{fmt(it.rolls ?? 0)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">No items for this shift.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
