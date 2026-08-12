import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { fmtMoney, makeIngredient, toNumber, type RecipeIngredientRow } from "./recipeTypes";

type CatalogueIngredient = {
  id: number;
  name: string;
  category?: string | null;
  baseUnit?: string | null;
  unitCostPerBase?: number | string | null;
  missingYield?: boolean;
};

type Props = {
  rows: RecipeIngredientRow[];
  draft: RecipeIngredientRow | null;
  onDraftChange: (row: RecipeIngredientRow | null) => void;
  onRowsChange: (rows: RecipeIngredientRow[]) => void;
};

export default function RecipeIngredientEditor({ rows, draft, onDraftChange, onRowsChange }: Props) {
  const { data, isLoading } = useQuery<{ items?: CatalogueIngredient[] }>({ queryKey: ["/api/ingredients/management"] });
  const catalogue = useMemo(() => (data?.items ?? []).filter((item) => !item.missingYield && toNumber(item.unitCostPerBase) !== null), [data]);
  const beginAdd = () => onDraftChange({ ...makeIngredient(), sourceType: "purchasing" });
  const selectIngredient = (id: string) => {
    const item = catalogue.find((candidate) => candidate.id === Number(id));
    if (!item || !draft) return;
    onDraftChange({
      ...draft,
      ingredientId: item.id,
      name: item.name,
      sourceType: "purchasing",
      purchasingItemId: null,
      purchasingItemKey: String(item.id),
      unitUsed: item.baseUnit || "each",
      autoUnitCost: toNumber(item.unitCostPerBase),
      manualOverrideUnitCost: "",
      costingStatus: "current_catalogue_price",
    });
  };
  const saveDraft = () => {
    if (!draft) return;
    const exists = rows.some((row) => row.id === draft.id);
    onRowsChange(exists ? rows.map((row) => row.id === draft.id ? draft : row) : [...rows, draft]);
    onDraftChange(null);
  };

  const unitCost = draft ? (toNumber(draft.manualOverrideUnitCost) ?? toNumber(draft.autoUnitCost)) : null;
  const quantity = draft ? toNumber(draft.quantityUsed) : null;
  const draftLineCost = unitCost !== null && quantity !== null ? unitCost * quantity : null;

  return <section className="space-y-3 rounded-lg border bg-white p-4">
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Ingredients</h2><p className="mt-1 text-xs text-slate-500">Choose a catalogue ingredient, enter its recipe quantity, and the current purchasing cost calculates automatically.</p></div><button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={beginAdd}>Add Ingredient</button></div>
    {draft && <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block text-xs font-medium">Catalogue ingredient<select value={draft.ingredientId ?? ""} onChange={(event) => selectIngredient(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-xs"><option value="">{isLoading ? "Loading ingredient catalogue..." : "Select an ingredient"}</option>{catalogue.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.baseUnit || "each"} · {fmtMoney(item.unitCostPerBase)}/{item.baseUnit || "each"}</option>)}</select></label>
        <label className="block text-xs font-medium">Quantity used<Input type="number" min="0" step="any" placeholder="e.g. 90" value={draft.quantityUsed} onChange={(event) => onDraftChange({ ...draft, quantityUsed: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Recipe unit<Input readOnly value={draft.unitUsed} className="mt-1 bg-slate-50" /></label>
        <label className="block text-xs font-medium">Current catalogue cost (THB/{draft.unitUsed || "unit"})<Input readOnly value={unitCost === null ? "" : unitCost.toFixed(6)} className="mt-1 bg-slate-50" /></label>
        <label className="block text-xs font-medium md:col-span-2">Notes<Input placeholder="Optional preparation or brand notes" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} className="mt-1" /></label>
      </div>
      <div className="flex items-center justify-between gap-3"><div className="text-xs">Line cost: <span className="font-mono font-semibold">{fmtMoney(draftLineCost)}</span></div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={() => onDraftChange(null)}>Cancel</button><button type="button" disabled={!draft.ingredientId || quantity === null || quantity <= 0 || unitCost === null || unitCost < 0} className="rounded-lg bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40" onClick={saveDraft}>Save Ingredient</button></div></div>
    </div>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Ingredient</th><th className="p-2 text-left">Quantity</th><th className="p-2 text-left">Unit</th><th className="p-2 text-left">Current unit cost</th><th className="p-2 text-left">Line cost</th><th className="p-2 text-left">Notes</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{rows.length === 0 ? <tr><td className="p-3" colSpan={7}>No ingredients added.</td></tr> : rows.map((row) => { const cost = toNumber(row.manualOverrideUnitCost) ?? toNumber(row.autoUnitCost); const qty = toNumber(row.quantityUsed); return <tr key={row.id} className="border-b"><td className="p-2">{row.name || "UNMAPPED"}</td><td className="p-2 font-mono">{row.quantityUsed || "UNMAPPED"}</td><td className="p-2">{row.unitUsed || "UNMAPPED"}</td><td className="p-2 font-mono">{fmtMoney(cost)}</td><td className="p-2 font-mono">{fmtMoney(cost !== null && qty !== null ? cost * qty : null)}</td><td className="p-2">{row.notes || "—"}</td><td className="p-2"><div className="flex gap-2"><button className="text-xs underline" onClick={() => onDraftChange(row)}>Edit</button><button className="text-xs text-red-700 underline" onClick={() => onRowsChange(rows.filter((candidate) => candidate.id !== row.id))}>Delete</button></div></td></tr>; })}</tbody></table></div>
  </section>;
}
