import React, { useEffect, useMemo, useState } from "react";
import { StockGrid, CategoryBlock } from "../../components/StockGrid";

// Server catalog row
type CatalogItem = {
  id: string;
  name: string;
  category: string;
  type: "drink" | "item";
};

type CatalogResponse = { items: CatalogItem[] };

type RequisitionRow = { id: string; qty: number };

type DrinksRow = { id: string; name: string; qty: number };

const DailyStock: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [rolls, setRolls] = useState<number>(0);
  const [meatGrams, setMeatGrams] = useState<number>(0);
  const [drinks, setDrinks] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const shiftId = useMemo(() => new URLSearchParams(location.search).get("shift"), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/stock-catalog");
        const data: CatalogResponse = await res.json();
        if (!mounted) return;
        setCatalog(data.items);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Split catalog → drinks vs requisition items (non‑drinks)
  const drinksList: DrinksRow[] = useMemo(() => {
    return catalog
      .filter((c) => c.type === "drink")
      .map((c) => ({ id: c.id, name: c.name, qty: drinks[c.id] ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, drinks]);

  const blocks: CategoryBlock[] = useMemo(() => {
    const map = new Map<string, { id: string; label: string }[]>();
    for (const item of catalog) {
      if (item.type === "drink") continue; // drinks are counted in EoS drinks table
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push({ id: item.id, label: item.name });
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((i) => ({ id: i.id, label: i.label, qty: rows[i.id] ?? 0 })),
      }));
  }, [catalog, rows]);

  const setDrinkQty = (id: string, qty: number) =>
    setDrinks((prev) => ({ ...prev, [id]: Math.max(0, qty) }));

  const setReqQty = (id: string, qty: number) =>
    setRows((prev) => ({ ...prev, [id]: Math.max(0, qty) }));

  const expandAll = () => {
    document
      .querySelectorAll<HTMLDetailsElement>("details[data-accordion='catalog']")
      .forEach((d) => (d.open = true));
  };
  const collapseAll = () => {
    document
      .querySelectorAll<HTMLDetailsElement>("details[data-accordion='catalog']")
      .forEach((d) => (d.open = false));
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const filteredRequisition = Object.fromEntries(
        Object.entries(rows).filter(([_, qty]) => Number(qty) > 0)
      );

      const payload = {
        shiftId,
        rolls,
        meatGrams,
        requisition: filteredRequisition,
      };

      const res = await fetch("/api/daily-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setNote({ type: "ok", msg: "Stock saved." });
    } catch (e: any) {
      setNote({ type: "err", msg: e?.message || "Failed to save." });
    } finally {
      setSaving(false);
      setTimeout(() => setNote(null), 4000);
    }
  };

  if (loading) return <div className="p-6 text-[14px]">Loading stock…</div>;

  return (
    <div className="p-6 space-y-8 text-[14px]">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Daily Stock</h1>
        <div className="text-[12px] text-gray-600">
          {shiftId ? (
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">Linked to shift: {shiftId}</span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-amber-50">No shift ID provided</span>
          )}
        </div>
      </div>

      {/* End-of-Shift Counts */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-4">End-of-Shift Counts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Rolls (pcs)</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded-md px-3 py-2"
              value={rolls}
              onChange={(e) => setRolls(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label className="block mb-1">Meat (grams)</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded-md px-3 py-2"
              value={meatGrams}
              onChange={(e) => setMeatGrams(Number(e.target.value || 0))}
            />
          </div>
        </div>
      </section>

      {/* Drinks Count by SKU */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-4">Drinks Count by SKU</h2>
        {drinksList.length === 0 ? (
          <p className="text-gray-500">No drinks found in catalog</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Drink</th>
                  <th className="text-left p-2 font-medium w-24">Qty</th>
                </tr>
              </thead>
              <tbody>
                {drinksList.map((drink) => (
                  <tr key={drink.id} className="border-b">
                    <td className="p-2">{drink.name}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        className="w-20 border rounded-md px-2 py-1"
                        value={drink.qty}
                        onChange={(e) => setDrinkQty(drink.id, Number(e.target.value || 0))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Requisition Grid */}
      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Requisition List</h2>
          <div className="space-x-2">
            <button 
              type="button" 
              onClick={expandAll}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Expand All
            </button>
            <button 
              type="button" 
              onClick={collapseAll}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Collapse All
            </button>
          </div>
        </div>
        <StockGrid blocks={blocks} onChange={setReqQty} />
      </section>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {note && (
            <span className={`text-sm ${note.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {note.msg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !shiftId}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Stock"}
        </button>
      </div>
    </div>
  );
};

export default DailyStock;