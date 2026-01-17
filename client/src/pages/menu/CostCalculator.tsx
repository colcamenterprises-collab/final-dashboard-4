import React, { useEffect, useMemo, useState } from "react";
// import ChefRamsayGordon from "@/components/ChefRamsayGordon"; // DISABLED
import { RecipeEditor } from "./RecipeEditor";

// ---- Types ----
type UnitType = "g" | "ml" | "each";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: UnitType;
  unitCostPerBase: number;
};

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;         // quantity used in recipe
  unit: UnitType;      // can be different from ingredient base unit
  unitCostTHB: number; // cost per unit (converted if needed)
  costTHB: number;     // qty * unitCostTHB (with yield if applied)
};

const THB = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:2}).format(n||0);
const num = (v:any)=> isFinite(+v) ? +v : 0;


export default function CostCalculator(){
  // ---- Data ----
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [portions, setPortions] = useState(1);
  const [recipeName, setRecipeName] = useState("");
  const [note, setNote] = useState("");
  const [desc, setDesc] = useState("");                 // AI description
  const [chefMode, setChefMode] = useState<"helpful"|"ramsay">("ramsay");
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);

  // ---- Load Ingredients (live from Ingredient Management) ----
  useEffect(()=>{
    (async ()=>{
      const r = await fetch("/api/ingredients/canonical");
      const j = await r.json();
      const rows: Ingredient[] = (j.items || []).map((x:any)=>({
        id: String(x.id),
        name: x.name,
        baseUnit: x.baseUnit as UnitType,
        unitCostPerBase: num(x.unitCostPerBase ?? 0)
      }));
      setIngredients(rows);
    })();
  },[]);

  // ---- Derived ----
  const linesWithCosts = useMemo(()=>{
    return lines.map(l => {
      const unitCost = num(l.unitCostTHB);
      const cost = num(l.qty) * unitCost;
      return { ...l, costTHB: cost };
    });
  }, [lines]);

  const recipeCostTHB = useMemo(()=> linesWithCosts.reduce((a,l)=> a + l.costTHB, 0), [linesWithCosts]);
  const costPerPortionTHB = useMemo(()=> recipeCostTHB / Math.max(1, portions), [recipeCostTHB, portions]);

  // ---- Actions ----
  function addIngredient(ing: Ingredient){
    setLines(prev => [...prev, {
      ingredientId: ing.id,
      name: ing.name,
      qty: 0,
      unit: ing.baseUnit,
      unitCostTHB: ing.unitCostPerBase,
      costTHB: 0,
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
      targetPrice: 0
    };
    const r = await fetch("/api/chef/describe", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    setDesc(j.text || "");
  }

  async function saveToRecipes(){
    const payload = {
      recipeName, note, portions,
      lines: linesWithCosts.map(l=> ({
        ingredientId: l.ingredientId,
        name: l.name,
        qty: l.qty,
        unit: l.unit,
        unitCostTHB: l.unitCostTHB,
        costTHB: l.costTHB
      })),
      totals: { recipeCostTHB, costPerPortionTHB },
      description: desc
    };
    const r = await fetch("/api/recipes/save", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error || "Save failed");
    alert("Saved to Recipe Cards ✅");
  }

  // ---- Save as Recipe with Photo ----
  const handleSaveAsRecipe = async (recipeData: any) => {
    const payload = {
      ...recipeData,
      portions, 
      components: linesWithCosts.map(l => ({
        ingredientId: l.ingredientId,
        name: l.name,
        qty: l.qty,
        unit: l.unit,
        unitCostTHB: l.unitCostTHB,
        costTHB: l.costTHB
      })),
      totals: { recipeCostTHB, costPerPortionTHB }
    };
    
    try {
      const r = await fetch("/api/recipes/save-with-photo", {
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      
      alert("Recipe saved with photo ✅");
      setShowRecipeEditor(false);
      
      // Clear the calculator for next recipe
      setLines([]);
      setRecipeName("");
      setNote("");
      setDesc("");
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save recipe: " + (error as Error).message);
    }
  };

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
          <button onClick={() => setShowRecipeEditor(true)} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-emerald-700">Save as Recipe</button>
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
              <div />
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
                    <div className="text-xs text-gray-500">Unit cost: {THB(ing.unitCostPerBase)} / {ing.baseUnit}</div>
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
                    <td className="p-2 text-sm text-gray-600">{l.unit}</td>
                    <td className="p-2 text-right tabular-nums">{THB(l.unitCostTHB)}</td>
                    <td className="p-2 text-right tabular-nums">{THB(l.costTHB)}</td>
                    <td className="p-2 text-right">
                      <button onClick={()=>removeLine(idx)} className="text-sm text-rose-600 underline hover:text-rose-800">Remove</button>
                    </td>
                  </tr>
                ))}
                {!linesWithCosts.length && (
                  <tr><td className="p-4 text-sm text-gray-600" colSpan={6}>Add ingredients to start costing.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6">
            <div className="text-xs text-gray-600">Recipe Cost</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(recipeCostTHB)}</div>
            <div className="mt-3 text-xs text-gray-600">Cost per Portion</div>
            <div className="text-2xl font-semibold tabular-nums">{THB(costPerPortionTHB)}</div>
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

      {/* Recipe Editor Modal */}
      {showRecipeEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <RecipeEditor
              initial={{
                name: recipeName,
                description: desc || note,
                components: linesWithCosts
              }}
              onSave={handleSaveAsRecipe}
              onCancel={() => setShowRecipeEditor(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
