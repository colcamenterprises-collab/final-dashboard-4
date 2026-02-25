import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const THB = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);
const N = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const UNITS = ["g", "kg", "ml", "l", "each", "pcs"] as const;
type Unit = (typeof UNITS)[number] | "";
type Line = {
  name: string;
  packagePrice: number;
  totalUnits: number;
  unitType: string;
  unitsNeeded: number;
  packSize: number;
  packUnit: Unit;
  packPrice: number;
  recipeQty: number;
  recipeUnit: Unit;
};
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
  slippagePercent: number;
  ingredients: Line[];
  packaging: Line[];
  labour: LabourLine[];
  other: OtherLine[];
  published?: boolean;
};

const asUnit = (value: unknown): Unit => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "l") return "l";
  if (normalized === "pcs") return "pcs";
  return UNITS.includes(normalized as Unit) ? (normalized as Unit) : "";
};

const normalizeLine = (line: Partial<Line>): Line => ({
  name: line.name ?? "",
  packagePrice: N(line.packPrice ?? line.packagePrice),
  totalUnits: N(line.packSize ?? line.totalUnits),
  unitType: String(line.unitType ?? ""),
  unitsNeeded: N(line.recipeQty ?? line.unitsNeeded),
  packSize: N(line.packSize ?? line.totalUnits),
  packUnit: asUnit(line.packUnit ?? line.unitType),
  packPrice: N(line.packPrice ?? line.packagePrice),
  recipeQty: N(line.recipeQty ?? line.unitsNeeded),
  recipeUnit: asUnit(line.recipeUnit ?? line.unitType),
});

const normalizePayload = (payload: RecipePayload): RecipePayload => ({
  ...payload,
  ingredients: (payload.ingredients || []).map(normalizeLine),
  packaging: (payload.packaging || []).map(normalizeLine),
  labour: payload.labour || [],
  other: payload.other || [],
});

const newLine = (): Line => normalizeLine({ name: "" });
const newLabourLine = (): LabourLine => ({ description: "", hours: 0, hourlyRate: 0, bonus: 0 });
const newOtherLine = (): OtherLine => ({ name: "", cost: 0 });

const toBaseUnit = (qty: number, unit: Unit) => {
  if (unit === "kg") return { family: "weight", value: qty * 1000 };
  if (unit === "g") return { family: "weight", value: qty };
  if (unit === "l") return { family: "volume", value: qty * 1000 };
  if (unit === "ml") return { family: "volume", value: qty };
  if (unit === "each" || unit === "pcs") return { family: "count", value: qty };
  return { family: "none", value: qty };
};

const getLineCost = (line: Line) => {
  const packBase = toBaseUnit(N(line.packSize), line.packUnit);
  const recipeBase = toBaseUnit(N(line.recipeQty), line.recipeUnit);
  if (packBase.value <= 0 || recipeBase.value <= 0 || packBase.family !== recipeBase.family) return 0;
  return N(line.packPrice) * (recipeBase.value / packBase.value);
};

export default function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
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
  React.useEffect(() => {
    if (data) setState(normalizePayload(data));
  }, [data]);

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
  const ingredientCostPct = totalCost > 0 ? (ingredientsCost / totalCost) * 100 : 0;
  const totalCostPct = N(state.salePrice) > 0 ? (totalCostPerProduct / N(state.salePrice)) * 100 : 0;
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
      const res = await fetch(`/api/recipes/v2/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("Save failed");
      alert("Recipe saved");
      await refetch();
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/online/products/upsert-from-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: state.id }),
      });
      if (!res.ok) throw new Error("Publish failed");
      setState({ ...state, published: true });
      alert("Published successfully");
    } catch (e: any) {
      alert(e?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/recipes/v2/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      if (!res.ok) throw new Error("Unpublish failed");
      setState({ ...state, published: false });
      alert("Unpublished successfully");
    } catch (e: any) {
      alert(e?.message || "Unpublish failed");
    } finally {
      setPublishing(false);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recipe-${state.sku || state.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUploadImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setState((prev) => (prev ? { ...prev, imageUrl: String(reader.result || "") } : prev));
    };
    reader.readAsDataURL(file);
  };

  const renderLineTable = (title: string, key: "ingredients" | "packaging") => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">Pack unit = what you buy. Recipe unit = what you use in the recipe.</p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => setState({ ...state, [key]: [...state[key], newLine()] })}>
          Add row
        </Button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-3 py-3 text-left">Pack size</th>
              <th className="px-3 py-3 text-left">Pack unit</th>
              <th className="px-3 py-3 text-left">Pack price</th>
              <th className="px-3 py-3 text-left">Recipe qty</th>
              <th className="px-3 py-3 text-left">Recipe unit</th>
              <th className="px-3 py-3 text-left">Cost</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {state[key].map((row, i) => (
              <tr key={`${title}-${i}`} className="border-t border-slate-100 even:bg-slate-50/50">
                <td className="p-2">
                  <Input value={row.name} placeholder="Ingredient name" onChange={(e) => {
                    const next = [...state[key]];
                    next[i] = { ...row, name: e.target.value };
                    setState({ ...state, [key]: next });
                  }} className="h-10 rounded-xl" />
                </td>
                <td className="p-2"><Input type="number" value={row.packSize} placeholder="0" onChange={(e) => {
                  const next = [...state[key]];
                  next[i] = { ...row, packSize: N(e.target.value) };
                  setState({ ...state, [key]: next });
                }} className="h-10 rounded-xl" /></td>
                <td className="p-2">
                  <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3" value={row.packUnit} onChange={(e) => {
                    const next = [...state[key]];
                    next[i] = { ...row, packUnit: asUnit(e.target.value) };
                    setState({ ...state, [key]: next });
                  }}>
                    <option value="">Select</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2"><Input type="number" value={row.packPrice} placeholder="0" onChange={(e) => {
                  const next = [...state[key]];
                  next[i] = { ...row, packPrice: N(e.target.value) };
                  setState({ ...state, [key]: next });
                }} className="h-10 rounded-xl" /></td>
                <td className="p-2"><Input type="number" value={row.recipeQty} placeholder="0" onChange={(e) => {
                  const next = [...state[key]];
                  next[i] = { ...row, recipeQty: N(e.target.value) };
                  setState({ ...state, [key]: next });
                }} className="h-10 rounded-xl" /></td>
                <td className="p-2">
                  <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3" value={row.recipeUnit} onChange={(e) => {
                    const next = [...state[key]];
                    next[i] = { ...row, recipeUnit: asUnit(e.target.value) };
                    setState({ ...state, [key]: next });
                  }}>
                    <option value="">Select</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2 text-sm font-semibold text-slate-700">{THB(getLineCost(row))}</td>
                <td className="p-2">
                  <Button size="sm" variant="outline" onClick={() => setState({ ...state, [key]: state[key].filter((_, idx) => idx !== i) })}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" className="rounded-xl" onClick={() => navigate("/menu/recipes")}>Back</Button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">Recipes</span>
            <span className="text-slate-400">/</span>
            <span className="font-medium text-slate-800">{state.sku || state.name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={downloadJson}>Download</Button>
            <Button variant="secondary" className="rounded-xl" onClick={state.published ? unpublish : publish} disabled={publishing}>
              {publishing ? "Working..." : state.published ? "Unpublish" : "Publish"}
            </Button>
            <Button className="rounded-xl" onClick={save} disabled={saving || !hasChanges}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{state.name}</h1>
                <Badge className={`rounded-full px-3 py-1 ${state.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {state.published ? "Published" : "Draft"}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">{state.category || "Unmapped"}</Badge>
              </div>
              <div className="text-sm text-slate-600">SKU {state.sku} · Sale price {THB(state.salePrice)}</div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                <Textarea
                  value={state.description}
                  onChange={(e) => setState({ ...state, description: e.target.value })}
                  placeholder="Describe recipe notes, quality controls, and preparation context"
                  className="min-h-36 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {state.imageUrl ? (
                <img src={state.imageUrl} alt={state.name} className="h-52 w-full rounded-xl border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">No image</div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => imageUploadRef.current?.click()}>Upload image</Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setState({ ...state, imageUrl: "" })}>Clear image</Button>
              </div>
              <input ref={imageUploadRef} type="file" className="hidden" accept="image/*" onChange={(e) => onUploadImage(e.target.files?.[0])} />
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Image URL (optional)</label>
                <Input value={state.imageUrl} onChange={(e) => setState({ ...state, imageUrl: e.target.value })} className="h-10 rounded-xl border-slate-200 bg-white" placeholder="https://..." />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Cost per Product", value: THB(totalCostPerProduct) },
            { label: "Profit per Product", value: THB(profitPerProduct) },
            { label: "Margin %", value: `${marginPct.toFixed(2)}%` },
            { label: "Ingredient Cost %", value: `${ingredientCostPct.toFixed(2)}%` },
            { label: "Total Cost %", value: `${totalCostPct.toFixed(2)}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Cost breakdown</h3>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {breakdownData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => THB(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
              {breakdownData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Profit vs Cost</h3>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: "Per Product", cost: totalCostPerProduct, profit: Math.max(profitPerProduct, 0) }]} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => THB(Number(v))} />
                  <Bar dataKey="cost" fill="#f97316" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="profit" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Performance bars</h3>
            <div className="mt-4 space-y-4">
              {[
                { label: "Cost %", value: totalCostPct, color: "#f97316" },
                { label: "Profit Margin %", value: marginPct, color: "#10b981" },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                    <span>{bar.label}</span>
                    <span className="font-semibold text-slate-800">{bar.value.toFixed(2)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-200">
                    <div className="h-3 rounded-full" style={{ width: `${Math.max(0, Math.min(100, bar.value))}%`, backgroundColor: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h3 className="text-xl font-semibold text-slate-900">Recipe settings</h3>
          <p className="mt-1 text-xs text-slate-500">Slippage % is applied globally on top of the total recipe cost.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
              <Input value={state.category} onChange={(e) => setState({ ...state, category: e.target.value })} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sale Price</label>
              <Input type="number" value={state.salePrice} onChange={(e) => setState({ ...state, salePrice: N(e.target.value) })} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Products Made</label>
              <Input type="number" value={state.productsMade} onChange={(e) => setState({ ...state, productsMade: N(e.target.value) || 1 })} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slippage %</label>
              <Input type="number" value={state.slippagePercent} onChange={(e) => setState({ ...state, slippagePercent: N(e.target.value) })} className="h-10 rounded-xl" />
            </div>
          </div>
        </section>

        {renderLineTable("Ingredients", "ingredients")}
        {renderLineTable("Packaging", "packaging")}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">Labour</h3>
            <Button variant="outline" className="rounded-xl" onClick={() => setState({ ...state, labour: [...state.labour, newLabourLine()] })}>Add row</Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-left">Hours</th><th className="px-3 py-3 text-left">Hourly rate</th><th className="px-3 py-3 text-left">Bonus</th><th className="px-3 py-3 text-left">Cost</th><th className="px-3 py-3 text-left">Action</th></tr></thead>
              <tbody>
                {state.labour.map((line, i) => (
                  <tr key={`labour-${i}`} className="border-t border-slate-100 even:bg-slate-50/50">
                    <td className="p-2"><Input value={line.description} onChange={(e) => { const next=[...state.labour]; next[i]={...line,description:e.target.value}; setState({ ...state, labour: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2"><Input type="number" value={line.hours} onChange={(e) => { const next=[...state.labour]; next[i]={...line,hours:N(e.target.value)}; setState({ ...state, labour: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2"><Input type="number" value={line.hourlyRate} onChange={(e) => { const next=[...state.labour]; next[i]={...line,hourlyRate:N(e.target.value)}; setState({ ...state, labour: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2"><Input type="number" value={line.bonus} onChange={(e) => { const next=[...state.labour]; next[i]={...line,bonus:N(e.target.value)}; setState({ ...state, labour: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2 font-semibold">{THB(N(line.hours) * N(line.hourlyRate) + N(line.bonus))}</td>
                    <td className="p-2"><Button size="sm" variant="outline" onClick={() => setState({ ...state, labour: state.labour.filter((_, idx) => idx !== i) })}>Remove</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">Other</h3>
            <Button variant="outline" className="rounded-xl" onClick={() => setState({ ...state, other: [...state.other, newOtherLine()] })}>Add row</Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3 text-left">Cost</th><th className="px-3 py-3 text-left">Action</th></tr></thead>
              <tbody>
                {state.other.map((line, i) => (
                  <tr key={`other-${i}`} className="border-t border-slate-100 even:bg-slate-50/50">
                    <td className="p-2"><Input value={line.name} onChange={(e) => { const next=[...state.other]; next[i]={...line,name:e.target.value}; setState({ ...state, other: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2"><Input type="number" value={line.cost} onChange={(e) => { const next=[...state.other]; next[i]={...line,cost:N(e.target.value)}; setState({ ...state, other: next }); }} className="h-10 rounded-xl" /></td>
                    <td className="p-2"><Button size="sm" variant="outline" onClick={() => setState({ ...state, other: state.other.filter((_, idx) => idx !== i) })}>Remove</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
