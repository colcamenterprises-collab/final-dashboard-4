import { Input } from "@/components/ui/input";
import { calculateAutoUnitCost, fmtMoney, makeIngredient, purchasingKey, toNumber, VALID_UNITS, type PurchasingLine, type RecipeIngredientRow } from "./recipeTypes";

type Props = {
  purchasingLines: PurchasingLine[];
  rows: RecipeIngredientRow[];
  draft: RecipeIngredientRow | null;
  onDraftChange: (row: RecipeIngredientRow | null) => void;
  onRowsChange: (rows: RecipeIngredientRow[]) => void;
};

export default function RecipeIngredientEditor({ purchasingLines, rows, draft, onDraftChange, onRowsChange }: Props) {
  const beginAdd = () => onDraftChange(makeIngredient());
  const saveDraft = () => {
    if (!draft) return;
    const exists = rows.some((row) => row.id === draft.id);
    onRowsChange(exists ? rows.map((row) => row.id === draft.id ? draft : row) : [...rows, draft]);
    onDraftChange(null);
  };
  const selectByName = (value: string) => {
    if (!draft) return;
    const match = purchasingLines.find((line) => (line.item || line.name || "").toLowerCase() === value.trim().toLowerCase());
    if (!match) {
      onDraftChange({ ...draft, name: value, sourceType: "manual", purchasingItemId: null, purchasingItemKey: "", autoUnitCost: null, costingStatus: value.trim() ? "Create new ingredient if no purchasing item exists" : null });
      return;
    }
    const index = purchasingLines.indexOf(match);
    const unitUsed = match.unitDescription || match.purchaseUnit || match.orderUnit || match.purchaseUnitLabel || "Each";
    const costing = calculateAutoUnitCost(match, unitUsed);
    onDraftChange({ ...draft, name: match.item || match.name || value, sourceType: "purchasing", purchasingItemId: typeof match.id === "number" ? match.id : Number(match.id) || null, purchasingItemKey: purchasingKey(match, index), unitUsed, autoUnitCost: costing.cost, costingStatus: costing.reason });
  };

  return <section className="border rounded-lg bg-white p-4 space-y-3">
    <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Ingredients</h2><button type="button" className="text-xs px-3 py-1.5 border rounded-lg" onClick={beginAdd}>Add Ingredient</button></div>
    {draft && <div className="border rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="block text-xs font-medium">Ingredient search/select<Input list="recipe-purchasing-items" placeholder="Type to search Purchasing List, e.g. Burger Bun" value={draft.name} onChange={(event) => selectByName(event.target.value)} className="mt-1" /></label>
        <datalist id="recipe-purchasing-items">{purchasingLines.map((line, index) => <option key={purchasingKey(line, index)} value={line.item || line.name || "UNMAPPED"} />)}</datalist>
        <label className="block text-xs font-medium">Quantity used<Input placeholder="Quantity used" value={draft.quantityUsed} onChange={(event) => onDraftChange({ ...draft, quantityUsed: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Unit used<select value={draft.unitUsed} onChange={(event) => { const line = purchasingLines.find((candidate, index) => purchasingKey(candidate, index) === draft.purchasingItemKey); const costing = calculateAutoUnitCost(line, event.target.value); onDraftChange({ ...draft, unitUsed: event.target.value, autoUnitCost: costing.cost, costingStatus: draft.purchasingItemKey ? costing.reason : draft.costingStatus }); }} className="mt-1 w-full border rounded px-2 py-2 text-xs"><option value="">Unit used</option>{VALID_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label className="block text-xs font-medium">Manual override unit cost<Input placeholder="Optional manual override unit cost" value={draft.manualOverrideUnitCost} onChange={(event) => onDraftChange({ ...draft, manualOverrideUnitCost: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium md:col-span-2">Notes<Input placeholder="Notes" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} className="mt-1" /></label>
      </div>
      <div className="flex items-center justify-between gap-3"><div className="text-xs">Unit cost source: <span className="font-mono">{toNumber(draft.manualOverrideUnitCost) !== null ? fmtMoney(draft.manualOverrideUnitCost) : draft.costingStatus ?? fmtMoney(draft.autoUnitCost)}</span></div><div className="flex gap-2"><button type="button" className="text-xs px-3 py-1.5 border rounded-lg" onClick={() => onDraftChange(null)}>Cancel</button><button type="button" disabled={!draft.name || !draft.quantityUsed || !draft.unitUsed} className="text-xs px-3 py-1.5 bg-black text-white rounded-lg disabled:opacity-40" onClick={saveDraft}>Save Ingredient</button></div></div>
    </div>}
    <div className="border rounded-lg overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="text-left p-2">Ingredient</th><th className="text-left p-2">Quantity</th><th className="text-left p-2">Unit</th><th className="text-left p-2">Unit cost</th><th className="text-left p-2">Line cost</th><th className="text-left p-2">Notes</th><th className="text-left p-2">Actions</th></tr></thead><tbody>{rows.length === 0 ? <tr><td className="p-3" colSpan={7}>No ingredients added.</td></tr> : rows.map((row) => { const cost = toNumber(row.manualOverrideUnitCost) ?? row.autoUnitCost; const qty = toNumber(row.quantityUsed); return <tr key={row.id} className="border-b"><td className="p-2">{row.name || "UNMAPPED"}</td><td className="p-2 font-mono">{row.quantityUsed || "UNMAPPED"}</td><td className="p-2">{row.unitUsed || "UNMAPPED"}</td><td className="p-2 font-mono">{row.costingStatus && cost === null ? row.costingStatus : fmtMoney(cost)}</td><td className="p-2 font-mono">{fmtMoney(cost !== null && qty !== null ? cost * qty : null)}</td><td className="p-2">{row.notes || "—"}</td><td className="p-2"><div className="flex gap-2"><button className="text-xs underline" onClick={() => onDraftChange(row)}>Edit</button><button className="text-xs underline text-red-700" onClick={() => onRowsChange(rows.filter((candidate) => candidate.id !== row.id))}>Delete</button></div></td></tr>; })}</tbody></table></div>
  </section>;
}
