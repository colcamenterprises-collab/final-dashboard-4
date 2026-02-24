import React, { useState } from "react";
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

const newLine = (): Line => ({ name: "", packagePrice: 0, totalUnits: 0, unitType: "g", unitsNeeded: 0 });

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
  if (isLoading || !state) return <div className="p-6">Loading...</div>;

  const productsMade = N(state.productsMade) || 1;
  const sumLine = (items: Line[]) => items.reduce((a, l) => a + (N(l.packagePrice) / (N(l.totalUnits) || 1)) * N(l.unitsNeeded), 0);
  const ingredientsCost = sumLine(state.ingredients);
  const packagingCost = sumLine(state.packaging);
  const labourCost = state.labour.reduce((a, l) => a + N(l.hours) * N(l.hourlyRate) + N(l.bonus), 0);
  const otherCost = state.other.reduce((a, l) => a + N(l.cost), 0);
  const totalCostPerRecipe = ingredientsCost + packagingCost + labourCost + otherCost;
  const totalCostPerProduct = totalCostPerRecipe / productsMade;
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
          {rows.map((row, i) => {
            const cpu = N(row.packagePrice) / (N(row.totalUnits) || 1);
            const cpr = cpu * N(row.unitsNeeded);
            return <div key={`${key}-${i}`} className="grid grid-cols-7 gap-2">
              <Input value={row.name} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, name: e.target.value }; setState({ ...state, [key]: next });
              }} placeholder="Name" />
              <Input type="number" value={row.packagePrice} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, packagePrice: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="Package Price" />
              <Input type="number" value={row.totalUnits} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, totalUnits: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="Total Units" />
              <Input value={row.unitType} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, unitType: e.target.value }; setState({ ...state, [key]: next });
              }} placeholder="Unit Type" />
              <Input type="number" value={row.unitsNeeded} onChange={(e) => {
                const next = [...rows]; next[i] = { ...row, unitsNeeded: N(e.target.value) }; setState({ ...state, [key]: next });
              }} placeholder="Units Needed" />
              <div className="text-sm pt-2">{THB(cpu)}</div>
              <div className="text-sm pt-2">{THB(cpr / productsMade)}</div>
            </div>;
          })}
          <Button variant="outline" onClick={() => setState({ ...state, [key]: [...rows, newLine()] })}>Add Row</Button>
        </CardContent>
      </Card>
    );
  };

  return <div className="min-h-screen px-6 py-6">
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex gap-2"><Button variant="outline" onClick={() => navigate('/menu/recipes')}>Back</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button><Button variant="outline" onClick={download}>Download JSON</Button></div>
      <Card><CardHeader><CardTitle>Recipe Header</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2">
        <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Name" />
        <Input value={state.sku} disabled placeholder="SKU" />
        <Input value={state.category} onChange={(e) => setState({ ...state, category: e.target.value })} placeholder="Category" />
        <Input type="number" value={state.salePrice} onChange={(e) => setState({ ...state, salePrice: N(e.target.value) })} placeholder="Sale Price" />
        <Input value={state.imageUrl} onChange={(e) => setState({ ...state, imageUrl: e.target.value })} placeholder="Image URL" className="col-span-2" />
        <Textarea value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} placeholder="Description" className="col-span-2" />
        <Input type="number" value={state.servingsThisRecipeMakes} onChange={(e) => setState({ ...state, servingsThisRecipeMakes: N(e.target.value) })} placeholder="Number of servings this recipe makes" />
        <Input type="number" value={state.servingsPerProduct} onChange={(e) => setState({ ...state, servingsPerProduct: N(e.target.value) })} placeholder="Number of servings per product" />
        <Input type="number" value={state.productsMade} onChange={(e) => setState({ ...state, productsMade: N(e.target.value) || 1 })} placeholder="Number of products this recipe makes" />
      </CardContent></Card>

      {renderLineTable("Ingredients", "ingredients")}
      {renderLineTable("Packaging", "packaging")}

      <Card><CardHeader><CardTitle>Labour</CardTitle></CardHeader><CardContent className="space-y-2">
        {state.labour.map((row, i) => <div key={i} className="grid grid-cols-5 gap-2">
          <Input value={row.description} onChange={(e) => { const next=[...state.labour]; next[i]={...row,description:e.target.value}; setState({...state, labour:next}); }} placeholder="Description" />
          <Input type="number" value={row.hours} onChange={(e) => { const next=[...state.labour]; next[i]={...row,hours:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="Hours" />
          <Input type="number" value={row.hourlyRate} onChange={(e) => { const next=[...state.labour]; next[i]={...row,hourlyRate:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="Hourly Rate" />
          <Input type="number" value={row.bonus} onChange={(e) => { const next=[...state.labour]; next[i]={...row,bonus:N(e.target.value)}; setState({...state, labour:next}); }} placeholder="Bonus" />
          <div className="text-sm pt-2">{THB((N(row.hours) * N(row.hourlyRate) + N(row.bonus)) / productsMade)}</div>
        </div>)}
        <Button variant="outline" onClick={() => setState({ ...state, labour: [...state.labour, { description: "", hours: 0, hourlyRate: 0, bonus: 0 }] })}>Add Labour</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Other</CardTitle></CardHeader><CardContent className="space-y-2">
        {state.other.map((row, i) => <div key={i} className="grid grid-cols-3 gap-2">
          <Input value={row.name} onChange={(e) => { const next=[...state.other]; next[i]={...row,name:e.target.value}; setState({...state, other:next}); }} placeholder="Name" />
          <Input type="number" value={row.cost} onChange={(e) => { const next=[...state.other]; next[i]={...row,cost:N(e.target.value)}; setState({...state, other:next}); }} placeholder="Cost" />
          <div className="text-sm pt-2">{THB(N(row.cost) / productsMade)}</div>
        </div>)}
        <Button variant="outline" onClick={() => setState({ ...state, other: [...state.other, { name: "", cost: 0 }] })}>Add Other</Button>
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
    </div>
  </div>;
}
