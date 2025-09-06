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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    const n = parseInt((v ?? '').toString().replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
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

  const buildItemsFromState = () => {
    return ingredients
      .map(ingredient => ({
        name: ingredient.name,
        category: ingredient.category,
        quantity: quantities[ingredient.name] || 0,
        unit: ingredient.unit
      }))
      .filter(item => item.quantity > 0); // Only include items with quantities > 0
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);

    // Build payload
    const payload = {
      shiftId,
      rolls,
      meatGrams,
      items: buildItemsFromState(), // [{ name, category, quantity, unit }]
    };

    try {
      const res = await fetch("/api/daily-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to submit stock.");
      }

      // ✅ Inline success note
      setMessage({ type: "success", text: "Stock saved." });

      // ✅ Redirect to Daily Sales V2 Library 
      setTimeout(() => {
        window.location.assign("/operations/daily-sales-v2/library");
      }, 1500);

    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Submit failed." });
    } finally {
      setSubmitting(false);
      // auto-clear message after 4s
      setTimeout(() => setMessage(null), 4000);
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
                type="text"
                inputMode="numeric"
                className="w-full border rounded-md px-3 py-2 text-[14px] text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={rolls || ''}
                onChange={(e) => setRolls(safeInt(e.target.value))}
                placeholder=""
                aria-label="Rolls quantity"
              />
            </div>
            <div>
              <label className="block text-[14px] mb-1">Meat (grams)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full border rounded-md px-3 py-2 text-[14px] text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={meatGrams || ''}
                onChange={(e) => setMeatGrams(safeInt(e.target.value))}
                placeholder=""
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

      {/* Submit Button */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <span className={`text-[14px] ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-5 py-2 text-white text-[14px] hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default DailyStock;