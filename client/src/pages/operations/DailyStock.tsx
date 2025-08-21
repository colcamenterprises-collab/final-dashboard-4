import React, { useEffect, useMemo, useState, useCallback } from "react";
import { StockGrid } from "../../components/StockGrid";

// Server ingredient catalog from CSV import
type IngredientItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: number;
  supplier: string;
  portions?: number;
};

type IngredientsResponse = { list: IngredientItem[] };

export type CategoryBlock = {
  category: string;
  items: { id: string; label: string; qty: number; unit: string }[];
};

const DailyStock: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [rolls, setRolls] = useState<number>(0);
  const [meatGrams, setMeatGrams] = useState<number>(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const shiftId = useMemo(() => new URLSearchParams(location.search).get("shift"), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/costing/ingredients");
        const data: IngredientsResponse = await res.json();
        if (!mounted) return;
        setIngredients(data.list || []);
      } catch (e) {
        console.error("Failed to load ingredients catalog:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Group ingredients by category
  const blocks: CategoryBlock[] = useMemo(() => {
    if (!Array.isArray(ingredients)) return [];
    const map = new Map<string, IngredientItem[]>();
    for (const ingredient of ingredients) {
      if (!map.has(ingredient.category)) map.set(ingredient.category, []);
      map.get(ingredient.category)!.push(ingredient);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({ 
            id: item.name,  // Use name as ID for consistent lookup
            label: item.name, 
            qty: quantities[item.name] ?? 0,
            unit: item.unit
          })),
      }));
  }, [ingredients, quantities]);

  // Helper function for safe integer parsing
  const safeInt = (v: string) => {
    const n = parseInt(v.replace(/[^\d]/g, '') || '0', 10);
    return isNaN(n) ? 0 : n;
  };

  // Debounced quantity update function
  const setQuantity = useCallback((id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  }, []);

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
      // Build items array from ingredients with quantities
      const items = ingredients
        .map(ingredient => ({
          name: ingredient.name,
          category: ingredient.category,
          quantity: quantities[ingredient.name] || 0,
          unit: ingredient.unit
        }))
        .filter(item => item.quantity > 0); // Only include items with quantities > 0

      const payload = {
        shiftId: shiftId || null,
        rolls,
        meatGrams,
        items
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
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <h2 className="text-[14px] font-semibold mb-4">End-of-Shift Counts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] mb-1">Rolls (pcs)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="w-full border rounded-md px-3 py-2 text-[14px] text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={rolls}
                onChange={(e) => setRolls(safeInt(e.target.value))}
                aria-label="Rolls quantity"
              />
            </div>
            <div>
              <label className="block text-[14px] mb-1">Meat (grams)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="w-full border rounded-md px-3 py-2 text-[14px] text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={meatGrams}
                onChange={(e) => setMeatGrams(safeInt(e.target.value))}
                aria-label="Meat quantity in grams"
              />
            </div>
          </div>
        </div>
      </section>



      {/* Requisition Grid */}
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold">Requisition List</h2>
            <div className="space-x-2">
              <button 
                type="button" 
                onClick={expandAll}
                className="px-3 py-1 text-[14px] border rounded hover:bg-gray-50"
              >
                Expand All
              </button>
              <button 
                type="button" 
                onClick={collapseAll}
                className="px-3 py-1 text-[14px] border rounded hover:bg-gray-50"
              >
                Collapse All
              </button>
            </div>
          </div>
          <StockGrid blocks={blocks} onChange={setQuantity} />
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {note && (
            <span className={`text-[14px] ${note.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {note.msg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2 text-[14px] bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};

export default DailyStock;