import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const THB = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);
const N = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type Line = { name: string; packagePrice: number; totalUnits: number; unitType: string; unitsNeeded: number };
type LabourLine = { description: string; hours: number; hourlyRate: number; bonus: number };
type OtherLine = { name: string; cost: number };

type RecipePayload = {
  id: number;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  description: string;
  imageUrl: string;
  servingsThisRecipeMakes: number;
  servingsPerProduct: number;
  productsMade: number;
  ingredients: Line[];
  packaging: Line[];
  labour: LabourLine[];
  other: OtherLine[];
};

const newLine = (): Line => ({ name: "", packagePrice: 0, totalUnits: 0, unitType: "", unitsNeeded: 0 });

export default function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery<RecipePayload>({
    queryKey: ["recipe-v2", id],
    queryFn: async () => {
      const response = await fetch(`/api/recipes/v2/${id}`);
      if (!response.ok) throw new Error("Failed to fetch recipe");
      return response.json();
    },
  });

  const [state, setState] = useState<RecipePayload | null>(null);
  React.useEffect(() => { if (data) setState(data); }, [data]);

  const initialState = useMemo(() => data ? JSON.stringify(data) : "", [data]);
  const currentState = useMemo(() => state ? JSON.stringify(state) : "", [state]);
  const hasChanges = Boolean(state) && initialState !== currentState;

  if (isLoading || !state) return <div className="p-6">Loading...</div>;

  const productsMade = N(state.productsMade) || 1;
  const sumLine = (items: Line[]) => items.reduce((a, l) => a + ((N(l.totalUnits) > 0 ? N(l.packagePrice) / N(l.totalUnits) : 0) * N(l.unitsNeeded)), 0);
  const ingredientsCost = sumLine(state.ingredients);
  const packagingCost = sumLine(state.packaging);
  const labourCost = state.labour.reduce((a, l) => a + N(l.hours) * N(l.hourlyRate) + N(l.bonus), 0);
  const otherCost = state.other.reduce((a, l) => a + N(l.cost), 0);
  const totalCostPerRecipe = ingredientsCost + packagingCost + labourCost + otherCost;
  const totalCostPerProduct = productsMade > 0 ? totalCostPerRecipe / productsMade : 0;
  const profitPerProduct = N(state.salePrice) - totalCostPerProduct;
  const ingredientCostPct = N(state.salePrice) > 0 ? (ingredientsCost / productsMade / N(state.salePrice)) * 100 : 0;
  const totalCostPct = N(state.salePrice) > 0 ? (totalCostPerProduct / N(state.salePrice)) * 100 : 0;
  const profitMarginPct = N(state.salePrice) > 0 ? (profitPerProduct / N(state.salePrice)) * 100 : 0;

  const save = async () => {
    setSaving(true);
    const response = await fetch(`/api/recipes/v2/${state.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    setSaving(false);
    if (response.ok) refetch();
  };

  const reset = () => {
    if (data) setState(data);
  };

  const onUploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setState({ ...state, imageUrl: result });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.sku}-${state.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderLineTable = (title: string, key: "ingredients" | "packaging") => {
    const rows = state[key];
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-8 gap-2 text-xs font-semibold text-slate-600">
            <div>Item Name</div><div>Package Price</div><div>Total Units in Package</div><div>Unit Type</div><div>Units Needed</div><div>Cost per Unit</div><div>Cost per Recipe</div><div>Actions</div>
          </div>
          {rows.map((row, i) => {
            const cpu = N(row.totalUnits) > 0 ? N(row.packagePrice) / N(row.totalUnits) : 0;
            const cpr = cpu * N(row.unitsNeeded);
            return <div key={`${key}-${i}`} className="grid grid-cols-8 gap-2 items-center">
              <Input value={row.name} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, name: e.target.value }; setState({ ...state, [key]: next });
              }} placeholder="e.g., Brioche Bun" />
              <Input type="number" value={row.packagePrice} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, packagePrice: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="e.g., 82" />
              <Input type="number" value={row.totalUnits} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, totalUnits: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="e.g., 12" />
              <Input value={row.unitType} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, unitType: e.target.value }; setState({ ...state, [key]: next });
              }} placeholder="e.g., slices" />
              <Input type="number" value={row.unitsNeeded} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, unitsNeeded: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="e.g., 2" />
              <div className="text-sm">{THB(cpu)}</div>
              <div className="text-sm">{THB(cpr)}</div>
              <Button variant="outline" size="sm" onClick={() => setState({ ...state, [key]: rows.filter((_, idx) => idx !== i) })}>Remove</Button>
            </div>;
          })}
          <Button variant="outline" onClick={() => setState({ ...state, [key]: [...rows, newLine()] })}>Add Row</Button>
        </CardContent>
      </Card>
    );
  };

  return <div className="min-h-screen px-6 py-6">
    <div className="max-w-6xl mx-auto space-y-4 pb-28">
      <div className="flex gap-2"><Button variant="outline" onClick={() => navigate('/menu/recipes')}>Back</Button><Button variant="outline" onClick={download}>Download JSON</Button></div>
      <Card><CardHeader><CardTitle>Recipe Header</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><div className="text-sm font-medium mb-1">Recipe Name</div><Input value={state.name} disabled placeholder="Locked template name" /><div className="text-xs text-slate-500 mt-1">Locked template field (read-only).</div></div>
          <div><div className="text-sm font-medium mb-1">SKU</div><Input value={state.sku} disabled placeholder="Locked template SKU" /><div className="text-xs text-slate-500 mt-1">Locked template field (read-only).</div></div>
          <div><div className="text-sm font-medium mb-1">Category</div><Input value={state.category} disabled placeholder="Locked template category" /><div className="text-xs text-slate-500 mt-1">Locked template field (read-only).</div></div>
          <div><div className="text-sm font-medium mb-1">Sale Price</div><Input type="number" value={state.salePrice} onChange={(e) => setState({ ...state, salePrice: N(e.target.value) })} placeholder="e.g., 159" /><div className="text-xs text-slate-500 mt-1">Selling price per product in THB.</div></div>
          <div className="md:col-span-2"><div className="text-sm font-medium mb-1">Description</div><Textarea value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} placeholder="Add prep notes, serving details, and quality standards" /><div className="text-xs text-slate-500 mt-1">Shown for staff reference.</div></div>
          <div className="md:col-span-2 space-y-2"><div className="text-sm font-medium">Image</div><Input type="file" accept="image/*" onChange={onUploadImage} /><Input value={state.imageUrl} onChange={(e) => setState({ ...state, imageUrl: e.target.value })} placeholder="https://... (optional URL)" /><div className="text-xs text-slate-500">Upload an image file or provide an image URL. Preview updates immediately.</div>{state.imageUrl ? <img src={state.imageUrl} alt="Recipe preview" className="h-36 w-36 object-cover rounded border" /> : <div className="h-36 w-36 rounded border bg-slate-100 flex items-center justify-center text-xs text-slate-500">No image selected</div>}</div>
          <div><div className="text-sm font-medium mb-1">Servings This Recipe Makes</div><Input type="number" value={state.servingsThisRecipeMakes} onChange={(e) => setState({ ...state, servingsThisRecipeMakes: N(e.target.value) })} placeholder="e.g., 10" /></div>
          <div><div className="text-sm font-medium mb-1">Servings Per Product</div><Input type="number" value={state.servingsPerProduct} onChange={(e) => setState({ ...state, servingsPerProduct: N(e.target.value) })} placeholder="e.g., 1" /></div>
          <div><div className="text-sm font-medium mb-1">Products Made (Yield)</div><Input type="number" value={state.productsMade} onChange={(e) => setState({ ...state, productsMade: N(e.target.value) || 1 })} placeholder="e.g., 10" /><div className="text-xs text-slate-500 mt-1">Used for per-product totals.</div></div>
        </div>
      </CardContent></Card>

      {renderLineTable("Ingredients", "ingredients")}
      {renderLineTable("Packaging", "packaging")}

      <Card><CardHeader><CardTitle>Labour</CardTitle></CardHeader><CardContent className="space-y-2">
        <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-slate-600"><div>Item Name</div><div>Hours</div><div>Hourly Rate</div><div>Bonus</div><div>Actions</div></div>
        {state.labour.map((row, i) => <div key={i} className="grid grid-cols-5 gap-2 items-center">
          <Input value={row.description} onChange={(e) => { const next=[...state.labour]; next[i]={...row,description:e.target.value}; setState({...state, labour:next}); }} placeholder="e.g., Grill prep" />
          <Input type="number" value={row.hours} onChange={(e) => { const next=[...state.labour]; next[i]={...row,hours:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="e.g., 1.5" />
          <Input type="number" value={row.hourlyRate} onChange={(e) => { const next=[...state.labour]; next[i]={...row,hourlyRate:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="e.g., 120" />
          <Input type="number" value={row.bonus} onChange={(e) => { const next=[...state.labour]; next[i]={...row,bonus:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="e.g., 20" />
          <Button variant="outline" size="sm" onClick={() => setState({ ...state, labour: state.labour.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>)}
        <Button variant="outline" onClick={() => setState({ ...state, labour: [...state.labour, { description: "", hours: 0, hourlyRate: 0, bonus: 0 }] })}>Add Row</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Other</CardTitle></CardHeader><CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600"><div>Item Name</div><div>Cost</div><div>Actions</div></div>
        {state.other.map((row, i) => <div key={i} className="grid grid-cols-3 gap-2 items-center">
          <Input value={row.name} onChange={(e) => { const next=[...state.other]; next[i]={...row,name:e.target.value}; setState({...state, other:next}); }} placeholder="e.g., Cleaning materials" />
          <Input type="number" value={row.cost} onChange={(e) => { const next=[...state.other]; next[i]={...row,cost:N(e.target.value)}; setState({...state, other:next}); }} placeholder="e.g., 15" />
          <Button variant="outline" size="sm" onClick={() => setState({ ...state, other: state.other.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>)}
        <Button variant="outline" onClick={() => setState({ ...state, other: [...state.other, { name: "", cost: 0 }] })}>Add Row</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Totals</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-sm">
        <div>Total Cost per Recipe: {THB(totalCostPerRecipe)}</div>
        <div>Total Cost per Product: {THB(totalCostPerProduct)}</div>
        <div>Ingredients Total: {THB(ingredientsCost)}</div>
        <div>Packaging Total: {THB(packagingCost)}</div>
        <div>Labour Total: {THB(labourCost)}</div>
        <div>Other Total: {THB(otherCost)}</div>
        <div>Profit per Product: {THB(profitPerProduct)}</div>
        <div>Ingredient Cost %: {ingredientCostPct.toFixed(2)}%</div>
        <div>Total Cost %: {totalCostPct.toFixed(2)}%</div>
        <div>Profit Margin %: {profitMarginPct.toFixed(2)}%</div>
      </CardContent></Card>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur p-3">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2 items-center justify-between">
          <div className="text-sm text-slate-600">Templates cannot be deleted.</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!hasChanges || saving}>Reset/Discard</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
