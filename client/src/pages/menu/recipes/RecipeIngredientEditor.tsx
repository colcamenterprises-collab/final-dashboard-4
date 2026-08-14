import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { fmtMoney, makeIngredient, recipeIngredientCost, toNumber, type RecipeIngredientRow, type RecipeLineType } from "./recipeTypes";

type PurchasingIngredient = { id:number; item:string; category?:string|null; supplierName?:string|null; brand?:string|null; supplierSku?:string|null; unitCost?:number|string|null; purchaseCostThb?:number|string|null; purchaseQuantity?:number|string|null; baseUnit?:string|null; purchaseUnitLabel?:string|null; orderUnit?:string|null; unitDescription?:string|null; active?:boolean };
type Props = { rows:RecipeIngredientRow[]; draft:RecipeIngredientRow|null; onDraftChange:(row:RecipeIngredientRow|null)=>void; onRowsChange:(rows:RecipeIngredientRow[])=>void; lineType?:RecipeLineType };
const units=["g","kg","ml","L","each","pcs","pack","box","m"];

export default function RecipeIngredientEditor({rows,draft,onDraftChange,onRowsChange,lineType="ingredient"}:Props) {
 const isPackaging=lineType==="packaging";
 const noun=isPackaging?"packaging item":"ingredient";
 const title=isPackaging?"Packaging Costs":"Ingredients & Costing";
 const {data,isLoading}=useQuery<{items?:PurchasingIngredient[]}>({queryKey:["/api/purchasing-items"],queryFn:async()=>{const r=await fetch("/api/purchasing-items?active=true",{credentials:"include"});if(!r.ok)throw new Error("Could not load purchasing catalogue");return r.json();}});
 const catalogue=useMemo(()=> (data?.items??[]).filter(item=>{
   if(item.active===false)return false;
   const isPackagingItem=String(item.category??"").trim().toLowerCase()==="packaging";
   return isPackaging ? isPackagingItem : !isPackagingItem;
 }),[data,isPackaging]);
 const beginAdd=()=>onDraftChange(makeIngredient(lineType));
 const beginAverage=()=>onDraftChange({...makeIngredient("packaging"),name:"Average packaging allowance",purchaseCost:"",packageQuantity:"1",purchaseUnit:"each",quantityUsed:"1",unitUsed:"each",wastePercent:"",costingStatus:"average_packaging"});
 const useManual=()=>{if(!draft)return;onDraftChange({...draft,lineType,ingredientId:null,purchasingItemId:null,purchasingItemKey:"",sourceType:"manual",autoUnitCost:null,costingStatus:"manual_override"});};
 const selectIngredient=(id:string)=>{
   if(!draft)return;
   if(id==="manual"){useManual();return;}
   const item=catalogue.find(x=>x.id===Number(id));
   if(!item)return;
   onDraftChange({...draft,lineType,ingredientId:null,purchasingItemId:item.id,purchasingItemKey:String(item.id),name:item.item,sourceType:"purchasing",purchaseCost:String(item.purchaseCostThb??item.unitCost??""),packageQuantity:String(item.purchaseQuantity??""),purchaseUnit:item.baseUnit||item.orderUnit||item.unitDescription||"",unitUsed:item.baseUnit||item.orderUnit||item.unitDescription||"",wastePercent:"",autoUnitCost:null,manualOverrideUnitCost:"",costingStatus:"current_purchasing_price"});
 };
 const manualPatch=(patch:Partial<RecipeIngredientRow>)=>{if(!draft)return;onDraftChange({...draft,...patch,lineType,ingredientId:null,purchasingItemId:null,purchasingItemKey:"",sourceType:"manual",autoUnitCost:null,costingStatus:isPackaging?"manual_packaging":"manual_override"});};
 const saveDraft=()=>{if(!draft||!draft.name.trim())return;const exists=rows.some(r=>r.id===draft.id);onRowsChange(exists?rows.map(r=>r.id===draft.id?draft:r):[...rows,{...draft,lineType}]);onDraftChange(null);};
 const draftCost=draft?recipeIngredientCost(draft):{baseCost:null,wasteCost:null,lineCost:null};
 const selectedValue=draft?.sourceType==="manual" ? "manual" : String(draft?.purchasingItemId??"");
 return <section className="space-y-3 rounded-lg border bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{isPackaging?"Use an average allowance for fast setup, or select individual Packaging catalogue items for exact packaging reporting.":"Select a Purchasing item to prefill the current pack data. Change any purchasing-data field below to create a recipe-only manual/special-price override."}</p></div><div className="flex gap-2">{isPackaging&&<button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={beginAverage}>Add average cost</button>}<button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={beginAdd}>Add {isPackaging?"packaging":"ingredient"}</button></div></div>
  {draft&&<div className="space-y-3 rounded-lg border p-3"><div className="grid grid-cols-1 gap-2 md:grid-cols-2">
   <label className="block text-xs font-medium">Purchasing {noun} (optional)<select value={selectedValue} onChange={ev=>selectIngredient(ev.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-xs"><option value="">{isLoading?"Loading purchasing catalogue…":"Select to prefill"}</option><option value="manual">Manual / special-price {noun}</option>{catalogue.map(i=><option key={i.id} value={i.id}>{i.item} · {fmtMoney(i.purchaseCostThb??i.unitCost)} · {i.purchaseQuantity ? `${i.purchaseQuantity} ${i.baseUnit||""}` : (i.purchaseUnitLabel||i.orderUnit||i.unitDescription||"pack details pending")}</option>)}</select></label>
   <label className="block text-xs font-medium">{isPackaging?"Packaging item name":"Ingredient name"}<Input value={draft.name} onChange={ev=>manualPatch({name:ev.target.value})} className="mt-1"/></label>
   <label className="block text-xs font-medium">Purchase cost (THB)<Input type="number" min="0" step="any" value={draft.purchaseCost} onChange={ev=>manualPatch({purchaseCost:ev.target.value,manualOverrideUnitCost:""})} className="mt-1"/></label>
   <label className="block text-xs font-medium">Package size / purchase quantity<Input type="number" min="0" step="any" value={draft.packageQuantity} onChange={ev=>manualPatch({packageQuantity:ev.target.value})} className="mt-1"/></label>
   <label className="block text-xs font-medium">Purchase unit<select value={draft.purchaseUnit} onChange={ev=>manualPatch({purchaseUnit:ev.target.value})} className="mt-1 w-full rounded border px-2 py-2 text-xs"><option value="">Select unit</option>{units.map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="block text-xs font-medium">Waste %<Input type="number" min="0" max="99" step="any" placeholder="Blank = 0%" value={draft.wastePercent} onChange={ev=>onDraftChange({...draft,wastePercent:ev.target.value})} className="mt-1"/></label>
   <label className="block text-xs font-medium">Quantity used<Input type="number" min="0" step="any" value={draft.quantityUsed} onChange={ev=>onDraftChange({...draft,quantityUsed:ev.target.value})} className="mt-1"/></label>
   <label className="block text-xs font-medium">Usage unit<select value={draft.unitUsed} onChange={ev=>onDraftChange({...draft,unitUsed:ev.target.value})} className="mt-1 w-full rounded border px-2 py-2 text-xs"><option value="">Select unit</option>{units.map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="block text-xs font-medium md:col-span-2">Notes<Input value={draft.notes} onChange={ev=>onDraftChange({...draft,notes:ev.target.value})} className="mt-1"/></label>
  </div><div className="flex items-center justify-between"><span className="text-xs">Base: <b>{fmtMoney(draftCost.baseCost)}</b> · Waste: <b>{fmtMoney(draftCost.wasteCost)}</b> · Line cost: <b>{fmtMoney(draftCost.lineCost)}</b></span><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={()=>onDraftChange(null)}>Cancel</button><button type="button" disabled={!draft.name||draftCost.lineCost===null} className="rounded-lg bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40" onClick={saveDraft}>Save {isPackaging?"packaging":"ingredient"}</button></div></div></div>}
  <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[960px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">{isPackaging?"Packaging item":"Ingredient"}</th><th className="p-2 text-left">Purchase cost</th><th className="p-2 text-left">Package size</th><th className="p-2 text-left">Purchase unit</th><th className="p-2 text-left">Waste</th><th className="p-2 text-left">Quantity used</th><th className="p-2 text-left">Usage unit</th><th className="p-2 text-left">Line cost</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{rows.length===0?<tr><td className="p-3" colSpan={9}>No {isPackaging?"packaging costs":"ingredients"} added.</td></tr>:rows.map(row=>{const cost=recipeIngredientCost(row);return <tr key={row.id} className="border-b"><td className="p-2 font-medium">{row.name}</td><td className="p-2">{fmtMoney(toNumber(row.manualOverrideUnitCost)??row.purchaseCost)}</td><td className="p-2">{row.packageQuantity||"—"}</td><td className="p-2">{row.purchaseUnit||"—"}</td><td className="p-2">{row.wastePercent||"0"}%</td><td className="p-2">{row.quantityUsed||"—"}</td><td className="p-2">{row.unitUsed||"—"}</td><td className="p-2 font-mono">{fmtMoney(cost.lineCost)}</td><td className="p-2"><button type="button" className="mr-2 underline" onClick={()=>onDraftChange({...row,lineType})}>Edit</button><button type="button" className="text-red-700 underline" onClick={()=>onRowsChange(rows.filter(x=>x.id!==row.id))}>Delete</button></td></tr>})}</tbody></table></div>
 </section>;
}