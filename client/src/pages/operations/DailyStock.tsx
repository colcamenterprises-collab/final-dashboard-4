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

// EXACT labels from consolidated patch (same as Daily Sales)  
const labels = {
  en: { rollsEnd: 'Rolls (pcs)', meatCount: 'Meat (grams)', drinksEnd: 'Drinks Count', requisition: 'Requisition Items' },
  th: { rollsEnd: 'โรล (ชิ้น)', meatCount: 'เนื้อ (กรัม)', drinksEnd: 'เครื่องดื่ม', requisition: 'รายการสั่งซื้อ' }
};

// EXACT LanguageToggle as inline component (NO new file) - styled as toggle switch
const LanguageToggle = ({ onChange }: { onChange: (lang: string) => void }) => {
  const [lang, setLang] = useState('en');
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`text-sm ${lang === 'en' ? 'text-blue-600' : 'text-gray-600'}`}>EN</span>
      <button 
        className={`relative w-11 h-6 rounded-full transition-all duration-200 ${lang === 'en' ? 'bg-blue-500' : 'bg-emerald-500'}`}
        onClick={() => { const newLang = lang === 'en' ? 'th' : 'en'; setLang(newLang); onChange(newLang); }}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${lang === 'en' ? 'translate-x-0' : 'translate-x-5'}`} />
      </button>
      <span className={`text-sm ${lang === 'th' ? 'text-emerald-600' : 'text-gray-600'}`}>ไทย</span>
    </div>
  );
};

const DailyStock: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [rolls, setRolls] = useState<number>(0);
  const [meatGrams, setMeatGrams] = useState<number>(0);
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lang, setLang] = useState<'en' | 'th'>('en');

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

  // Separate drinks for stock count (not requisition)
  const drinkItems: IngredientItem[] = useMemo(() => {
    return ingredients.filter(item => item.category === 'Drinks');
  }, [ingredients]);

  // Group all ingredients by category with custom order (including drinks)
  const blocks: CategoryBlock[] = useMemo(() => {
    if (!Array.isArray(ingredients)) return [];
    const map = new Map<string, IngredientItem[]>();
    
    // Include ALL ingredients including drinks in requisition calculation
    const allIngredients = ingredients;
    
    for (const ingredient of allIngredients) {
      if (!map.has(ingredient.category)) map.set(ingredient.category, []);
      map.get(ingredient.category)!.push(ingredient);
    }
    
    // Custom category order: Drinks first, then Fresh Food, Shelf Items, Frozen Food, others alphabetically
    const categoryOrder = ['Drinks', 'Fresh Food', 'Shelf Items', 'Frozen Food'];
    const orderedCategories = Array.from(map.keys()).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return orderedCategories.map(category => ({
      category,
      items: map.get(category)!
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

  // Debounced quantity update functions
  const setQuantity = useCallback((id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  }, []);
  
  const setDrinkQuantity = useCallback((id: string, qty: number) => {
    setDrinkQuantities((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
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
    // Include ALL ingredients including drinks in requisition payload
    return ingredients
      .map(ingredient => ({
        name: ingredient.name,
        category: ingredient.category,
        quantity: quantities[ingredient.name] || 0,
        unit: ingredient.unit
      }))
      .filter(item => item.quantity > 0); // Only include items with quantities > 0
  };
  
  const buildDrinksFromState = () => {
    return drinkItems
      .map(drink => ({
        name: drink.name,
        quantity: drinkQuantities[drink.name] || 0,
        unit: drink.unit
      }))
      .filter(item => item.quantity > 0);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    
    // EXACT VALIDATION from consolidated patch - FIXED to allow zero values
    const errors = [];
    if (rolls == null || isNaN(Number(rolls)) || Number(rolls) < 0) errors.push('rollsEnd');
    if (meatGrams == null || isNaN(Number(meatGrams)) || Number(meatGrams) < 0) errors.push('meatCount');
    
    // Allow zero counts but ensure forms are at least attempted (not completely untouched)
    const drinksEnd = buildDrinksFromState();
    // Don't require drinks - zero counts are valid
    
    const requisition = buildItemsFromState();  
    // Don't require requisition items - zero purchases are valid
    
    setErrors(errors);
    if (errors.length) {
      setMessage({ type: "error", text: "Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas." });
      return; // Block submission
    }
    
    setSubmitting(true);
    setMessage(null);

    // Build requisition array for shopping list generation  
    const requisitionItems = buildItemsFromState().map(item => ({
      name: item.name,
      category: item.category,
      qty: item.quantity,
      unit: item.unit
    }));

    const drinkStock = buildDrinksFromState();
    
    // Update the existing Form 1 record with stock data
    const payload = {
      rollsEnd: rolls,
      meatEnd: meatGrams,
      drinkStock: drinkStock,
      requisition: requisitionItems,
      notes: notes.trim()
    };

    try {
      const res = await fetch(`/api/forms/daily-sales/v2/${shiftId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to submit stock.");
      }

      // ✅ Dashboard-style success message
      setMessage({ type: "success", text: "Stock data saved successfully! Redirecting to library..." });

      // ✅ Redirect to Daily Sales V2 Library 
      setTimeout(() => {
        window.location.assign("/operations/daily-sales-v2/library");
      }, 2000);

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
      
      {/* EXACT LanguageToggle from consolidated patch */}
      <LanguageToggle onChange={setLang} />
      
      {/* EXACT error display from consolidated patch */}
      {errors.length > 0 && <p className="text-red-500 text-sm">Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas.</p>}

      {/* End-of-Shift Counts */}
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <h2 className="text-[14px] font-semibold mb-4">End-of-Shift Counts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] mb-1 font-medium">{labels[lang].rollsEnd}</label>
              <input
                type="text"
                inputMode="numeric"
                className={`w-full border rounded-md px-3 py-2 text-[14px] text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.includes('rollsEnd') ? 'border-red-500' : ''}`}
                value={rolls || ''}
                onChange={(e) => setRolls(safeInt(e.target.value))}
                placeholder=""
                aria-label="Rolls quantity"
              />
              {errors.includes('rollsEnd') && <p className="text-red-500 text-sm">Rolls count required, non-negative for theft prevention.</p>}
            </div>
            <div>
              <label className="block text-[14px] mb-1 font-medium">{labels[lang].meatCount}</label>
              <input
                type="text"
                inputMode="numeric"
                className={`w-full border rounded-md px-3 py-2 text-[14px] text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.includes('meatCount') ? 'border-red-500' : ''}`}
                value={meatGrams || ''}
                onChange={(e) => setMeatGrams(safeInt(e.target.value))}
                placeholder=""
                aria-label="Meat quantity in grams"
              />
              {errors.includes('meatCount') && <p className="text-red-500 text-sm">Meat count required, non-negative for theft prevention.</p>}
              {meatGrams > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {(meatGrams / 1000).toFixed(1)}kg or {meatGrams.toLocaleString()} grams
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Drinks Stock Count Section */}
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <h2 className="text-[14px] font-semibold mb-4">Drinks Stock Count</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {drinkItems.length === 0 ? (
              <div className="text-gray-500 text-xs">No drink items available</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {drinkItems.map((drink) => (
                  <div key={drink.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="text-[14px] font-medium truncate pr-3">{drink.name}</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      className="w-24 rounded-md border px-3 py-2 text-left text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={drinkQuantities[drink.name] ?? 0}
                      onChange={(e) => setDrinkQuantity(drink.name, safeInt(e.target.value))}
                      aria-label={`${drink.name} quantity`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Requisition Grid */}
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-4">
            {/* Hide the "Requisition List" title as requested */}
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
      
      {/* Notes Section */}
      <section className="space-y-6">
        <div className="rounded-xl border p-4">
          <h2 className="text-[14px] font-semibold mb-4">Notes</h2>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any items not listed above or special notes..."
            aria-label="Additional notes"
          />
          <div className="text-xs text-gray-500 mt-2">
            Notes will be included in the email report to management.
          </div>
        </div>
      </section>

      {/* Submit Button */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <div className={`rounded-lg px-4 py-3 text-[14px] ${
              message.type === "success" 
                ? "bg-green-50 text-green-800 border border-green-200" 
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              <div className="flex items-center gap-2">
                {message.type === "success" && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                {message.type === "error" && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                <span className="font-medium">{message.text}</span>
              </div>
            </div>
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