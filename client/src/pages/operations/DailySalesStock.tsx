import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Search, Minus, Plus } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  unit?: string;
  defaultQty: number;
}

interface StockMaster {
  [category: string]: StockItem[];
}

interface ItemQuantity {
  [itemId: string]: {
    qty: number;
    notes: string;
  };
}

interface SavedStockRequest {
  id: string;
  category: string;
  name: string;
  unit?: string;
  qty: number;
  notes?: string;
}

export default function DailySalesStock() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shift');
  
  console.log('[Form2] shift:', shiftId ?? 'none');

  // Stock master data
  const [stockMaster, setStockMaster] = useState<StockMaster>({});
  
  // Shift info (readonly from Form 1)
  const [shiftDate, setShiftDate] = useState("");
  const [completedBy, setCompletedBy] = useState("");

  // End-of-Shift Counts
  const [rolls, setRolls] = useState<number>(0);
  const [meatGrams, setMeat] = useState<number>(0);
  const [drinksTotal, setDrinks] = useState<number>(0);

  // Requisition List
  const [itemQuantities, setItemQuantities] = useState<ItemQuantity>({});

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  // Load stock master data on mount
  useEffect(() => {
    const loadStockMaster = async () => {
      try {
        const res = await fetch("/api/stock-master");
        const masterData = await res.json();
        setStockMaster(masterData);
        
        // Count total items for console log
        const totalItems = Object.values(masterData).reduce((total: number, items: any) => total + items.length, 0);
        console.log("[Form2] stock master loaded:", totalItems, "items");
        
        // Expand first category by default
        const firstCategory = Object.keys(masterData)[0];
        if (firstCategory) {
          setExpandedCategories(new Set([firstCategory]));
        }
      } catch (error) {
        console.error("Failed to load stock master:", error);
      }
    };
    
    loadStockMaster();
  }, []);

  // Load existing form data when shiftId is available
  useEffect(() => {
    if (!shiftId) return;

    const loadFormData = async () => {
      try {
        const res = await fetch(`/api/forms/${shiftId}`);
        if (!res.ok) return;
        
        const { sales, stock } = await res.json();
        
        // Set shift info from sales data
        if (sales) {
          setShiftDate(sales.shiftDate || "");
          setCompletedBy(sales.completedBy || "");
        }

        // Set stock counts if they exist
        if (stock) {
          if (stock.rolls !== undefined) setRolls(Number(stock.rolls) || 0);
          if (stock.meatGrams !== undefined) setMeat(Number(stock.meatGrams) || 0);
          if (stock.drinksTotal !== undefined) setDrinks(Number(stock.drinksTotal) || 0);

          // Set item quantities if they exist
          if (stock.stockRequests && Array.isArray(stock.stockRequests)) {
            const quantities: ItemQuantity = {};
            stock.stockRequests.forEach((req: SavedStockRequest) => {
              quantities[req.id] = {
                qty: Number(req.qty) || 0,
                notes: req.notes || ""
              };
            });
            setItemQuantities(quantities);
          }
        }
      } catch (error) {
        console.error("Failed to load form data:", error);
      }
    };

    loadFormData();
  }, [shiftId]);

  const updateItemQuantity = (itemId: string, qty: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: {
        qty: qty || 0,
        notes: prev[itemId]?.notes || ""
      }
    }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: {
        qty: prev[itemId]?.qty || 0,
        notes
      }
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(Object.keys(stockMaster)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleSave = async () => {
    if (!shiftId) {
      setSaved("err");
      setTimeout(() => setSaved(null), 4000);
      return;
    }

    // Build stock requests from item quantities (only qty > 0)
    const stockRequests: SavedStockRequest[] = [];
    
    Object.entries(stockMaster).forEach(([category, items]) => {
      items.forEach((item) => {
        const itemData = itemQuantities[item.id];
        if (itemData && itemData.qty > 0) {
          stockRequests.push({
            id: item.id,
            category,
            name: item.name,
            unit: item.unit,
            qty: itemData.qty,
            notes: itemData.notes
          });
        }
      });
    });

    const body = {
      shiftId,
      rolls: Number(rolls) || 0,
      meatGrams: Number(meatGrams) || 0,
      drinksTotal: Number(drinksTotal) || 0,
      stockRequests
    };

    try {
      const res = await fetch("/api/daily-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        setSaved("err");
        setTimeout(() => setSaved(null), 4000);
        return;
      }

      const result = await res.json();
      if (result.ok) {
        console.log("[Form2] saved:", shiftId);
        setSaved("ok");
        setTimeout(() => setSaved(null), 4000);
      } else {
        setSaved("err");
        setTimeout(() => setSaved(null), 4000);
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaved("err");
      setTimeout(() => setSaved(null), 4000);
    }
  };

  // Filter items based on search query
  const filteredStockMaster = Object.entries(stockMaster).reduce((acc, [category, items]) => {
    const filteredItems = items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filteredItems.length > 0) {
      acc[category] = filteredItems;
    }
    return acc;
  }, {} as StockMaster);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[14px]">Daily Stock</h1>
        {shiftId ? (
          <p className="text-sm text-gray-500 mt-1">Shift {shiftDate || shiftId}</p>
        ) : (
          <p className="text-sm text-gray-500 mt-1">No shift ID provided</p>
        )}
      </div>

      {/* Shift Information (readonly) */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-[14px] font-semibold">Shift Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Date</label>
            <input 
              type="text"
              value={shiftDate}
              readOnly
              className="w-full border rounded-xl px-3 py-2.5 h-10 bg-gray-50 text-[14px]"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Completed By</label>
            <input 
              type="text"
              value={completedBy}
              readOnly
              className="w-full border rounded-xl px-3 py-2.5 h-10 bg-gray-50 text-[14px]"
            />
          </div>
        </div>
      </section>

      {/* End-of-Shift Counts */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-[14px] font-semibold">End-of-Shift Counts</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Rolls (pcs)</label>
            <input 
              type="number"
              value={rolls}
              onChange={(e) => setRolls(Number(e.target.value) || 0)}
              className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Meat (grams)</label>
            <input 
              type="number"
              value={meatGrams}
              onChange={(e) => setMeat(Number(e.target.value) || 0)}
              className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Drinks total (pcs)</label>
            <input 
              type="number"
              value={drinksTotal}
              onChange={(e) => setDrinks(Number(e.target.value) || 0)}
              className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
            />
          </div>
        </div>
      </section>

      {/* Requisition List */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-[14px] font-semibold">Requisition List</h3>
        
        {/* Search and Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 h-10 border rounded-xl text-[14px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-2 h-10 border rounded-xl hover:bg-gray-50 text-[14px] flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-2 h-10 border rounded-xl hover:bg-gray-50 text-[14px] flex items-center gap-2"
            >
              <Minus className="h-4 w-4" />
              Collapse all
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          {Object.entries(filteredStockMaster).map(([category, items]) => (
            <div key={category} className="border rounded-xl">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-xl"
              >
                <span className="font-medium text-[14px]">{category} ({items.length})</span>
                {expandedCategories.has(category) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {expandedCategories.has(category) && (
                <div className="border-t p-4 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="grid gap-4 md:grid-cols-[2fr_1fr_2fr] items-center">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium">{item.name}</span>
                        {item.unit && (
                          <span className="text-[12px] text-gray-500">{item.unit}</span>
                        )}
                      </div>
                      
                      <div>
                        <input
                          type="number"
                          placeholder="0"
                          value={itemQuantities[item.id]?.qty || ""}
                          onChange={(e) => updateItemQuantity(item.id, Number(e.target.value) || 0)}
                          className="w-full border rounded-lg px-3 py-2 h-9 text-[14px] text-center"
                        />
                      </div>
                      
                      <div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={itemQuantities[item.id]?.notes || ""}
                          onChange={(e) => updateItemNotes(item.id, e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 h-9 text-[14px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="mt-8 flex items-center justify-between">
        <div>
          {saved === "ok" && (
            <div className="text-emerald-600 font-medium text-[14px]">Stock & requisitions saved</div>
          )}
          {saved === "err" && (
            <div className="text-red-600 font-medium text-[14px]">Error saving stock form. Please try again.</div>
          )}
        </div>
        
        <button
          type="button"
          onClick={handleSave}
          className="h-10 rounded-lg bg-emerald-600 px-6 text-[14px] font-semibold text-white hover:bg-emerald-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}