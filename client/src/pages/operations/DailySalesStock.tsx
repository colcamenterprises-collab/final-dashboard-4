import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const uid = () => Math.random().toString(36).slice(2, 9);

interface CatalogItem {
  name: string;
  category: string;
  supplier?: string;
  cost?: number;
  unit: string;
  portion?: string;
  minimum_stock?: string;
  notes?: string;
}

interface StockCatalog {
  counted_items: CatalogItem[];
  requisition_items: CatalogItem[];
}

interface RequisitionRow {
  id: string;
  item: string;
  qty: number;
  unit: string;
  notes: string;
  supplier?: string;
}

export default function DailySalesStock() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shift');
  
  console.log('[Form2] shift:', shiftId ?? 'none');

  // Catalog data
  const [catalog, setCatalog] = useState<StockCatalog | null>(null);
  
  // Shift info (readonly from Form 1)
  const [shiftDate, setShiftDate] = useState("");
  const [completedBy, setCompletedBy] = useState("");

  // End-of-Shift Counts
  const [rolls, setRolls] = useState<number>(0);  // burgerBuns
  const [meat, setMeat] = useState<number>(0);    // meatGrams
  const [drinks, setDrinks] = useState<number>(0); // drinkStock

  // Requisition List
  const [requisitionRows, setRequisitionRows] = useState<RequisitionRow[]>([]);

  // Save state
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  // Load catalog on mount
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch("/data/stock_catalog.json");
        const catalogData = await res.json();
        setCatalog(catalogData);
        console.log("[Form2] catalog loaded:", catalogData.requisition_items?.length);
      } catch (error) {
        console.error("Failed to load catalog:", error);
      }
    };
    
    loadCatalog();
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
          if (stock.burgerBuns) setRolls(Number(stock.burgerBuns) || 0);
          if (stock.meatGrams) setMeat(Number(stock.meatGrams) || 0);
          if (stock.drinkStock) setDrinks(Number(stock.drinkStock) || 0);

          // Set requisition rows if they exist
          if (stock.stockRequests && Array.isArray(stock.stockRequests)) {
            const rows = stock.stockRequests.map((req: any) => ({
              id: uid(),
              item: req.item || "",
              qty: Number(req.qty) || 0,
              unit: req.unit || "",
              notes: req.notes || "",
              supplier: req.supplier || ""
            }));
            setRequisitionRows(rows);
          }
        }
      } catch (error) {
        console.error("Failed to load form data:", error);
      }
    };

    loadFormData();
  }, [shiftId]);

  const addRequisitionRow = () => {
    const newRow: RequisitionRow = {
      id: uid(),
      item: "",
      qty: 0,
      unit: "",
      notes: "",
      supplier: ""
    };
    setRequisitionRows(prev => [...prev, newRow]);
  };

  const removeRequisitionRow = (id: string) => {
    setRequisitionRows(prev => prev.filter(row => row.id !== id));
  };

  const updateRequisitionRow = (id: string, field: keyof RequisitionRow, value: string | number) => {
    setRequisitionRows(prev => 
      prev.map(row => {
        if (row.id === id) {
          if (field === 'item' && typeof value === 'string') {
            // When item changes, auto-fill unit and supplier from catalog
            const catalogItem = catalog?.requisition_items.find(item => item.name === value);
            return {
              ...row,
              [field]: value,
              unit: catalogItem?.unit || row.unit,
              supplier: catalogItem?.supplier || row.supplier
            };
          }
          return { ...row, [field]: value };
        }
        return row;
      })
    );
  };

  const handleSave = async () => {
    if (!shiftId) {
      setSaved("err");
      setTimeout(() => setSaved(null), 4000);
      return;
    }

    // Build body exactly as specified
    const body = {
      shiftId,
      burgerBuns: Number(rolls) || 0,
      meatGrams: Number(meat) || 0,
      drinkStock: Number(drinks) || 0,
      stockRequests: requisitionRows
        .filter(r => Number(r.qty) > 0)
        .map(r => ({
          item: r.item,
          qty: Number(r.qty),
          unit: r.unit || "",
          notes: r.notes || "",
          supplier: r.supplier || ""
        }))
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
      if (result.success) {
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

  const getAvailableItems = () => {
    if (!catalog) return [];
    return catalog.requisition_items.map(item => item.name);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[14px]">Daily Stock</h1>
        {!shiftId && (
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
              value={meat}
              onChange={(e) => setMeat(Number(e.target.value) || 0)}
              className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Drinks total (pcs)</label>
            <input 
              type="number"
              value={drinks}
              onChange={(e) => setDrinks(Number(e.target.value) || 0)}
              className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
            />
          </div>
        </div>
      </section>

      {/* Requisition List */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-[14px] font-semibold">Requisition List</h3>
        
        <div className="space-y-4">
          {requisitionRows.map((row) => (
            <div key={row.id} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Item</label>
                <select
                  value={row.item}
                  onChange={(e) => updateRequisitionRow(row.id, 'item', e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
                >
                  <option value="">Select item...</option>
                  {getAvailableItems().map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-600 block mb-1">Qty</label>
                <input
                  type="number"
                  value={row.qty}
                  onChange={(e) => updateRequisitionRow(row.id, 'qty', Number(e.target.value) || 0)}
                  className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-600 block mb-1">Unit</label>
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateRequisitionRow(row.id, 'unit', e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-600 block mb-1">Notes</label>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateRequisitionRow(row.id, 'notes', e.target.value)}
                  placeholder="Optional"
                  className="w-full border rounded-xl px-3 py-2.5 h-10 text-[14px]"
                />
              </div>
              
              <div>
                <button
                  type="button"
                  onClick={() => removeRequisitionRow(row.id)}
                  className="h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100 text-[14px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={addRequisitionRow}
            className="px-4 py-2 border rounded-xl hover:bg-gray-50 text-[14px]"
          >
            + Add Row
          </button>
        </div>
      </section>

      {/* Save button (non-floating) */}
      <div className="mt-8 flex items-center justify-between">
        <div>
          {saved === "ok" && (
            <div className="text-emerald-600 font-medium text-[14px]">Stock saved.</div>
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