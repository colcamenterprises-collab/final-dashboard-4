import React, { useEffect, useMemo, useState } from "react";
import ChefRamsayGordon from "@/components/ChefRamsayGordon";

// ---- Types ----
type Ingredient = {
  id: string;
  name: string;
  unit: "g"|"ml"|"pcs";
  packageSize: number;            // e.g., 1000 (g/ml) or 1 (pcs)
  packageCostTHB: number;         // total price per package
  supplier?: string;
};

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;         // quantity used in recipe (same unit as ingredient.unit)
  unit: "g"|"ml"|"pcs";
  unitCostTHB: number; // derived: packageCost / packageSize
  costTHB: number;     // qty * unitCostTHB (with yield if applied)
  supplier?: string;
};

const THB = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:2}).format(n||0);
const num = (v:any)=> isFinite(+v) ? +v : 0;

export default function CostCalculator(){
  // ---- Data ----
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [wastePct, setWastePct] = useState(0);           // 0..100
  const [portions, setPortions] = useState(1);
  const [menuPrice, setMenuPrice] = useState(0);
  const [recipeName, setRecipeName] = useState("");
  const [note, setNote] = useState("");
  const [desc, setDesc] = useState("");                 // AI description
  const [chefMode, setChefMode] = useState<"helpful"|"ramsay">("ramsay");

  // ---- Load Ingredients (live from Ingredient Management) ----
  useEffect(()=>{
    (async ()=>{
      // Swap URL to your real endpoint that lists current ingredients
      const r = await fetch("/api/ingredients");
      const j = await r.json();
      const rows: Ingredient[] = (j.rows || j || []).map((x:any)=>({
        id: String(x.id ?? x.slug ?? x.name),
        name: x.name,
        unit: (x.unit || "g"),
        packageSize: num(x.packageSize ?? x.size ?? 1),
        packageCostTHB: num(x.packageCostTHB ?? x.priceTHB ?? 0),
        supplier: x.supplier || ""
      }));
      setIngredients(rows);
    })();
  },[]);

  // ---- Derived ----
  const linesWithCosts = useMemo(()=>{
    const yieldFactor = (100 - Math.max(0, Math.min(100, wastePct)))/100; // e.g., 90% if 10% waste
    return lines.map(l => {
      const unitCost = num(l.unitCostTHB);
      const cost = num(l.qty) * unitCost / Math.max(0.0001, yieldFactor);
      return { ...l, costTHB: cost };
    });
  }, [lines, wastePct]);

  const recipeCostTHB = useMemo(()=> linesWithCosts.reduce((a,l)=> a + l.costTHB, 0), [linesWithCosts]);
  const costPerPortionTHB = useMemo(()=> recipeCostTHB / Math.max(1, portions), [recipeCostTHB, portions]);
  const foodCostPct = useMemo(()=> menuPrice > 0 ? (costPerPortionTHB / menuPrice) * 100 : 0, [costPerPortionTHB, menuPrice]);
  const gpTHB = useMemo(()=> menuPrice - costPerPortionTHB, [menuPrice, costPerPortionTHB]);
  const marginPct = useMemo(()=> menuPrice>0 ? (gpTHB/menuPrice)*100 : 0, [gpTHB, menuPrice]);

  // ---- Actions ----
  function addIngredient(ing: Ingredient){
    const unitCost = ing.packageCostTHB / Math.max(1, ing.packageSize);
    setLines(prev => [...prev, {
      ingredientId: ing.id,
      name: ing.name,
      qty: 0,
      unit: ing.unit,
      unitCostTHB: unitCost,
      costTHB: 0,
      supplier: ing.supplier
    }]);
    setSearch("");
  }

  function updateQty(idx:number, q:number){
    setLines(prev => prev.map((l,i)=> i===idx ? { ...l, qty: q } : l));
  }

  function removeLine(idx:number){
    setLines(prev => prev.filter((_,i)=> i!==idx));
  }

  async function generateDescription(){
    const payload = {
      mode: chefMode,
      recipeName,
      lines: linesWithCosts.map(l=>({ name: l.name, qty: l.qty, unit: l.unit })),
      targetPrice: menuPrice
    };
    const r = await fetch("/api/chef/describe", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    setDesc(j.text || "");
  }

  async function saveToRecipes(){
    const payload = {
      recipeName, note, wastePct, portions, menuPrice,
      lines: linesWithCosts.map(l=> ({
        ingredientId: l.ingredientId,
        name: l.name,
        qty: l.qty,
        unit: l.unit,
        unitCostTHB: l.unitCostTHB,
        costTHB: l.costTHB,
        supplier: l.supplier
      })),
      totals: { recipeCostTHB, costPerPortionTHB, foodCostPct, gpTHB, marginPct },
      description: desc
    };
    const r = await fetch("/api/recipes/save", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error || "Save failed");
    alert("Saved to Recipe Cards ✅");
  }

  // ---- UI ----
  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  return (
    <div className="bg-[#f5f7f8] min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily:"Poppins, sans-serif" }}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900">Cost Calculator</h1>
        <div className="flex gap-3 items-center">
          <label className="text-sm text-gray-600">Mode</label>
          <select value={chefMode} onChange={e=>setChefMode(e.target.value as any)} className="bg-white border rounded-xl px-3 py-2 text-sm">
            <option value="helpful">Helpful</option>
            <option value="ramsay">Ramsay Mode</option>
          </select>
          <button onClick={saveToRecipes} className="bg-teal-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-teal-700">Save to Recipe Cards</button>
        </div>
      </div>

      {/* Recipe Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6">
            <div className="text-sm text-gray-600">Recipe Name</div>
            <input value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="e.g., Ultimate Double" className="mt-2 w-full border rounded-xl px-3 py-2" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-600">Portions Per Recipe</div>
                <input type="number" min={1} value={portions} onChange={e=>setPortions(num(e.target.value))} className="mt-2 w-full border rounded-xl px-3 py-2" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Waste / Yield Loss %</div>
                <input type="number" min={0} max={100} value={wastePct} onChange={e=>setWastePct(num(e.target.value))} className="mt-2 w-full border rounded-xl px-3 py-2" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">Menu Price (THB)</div>
              <input type="number" min={0} value={menuPrice} onChange={e=>setMenuPrice(num(e.target.value))} className="mt-2 w-full border rounded-xl px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border lg:col-span-2">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredients…" className="flex-1 border rounded-xl px-3 py-2" />
            </div>
            {search && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filtered.map(ing=>(
                  <button key={ing.id} onClick={()=>addIngredient(ing)} className="border rounded-xl px-3 py-2 text-left hover:bg-gray-50">
                    <div className="font-medium">{ing.name}</div>
                    <div className="text-xs text-gray-500">Unit cost: {THB(ing.packageCostTHB/Math.max(1,ing.packageSize))} / {ing.unit}</div>
                    {ing.supplier && <div className="text-xs text-gray-400">Supplier: {ing.supplier}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white rounded-2xl shadow-sm border mt-6">
        <div className="p-6">
          <h3 className="text-[18px] font-semibold">Ingredients</h3>
          <div className="mt-3 overflow-auto">
            <table className="min-w-[820px] w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs text-gray-600">Ingredient</th>
                  <th className="p-2 text-right text-xs text-gray-600">Qty</th>
                  <th className="p-2 text-left text-xs text-gray-600">Unit</th>
                  <th className="p-2 text-right text-xs text-gray-600">Unit Cost</th>
                  <th className="p-2 text-right text-xs text-gray-600">Cost</th>
                  <th className="p-2 text-left text-xs text-gray-600">Supplier</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {linesWithCosts.map((l,idx)=>(
                  <tr key={idx} className={idx%2?"bg-gray-50/50":""}>
                    <td className="p-2">{l.name}</td>
                    <td className="p-2 text-right">
                      <input type="number" min={0} value={l.qty} onChange={e=>updateQty(idx, num(e.target.value))} className="w-28 border rounded-xl px-2 py-1 text-right" />
                    </td>
                    <td className="p-2">{l.unit}</td>
                    <td className="p-2 text-right tabular-nums">{THB(l.unitCostTHB)}</td>
                    <td className="p-2 text-right tabular-nums">{THB(l.costTHB)}</td>
                    <td className="p-2">{l.supplier || "-"}</td>
                    <td className="p-2 text-right">
                      <button onClick={()=>removeLine(idx)} className="text-sm text-rose-600 underline hover:text-rose-800">Remove</button>
                    </td>
                  </tr>
                ))}
                {!linesWithCosts.length && (
                  <tr><td className="p-4 text-sm text-gray-600" colSpan={7}>Add ingredients to start costing.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6">
            <div className="text-xs text-gray-600">Recipe Cost</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(recipeCostTHB)}</div>
            <div className="mt-3 text-xs text-gray-600">Cost per Portion</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(costPerPortionTHB)}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6">
            <div className="text-xs text-gray-600">Menu Price</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(menuPrice)}</div>
            <div className="mt-3 text-xs text-gray-600">Food Cost %</div>
            <div className={`inline-block mt-1 px-3 py-1 rounded-md text-sm font-semibold ${foodCostPct<=32? "bg-green-100 text-green-800" : foodCostPct<=38? "bg-amber-100 text-amber-800":"bg-rose-100 text-rose-800"}`}>
              {foodCostPct.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border lg:col-span-1">
          <div className="p-6">
            <div className="text-xs text-gray-600">Gross Profit (per portion)</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(gpTHB)}</div>
            <div className="mt-3 text-xs text-gray-600">Margin %</div>
            <div className="text-xl font-semibold tabular-nums">{marginPct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Description + Notes */}
      <div className="bg-white rounded-2xl shadow-sm border mt-6">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[18px] font-semibold">Recipe Description & Notes</h3>
            <button onClick={generateDescription} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-emerald-700">
              {chefMode === "ramsay" ? "Ask Chef Ramsay" : "Generate Description"}
            </button>
          </div>
          {desc && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{desc}</div>
            </div>
          )}
          <div className="mt-4">
            <label className="text-sm text-gray-600">Personal Notes</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add your own notes about this recipe..." className="mt-2 w-full border rounded-xl px-3 py-2 h-24 resize-none" />
          </div>
        </div>
      </div>

      {/* Chef Ramsay Gordon - Always Visible */}
      <ChefRamsayGordon 
        mode={chefMode}
        context={{
          recipeName,
          ingredientCount: linesWithCosts.length,
          foodCostPct,
          marginPct,
          costPerPortionTHB,
          menuPrice
        }}
      />
    </div>
  );
}