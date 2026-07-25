import { Input } from "@/components/ui/input";
import { fmtMoney, makeIngredient, toNumber, type RecipeIngredientRow } from "./recipeTypes";

type Props = {
  rows: RecipeIngredientRow[];
  draft: RecipeIngredientRow | null;
  onDraftChange: (row: RecipeIngredientRow | null) => void;
  onRowsChange: (rows: RecipeIngredientRow[]) => void;
};

export default function RecipeIngredientEditor({ rows, draft, onDraftChange, onRowsChange }: Props) {
  const beginAdd = () => onDraftChange({ ...makeIngredient(), sourceType: "manual", costingStatus: null });
  const saveDraft = () => {
    if (!draft) return;
    const normalized = {
      ...draft,
      sourceType: "manual" as const,
      purchasingItemId: null,
      purchasingItemKey: "",
      autoUnitCost: null,
      costingStatus: null,
    };
    const exists = rows.some((row) => row.id === normalized.id);
    onRowsChange(exists ? rows.map((row) => row.id === normalized.id ? normalized : row) : [...rows, normalized]);
    onDraftChange(null);
  };

  const unitCost = draft ? toNumber(draft.manualOverrideUnitCost) : null;
  const quantity = draft ? toNumber(draft.quantityUsed) : null;
  const draftLineCost = unitCost !== null && quantity !== null ? unitCost * quantity : null;

  return <section className="space-y-3 rounded-lg border bg-white p-4">
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Ingredients</h2><p className="mt-1 text-xs text-slate-500">Enter each ingredient, quantity, unit and unit cost manually. This recipe does not use Purchasing data.</p></div><button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={beginAdd}>Add Ingredient</button></div>
    {draft && <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block text-xs font-medium">Ingredient<Input placeholder="e.g. Cheese" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value, sourceType: "manual" })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Quantity used<Input type="number" min="0" step="any" placeholder="e.g. 2" value={draft.quantityUsed} onChange={(event) => onDraftChange({ ...draft, quantityUsed: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Unit<Input placeholder="e.g. slices, g, ml, each" value={draft.unitUsed} onChange={(event) => onDraftChange({ ...draft, unitUsed: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Unit cost (THB)<Input type="number" min="0" step="any" placeholder="e.g. 8" value={draft.manualOverrideUnitCost} onChange={(event) => onDraftChange({ ...draft, manualOverrideUnitCost: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium md:col-span-2">Notes<Input placeholder="Optional preparation or brand notes" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} className="mt-1" /></label>
      </div>
      <div className="flex items-center justify-between gap-3"><div className="text-xs">Line cost: <span className="font-mono font-semibold">{fmtMoney(draftLineCost)}</span></div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={() => onDraftChange(null)}>Cancel</button><button type="button" disabled={!draft.name.trim() || quantity === null || quantity <= 0 || !draft.unitUsed.trim() || unitCost === null || unitCost < 0} className="rounded-lg bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40" onClick={saveDraft}>Save Ingredient</button></div></div>
    </div>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Ingredient</th><th className="p-2 text-left">Quantity</th><th className="p-2 text-left">Unit</th><th className="p-2 text-left">Unit cost</th><th className="p-2 text-left">Line cost</th><th className="p-2 text-left">Notes</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{rows.length === 0 ? <tr><td className="p-3" colSpan={7}>No ingredients added.</td></tr> : rows.map((row) => { const cost = toNumber(row.manualOverrideUnitCost); const qty = toNumber(row.quantityUsed); return <tr key={row.id} className="border-b"><td className="p-2">{row.name || "UNMAPPED"}</td><td className="p-2 font-mono">{row.quantityUsed || "UNMAPPED"}</td><td className="p-2">{row.unitUsed || "UNMAPPED"}</td><td className="p-2 font-mono">{fmtMoney(cost)}</td><td className="p-2 font-mono">{fmtMoney(cost !== null && qty !== null ? cost * qty : null)}</td><td className="p-2">{row.notes || "—"}</td><td className="p-2"><div className="flex gap-2"><button className="text-xs underline" onClick={() => onDraftChange(row)}>Edit</button><button className="text-xs text-red-700 underline" onClick={() => onRowsChange(rows.filter((candidate) => candidate.id !== row.id))}>Delete</button></div></td></tr>; })}</tbody></table></div>
  </section>;
}
