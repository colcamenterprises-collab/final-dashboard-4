import React, { useEffect, useMemo, useState, useCallback } from "react";
import { StockGrid } from "../../components/StockGrid";
import { queryClient } from "@/lib/queryClient";
// === BEGIN MANAGER QUICK CHECK: imports ===
import ManagerQuickCheck from '@/components/ManagerQuickCheck';
// === END MANAGER QUICK CHECK: imports ===
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

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
      <span className={`text-xs font-medium ${lang === 'en' ? 'text-emerald-600' : 'text-slate-600'}`}>EN</span>
      <button 
        className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 ${lang === 'en' ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-500 border-emerald-500'}`}
        onClick={() => { const newLang = lang === 'en' ? 'th' : 'en'; setLang(newLang); onChange(newLang); }}
      >
        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-6'}`} />
      </button>
      <span className={`text-xs font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-slate-600'}`}>ไทย</span>
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
  const [validationErrors, setValidationErrors] = useState<any>({});
  const [lang, setLang] = useState<'en' | 'th'>('en');
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationDetails, setValidationDetails] = useState<{
    rolls?: string;
    meat?: string;
    drinks?: string[];
  }>({});
// === BEGIN MANAGER QUICK CHECK: state & handlers ===
const [showCheck, setShowCheck] = useState(false);

const onFinalSubmitClick = () => {
  // instead of immediately submitting, open checklist
  setShowCheck(true);
};

// call your existing final submit here after checklist completes
const handleCheckDone = async ({ status }:{status:'COMPLETED'|'SKIPPED'|'UNAVAILABLE'}) => {
  setShowCheck(false);
  // If you want to attach the status to your payload, do it here.
  await handleSubmit(); // <-- call your real final submit function
};
// === END MANAGER QUICK CHECK: state & handlers ===

  const shiftId = useMemo(() => new URLSearchParams(location.search).get("shift"), []);
  const [syncing, setSyncing] = useState(false);

  const handleSyncFromPurchasing = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/purchasing-items/sync-to-daily-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data: IngredientsResponse = await res.json();
      if (data.list) {
        setIngredients(data.list);
        setMessage({ type: "success", text: `Synced ${data.list.length} items from Purchasing List` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e) {
      console.error("Failed to sync from purchasing list:", e);
      setMessage({ type: "error", text: "Failed to sync from purchasing list" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

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

  // Extract drink names for validation
  const requiredDrinks: string[] = useMemo(() => {
    return drinkItems.map(d => d.name);
  }, [drinkItems]);

  // Group all ingredients by category with custom order (EXCLUDING drinks and meat)
  const blocks: CategoryBlock[] = useMemo(() => {
    if (!Array.isArray(ingredients)) return [];
    const map = new Map<string, IngredientItem[]>();
    
    // Filter out drinks and meat from requisition (drinks have separate section, meat should be hidden)
    const allIngredients = ingredients.filter(item => item.category !== 'Drinks' && item.category !== 'Meat');
    
    for (const ingredient of allIngredients) {
      if (!map.has(ingredient.category)) map.set(ingredient.category, []);
      map.get(ingredient.category)!.push(ingredient);
    }
    
    // Custom category order: Fresh Food, Shelf Items, Frozen Food, others alphabetically (excluding Drinks and Meat)
    const categoryOrder = ['Fresh Food', 'Shelf Items', 'Frozen Food'];
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
    
    // V3.2A Stock validation
    const validationErrs: any = {};
    const details: { rolls?: string; meat?: string; drinks?: string[] } = {};
    
    const N = (v: any) => {
      if (v === null || v === undefined) return NaN;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : NaN;
    };
    
    const rollsNum = N(rolls);
    const meatNum = N(meatGrams);
    
    if (Number.isNaN(rollsNum) || rollsNum < 0) {
      validationErrs.rollsEnd = "Rolls count is required (0 allowed).";
      details.rolls = "Burger rolls count is missing or invalid";
    }
    if (Number.isNaN(meatNum) || meatNum < 0) {
      validationErrs.meatEnd = "Meat count (grams) is required (0 allowed).";
      details.meat = "Meat count (grams) is missing or invalid";
    }
    
    // Check drinks - all required drinks must have valid counts (0 allowed)
    const missingDrinks: string[] = [];
    for (const drink of requiredDrinks) {
      const qty = drinkQuantities[drink];
      const n = N(qty);
      if (Number.isNaN(n) || n < 0) {
        missingDrinks.push(drink);
      }
    }
    if (missingDrinks.length > 0) {
      validationErrs.drinkStock = `Missing drink counts: ${missingDrinks.join(', ')}`;
      details.drinks = missingDrinks;
    }
    
    setValidationErrors(validationErrs);
    if (Object.keys(validationErrs).length > 0) {
      setValidationDetails(details);
      setShowValidationDialog(true);
      return;
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

    // Build drinkStock as object with all required drinks
    const drinkStockObj: Record<string, number> = {};
    for (const drink of requiredDrinks) {
      drinkStockObj[drink] = drinkQuantities[drink] || 0;
    }
    
    // Update the existing Form 1 record with stock data
    const payload = {
      rollsEnd: rolls,
      meatEnd: meatGrams,
      drinkStock: drinkStockObj,
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
        // Show detailed error if drinks are missing
        if (data?.error === "STOCK_REQUIRED" && data?.details?.drinksMissing) {
          const missing = data.details.drinksMissing.join(', ');
          throw new Error(`Missing drink counts: ${missing}. Please enter 0 if none remaining.`);
        }
        throw new Error(data?.error || "Unable to submit stock.");
      }

      // Invalidate finance cache to refresh home page data
      queryClient.invalidateQueries({ queryKey: ['/api/finance/summary/today'] });
      
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

  if (loading) return <div className="p-4 text-xs">Loading stock…</div>;

  return (
    <div className="p-4 space-y-4 text-xs">
      {/* Validation Warning Dialog */}
      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-sm font-semibold text-red-900">
                Incomplete Stock Data
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-3">
              <p className="font-medium">Please complete the following required fields:</p>
              <ul className="space-y-2 ml-4">
                {validationDetails.rolls && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{validationDetails.rolls}</span>
                  </li>
                )}
                {validationDetails.meat && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{validationDetails.meat}</span>
                  </li>
                )}
                {validationDetails.drinks && validationDetails.drinks.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <div>
                      <p className="font-medium mb-1">Missing drink counts:</p>
                      <div className="ml-2 space-y-1">
                        {validationDetails.drinks.map(drink => (
                          <div key={drink} className="text-xs text-slate-600">
                            → {drink}
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                )}
              </ul>
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                💡 <strong>Tip:</strong> Enter 0 if any item has zero stock remaining.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => setShowValidationDialog(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-[4px]"
            >
              Got it, I'll fix this
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold">Daily Stock</h1>
        <div className="text-xs text-slate-600">
          {shiftId ? (
            <span className="inline-flex items-center gap-2 rounded-[4px] border border-slate-200 px-3 py-1">Linked to shift: {shiftId}</span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-[4px] border border-amber-200 px-3 py-1 bg-amber-50">No shift ID provided</span>
          )}
        </div>
      </div>

      {/* Sync button for updating items from purchasing list */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSyncFromPurchasing}
          disabled={syncing}
          data-testid="button-sync-purchasing"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-medium rounded-[4px] transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync from Purchasing List'}
        </button>
        {message && (
          <div className={`px-3 py-1 rounded-[4px] text-xs ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}
      </div>
      
      {/* EXACT LanguageToggle from consolidated patch */}
      <LanguageToggle onChange={setLang} />
      
      {/* EXACT error display from consolidated patch */}
      {errors.length > 0 && <p className="text-red-500 text-xs">Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas.</p>}

      {/* End-of-Shift Counts */}
      <section className="space-y-4">
        <div className="rounded-[4px] border border-slate-200 p-4 bg-white">
          <h2 className="text-sm font-semibold mb-4">End-of-Shift Counts</h2>
          {validationErrors?.rollsEnd && <div className="mt-1 mb-2 text-xs text-red-600">{validationErrors.rollsEnd}</div>}
          {validationErrors?.meatEnd && <div className="mt-1 mb-2 text-xs text-red-600">{validationErrors.meatEnd}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 font-medium">{labels[lang].rollsEnd}</label>
              <input
                type="text"
                inputMode="numeric"
                className={`w-full border rounded-[4px] px-3 py-2 text-xs text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors?.rollsEnd ? 'border-red-500' : 'border-slate-200'}`}
                value={rolls || ''}
                onChange={(e) => setRolls(safeInt(e.target.value))}
                placeholder=""
                aria-label="Rolls quantity"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">{labels[lang].meatCount}</label>
              <input
                type="text"
                inputMode="numeric"
                className={`w-full border rounded-[4px] px-3 py-2 text-xs text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors?.meatEnd ? 'border-red-500' : 'border-slate-200'}`}
                value={meatGrams || ''}
                onChange={(e) => setMeatGrams(safeInt(e.target.value))}
                placeholder=""
                aria-label="Meat quantity in grams"
              />
              {meatGrams > 0 && (
                <div className="text-xs text-slate-600 mt-1">
                  {(meatGrams / 1000).toFixed(1)}kg or {meatGrams.toLocaleString()} grams
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Drinks Stock Count Section */}
      <section className="space-y-4">
        <div className="rounded-[4px] border border-slate-200 p-4 bg-white">
          <h2 className="text-sm font-semibold mb-4">Drinks Stock Count</h2>
          {validationErrors?.drinkStock && <div className="mt-1 mb-2 text-xs text-red-600">{validationErrors.drinkStock}</div>}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {drinkItems.length === 0 ? (
              <div className="text-slate-600 text-xs">No drink items available</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {drinkItems.map((drink) => (
                  <div key={drink.name} className="rounded-[4px] border border-slate-200 p-3">
                    <label className="block text-sm font-medium mb-2">{drink.name}</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      className="w-full rounded-[4px] border border-slate-200 px-3 py-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
      <section className="space-y-4">
        <div className="rounded-[4px] border border-slate-200 p-4 bg-white">
          <div className="flex items-center justify-between mb-4">
            {/* Hide the "Requisition List" title as requested */}
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={expandAll}
                className="px-3 py-1 text-xs border border-slate-200 rounded-[4px] hover:bg-slate-50"
              >
                Expand All
              </button>
              <button 
                type="button" 
                onClick={collapseAll}
                className="px-3 py-1 text-xs border border-slate-200 rounded-[4px] hover:bg-slate-50"
              >
                Collapse All
              </button>
            </div>
          </div>
          <StockGrid blocks={blocks} onChange={setQuantity} />
        </div>
      </section>
      
      {/* Notes Section */}
      <section className="space-y-4">
        <div className="rounded-[4px] border border-slate-200 p-4 bg-white">
          <h2 className="text-sm font-semibold mb-4">Notes</h2>
          <label className="block text-sm mb-2 font-medium">Any items not listed above or special notes...</label>
          <textarea
            className="w-full border border-slate-200 rounded-[4px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Additional notes"
          />
          <div className="text-xs text-slate-600 mt-2">
            Notes will be included in the email report to management.
          </div>
        </div>
      </section>

      {/* Submit Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto">
          {message && (
            <div className={`rounded-[4px] px-4 py-3 text-xs ${
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
          onClick={onFinalSubmitClick}
          disabled={submitting}
          className="w-full sm:w-auto rounded-[4px] bg-emerald-600 px-5 py-2 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit All"}
        </button>
      </div>

{showCheck && (
  <ManagerQuickCheck
    salesId={Number(shiftId) /* already available from ?shift= or props */}
    onDone={handleCheckDone}
    onCancel={() => setShowCheck(false)}
  />
)}
    </div>
  );
};

export default DailyStock;