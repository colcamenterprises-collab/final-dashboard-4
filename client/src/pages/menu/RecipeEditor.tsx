import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const THB = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);
const N = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const UNITS = ["kg", "g", "L", "ml", "each"] as const;
type Unit = typeof UNITS[number] | "";
type Line = { name: string; packagePrice: number; totalUnits: number; unitType: string; unitsNeeded: number; packSize: number; packUnit: Unit; packPrice: number; recipeQty: number; recipeUnit: Unit };
type LabourLine = { description: string; hours: number; hourlyRate: number; bonus: number };
type OtherLine = { name: string; cost: number };
type RecipePayload = {
  id: number; name: string; sku: string; category: string; salePrice: number; description: string; imageUrl: string;
  servingsThisRecipeMakes: number; servingsPerProduct: number; productsMade: number; slippagePercent: number;
  ingredients: Line[]; packaging: Line[]; labour: LabourLine[]; other: OtherLine[]; published?: boolean;
};

const asUnit = (value: unknown): Unit => (UNITS.includes(value as Unit) ? (value as Unit) : "");
const normalizeLine = (line: Partial<Line>): Line => ({
  name: line.name ?? "", packagePrice: N(line.packPrice ?? line.packagePrice), totalUnits: N(line.packSize ?? line.totalUnits), unitType: String(line.unitType ?? ""),
  unitsNeeded: N(line.recipeQty ?? line.unitsNeeded), packSize: N(line.packSize ?? line.totalUnits), packUnit: asUnit(line.packUnit ?? line.unitType),
  packPrice: N(line.packPrice ?? line.packagePrice), recipeQty: N(line.recipeQty ?? line.unitsNeeded), recipeUnit: asUnit(line.recipeUnit ?? line.unitType),
});
const normalizePayload = (payload: RecipePayload): RecipePayload => ({ ...payload, ingredients: (payload.ingredients || []).map(normalizeLine), packaging: (payload.packaging || []).map(normalizeLine) });
const newLine = (): Line => normalizeLine({ name: "" });

const toBaseUnit = (qty: number, unit: Unit) => unit === "kg" ? { f: "w", v: qty * 1000 } : unit === "g" ? { f: "w", v: qty } : unit === "L" ? { f: "v", v: qty * 1000 } : unit === "ml" ? { f: "v", v: qty } : unit === "each" ? { f: "e", v: qty } : { f: "n", v: qty };
const getLineCost = (line: Line) => {
  const packBase = toBaseUnit(N(line.packSize), line.packUnit);
  const recipeBase = toBaseUnit(N(line.recipeQty), line.recipeUnit);
  if (packBase.v <= 0 || recipeBase.v <= 0 || packBase.f !== recipeBase.f) return 0;
  return N(line.packPrice) * (recipeBase.v / packBase.v);
};

export default function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { data, isLoading, refetch } = useQuery<RecipePayload>({
    queryKey: ["recipe-v2", id],
    queryFn: async () => {
      const response = await fetch(`/api/recipes/v2/${id}`);
      if (!response.ok) throw new Error("Failed to fetch recipe");
      return response.json();
    },
  });

  const [state, setState] = useState<RecipePayload | null>(null);
  React.useEffect(() => { if (data) setState(normalizePayload(data)); }, [data]);

  const initialState = useMemo(() => (data ? JSON.stringify(normalizePayload(data)) : ""), [data]);
  const currentState = useMemo(() => (state ? JSON.stringify(state) : ""), [state]);
  const hasChanges = Boolean(state) && initialState !== currentState;

  if (isLoading || !state) return <div className="p-6">Loading...</div>;

  const sumLine = (items: Line[]) => items.reduce((a, l) => a + getLineCost(l), 0);
  const ingredientsCost = sumLine(state.ingredients);
  const packagingCost = sumLine(state.packaging);
  const labourCost = state.labour.reduce((a, l) => a + N(l.hours) * N(l.hourlyRate) + N(l.bonus), 0);
  const otherCost = state.other.reduce((a, l) => a + N(l.cost), 0);
  const baseCost = ingredientsCost + packagingCost + labourCost + otherCost;
  const totalCost = baseCost + (baseCost * N(state.slippagePercent)) / 100;
  const totalCostPerProduct = totalCost / (N(state.productsMade) || 1);
  const profitPerProduct = N(state.salePrice) - totalCostPerProduct;
  const costPct = N(state.salePrice) > 0 ? (totalCostPerProduct / N(state.salePrice)) * 100 : 0;
  const marginPct = N(state.salePrice) > 0 ? (profitPerProduct / N(state.salePrice)) * 100 : 0;

  const breakdownData = [
    { name: "Ingredients", value: ingredientsCost, color: "#0f766e" },
    { name: "Packaging", value: packagingCost, color: "#2563eb" },
    { name: "Labour", value: labourCost, color: "#7c3aed" },
    { name: "Other", value: otherCost, color: "#ca8a04" },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/recipes/v2/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!res.ok) throw new Error("Save failed");
      alert("Recipe saved");
      await refetch();
    } catch (e: any) { alert(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/online/products/upsert-from-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipeId: state.id }) });
      if (!res.ok) throw new Error("Publish failed");
      alert("Published to online ordering");
      await refetch();
    } catch (e: any) { alert(e?.message || "Publish failed"); }
    finally { setPublishing(false); }
  };

  const unpublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/online/products/unpublish-from-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipeId: state.id }) });
      if (!res.ok) throw new Error("Unpublish failed");
      alert("Unpublished from online ordering");
      await refetch();
    } catch (e: any) { alert(e?.message || "Unpublish failed"); }
    finally { setPublishing(false); }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.sku || state.id}-recipe.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderLineTable = (title: string, key: "ingredients" | "packaging") => (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-8 gap-2 text-xs font-semibold text-slate-600"><div>Name</div><div>Pack Size</div><div>Pack Unit</div><div>Pack Price</div><div>Recipe Qty</div><div>Recipe Unit</div><div>Cost</div><div /></div>
        {state[key].map((row, i) => (
          <div key={i} className="grid grid-cols-8 gap-2 items-center">
            <Input value={row.name} placeholder="Item name" onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, name: e.target.value }; setState({ ...state, [key]: next }); }} />
            <Input type="number" value={row.packSize} placeholder="0" onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, packSize: N(e.target.value) }; setState({ ...state, [key]: next }); }} />
            <select className="h-10 rounded-md border border-input px-2 text-sm" value={row.packUnit} onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, packUnit: asUnit(e.target.value) }; setState({ ...state, [key]: next }); }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <Input type="number" value={row.packPrice} placeholder="0" onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, packPrice: N(e.target.value) }; setState({ ...state, [key]: next }); }} />
            <Input type="number" value={row.recipeQty} placeholder="0" onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, recipeQty: N(e.target.value) }; setState({ ...state, [key]: next }); }} />
            <select className="h-10 rounded-md border border-input px-2 text-sm" value={row.recipeUnit} onChange={(e) => { const next = [...state[key]]; next[i] = { ...row, recipeUnit: asUnit(e.target.value) }; setState({ ...state, [key]: next }); }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <div className="text-sm">{THB(getLineCost(row))}</div>
            <Button size="sm" variant="outline" onClick={() => setState({ ...state, [key]: state[key].filter((_, idx) => idx !== i) })}>Remove</Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setState({ ...state, [key]: [...state[key], newLine()] })}>Add Row</Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="bg-slate-50 pb-24">
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Card>
          <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{state.name}</h1>
                <Badge variant={state.published ? "default" : "secondary"}>{state.published ? "Published" : "Draft"}</Badge>
              </div>
              <div className="text-sm text-slate-600">SKU {state.sku} · {state.category || "Unmapped"} · {THB(state.salePrice)}</div>
              <Textarea value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} placeholder="Recipe description" />
            </div>
            <div className="space-y-2">
              {state.imageUrl ? <img src={state.imageUrl} alt={state.name} className="h-40 w-full rounded-md border object-cover" /> : <div className="flex h-40 items-center justify-center rounded-md border bg-slate-100 text-xs text-slate-500">No image</div>}
              <Input value={state.imageUrl} onChange={(e) => setState({ ...state, imageUrl: e.target.value })} placeholder="Image URL" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardHeader><CardTitle>Breakdown</CardTitle></CardHeader><CardContent className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>{breakdownData.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip formatter={(v: any) => THB(Number(v))} /></PieChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Profit vs Cost</CardTitle></CardHeader><CardContent className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Per Product", cost: totalCostPerProduct, profit: Math.max(profitPerProduct, 0) }]}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: any) => THB(Number(v))} /><Bar dataKey="cost" fill="#ef4444" /><Bar dataKey="profit" fill="#22c55e" /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Margins</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-1 text-sm">Cost %</div><Progress value={Math.max(0, Math.min(100, costPct))} /><div className="mt-1 text-xs text-slate-500">{costPct.toFixed(2)}%</div></div><div><div className="mb-1 text-sm">Profit Margin</div><Progress value={Math.max(0, Math.min(100, marginPct))} /><div className="mt-1 text-xs text-slate-500">{marginPct.toFixed(2)}%</div></div></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle>Recipe Details</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><div><label className="mb-1 block text-sm">Category</label><Input value={state.category} placeholder="Category" onChange={(e) => setState({ ...state, category: e.target.value })} /></div><div><label className="mb-1 block text-sm">Sale Price</label><Input type="number" value={state.salePrice} placeholder="0" onChange={(e) => setState({ ...state, salePrice: N(e.target.value) })} /></div><div><label className="mb-1 block text-sm">Products Made</label><Input type="number" value={state.productsMade} placeholder="1" onChange={(e) => setState({ ...state, productsMade: N(e.target.value) || 1 })} /></div></CardContent></Card>

        {renderLineTable("Ingredients", "ingredients")}
        {renderLineTable("Packaging", "packaging")}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Button variant="outline" onClick={() => navigate("/menu/recipes")}>Back</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadJson}>Download JSON</Button>
            <Button variant="secondary" onClick={state.published ? unpublish : publish} disabled={publishing}>{publishing ? "Working..." : state.published ? "Unpublish" : "Publish"}</Button>
            <Button onClick={save} disabled={saving || !hasChanges}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
