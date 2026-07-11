import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  Camera,
  ChefHat,
  Clock3,
  FileText,
  GripVertical,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type Ingredient = {
  id: string;
  name: string;
  brand: string;
  packDescription: string;
  packQuantity: string;
  packUnit: string;
  packPrice: string;
  quantityUsed: string;
  usageUnit: string;
  notes: string;
};

type Step = { id: string; instruction: string; minutes: string; imageData: string };

type Metrics = {
  totalIngredients: number;
  totalBatchCost: number;
  costPerServing: number;
  suggestedDirectPrice: number;
  suggestedGrabPrice: number;
  foodCostPercentDirect: number | null;
  foodCostPercentGrab: number | null;
  directProfit: number | null;
  grabProfit: number | null;
  directMarginPercent: number | null;
  grabMarginPercent: number | null;
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  description: string;
  imageData: string;
  yieldQuantity: number;
  yieldUnit: string;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  difficulty: string;
  status: string;
  directPrice: number | null;
  grabPrice: number | null;
  targetFoodCostPercent: number;
  packagingCost: number;
  labourCost: number;
  ingredients: Ingredient[];
  steps: Step[];
  chefNotes: string;
  qualityChecks: string[];
  servingNotes: string;
  metrics: Metrics;
};

type RecipeListResponse = { ok: boolean; rows: Recipe[] };
type RecipeResponse = { ok: boolean; recipe: Recipe };

const units = ["g", "kg", "ml", "L", "each", "slice", "can", "bottle", "packet"];
const categories = ["Burger", "Chicken", "Side", "Sauce", "Dessert", "Drink", "Prep", "Other"];

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const blankIngredient = (): Ingredient => ({
  id: uid(),
  name: "",
  brand: "",
  packDescription: "",
  packQuantity: "",
  packUnit: "g",
  packPrice: "",
  quantityUsed: "",
  usageUnit: "g",
  notes: "",
});
const blankStep = (): Step => ({ id: uid(), instruction: "", minutes: "", imageData: "" });

const blankRecipe = {
  name: "",
  category: "Burger",
  description: "",
  imageData: "",
  yieldQuantity: "1",
  yieldUnit: "servings",
  prepMinutes: "",
  cookMinutes: "",
  difficulty: "Easy",
  status: "Draft",
  directPrice: "",
  grabPrice: "",
  targetFoodCostPercent: "30",
  packagingCost: "0",
  labourCost: "0",
  ingredients: [blankIngredient()],
  steps: [blankStep()],
  chefNotes: "",
  qualityChecks: [""],
  servingNotes: "",
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUnit(value: string) {
  const unit = value.toLowerCase();
  if (unit === "kg") return { group: "weight", factor: 1000 };
  if (unit === "g") return { group: "weight", factor: 1 };
  if (unit === "l") return { group: "volume", factor: 1000 };
  if (unit === "ml") return { group: "volume", factor: 1 };
  return { group: unit, factor: 1 };
}

function ingredientCost(row: Ingredient) {
  const pack = normalizeUnit(row.packUnit);
  const used = normalizeUnit(row.usageUnit);
  if (pack.group !== used.group) return 0;
  const packQty = n(row.packQuantity) * pack.factor;
  const usedQty = n(row.quantityUsed) * used.factor;
  return packQty > 0 ? (n(row.packPrice) / packQty) * usedQty : 0;
}

function money(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `฿${value.toFixed(2)}`;
}

function percent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Library() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const { data, isLoading } = useQuery<RecipeListResponse>({
    queryKey: ["/api/recipes"],
    queryFn: async () => {
      const response = await fetch("/api/recipes");
      if (!response.ok) throw new Error("Unable to load recipes");
      return response.json();
    },
  });
  const recipes = (data?.rows || []).filter((recipe) => {
    const matchesSearch = `${recipe.name} ${recipe.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All" || recipe.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Recipe Studio</h1>
            <p className="mt-1 text-sm text-slate-500">Standalone recipes, costing and kitchen cards.</p>
          </div>
          <Button size="lg" onClick={() => navigate("/menu/recipes/new")}>
            <Plus className="mr-2 h-5 w-5" /> New Recipe
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipes" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Draft", "Active", "Archived"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-slate-500">Loading recipes…</div>
        ) : recipes.length === 0 ? (
          <button onClick={() => navigate("/menu/recipes/new")} className="flex min-h-80 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white text-slate-500 hover:border-slate-400">
            <ChefHat className="mb-4 h-14 w-14" />
            <span className="text-lg font-semibold text-slate-900">Create your first recipe</span>
            <span className="mt-1 text-sm">Photo, ingredients, method, costing and recipe card.</span>
          </button>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {recipes.map((recipe) => (
              <button key={recipe.id} onClick={() => navigate(`/menu/recipes/${recipe.id}/edit`)} className="overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="aspect-[16/10] bg-slate-100">
                  {recipe.imageData ? <img src={recipe.imageData} alt={recipe.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Camera className="h-12 w-12 text-slate-300" /></div>}
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="text-lg font-bold text-slate-950">{recipe.name}</h2><p className="text-sm text-slate-500">{recipe.category}</p></div>
                    <Badge variant={recipe.status === "Active" ? "default" : "secondary"}>{recipe.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Cost</div><div className="font-semibold">{money(recipe.metrics.costPerServing)}</div></div>
                    <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Direct</div><div className="font-semibold">{money(recipe.directPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Food cost</div><div className="font-semibold">{percent(recipe.metrics.foodCostPercentDirect)}</div></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Editor() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !recipeId;
  const [form, setForm] = useState<any>(blankRecipe);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<RecipeResponse>({
    queryKey: ["/api/recipes", recipeId],
    enabled: !isNew,
    queryFn: async () => {
      const response = await fetch(`/api/recipes/${recipeId}`);
      if (!response.ok) throw new Error("Unable to load recipe");
      return response.json();
    },
  });

  if (!isNew && data?.recipe && loadedId !== data.recipe.id) {
    const recipe = data.recipe;
    setLoadedId(recipe.id);
    setForm({
      ...recipe,
      yieldQuantity: String(recipe.yieldQuantity),
      prepMinutes: String(recipe.prepMinutes),
      cookMinutes: String(recipe.cookMinutes),
      directPrice: recipe.directPrice == null ? "" : String(recipe.directPrice),
      grabPrice: recipe.grabPrice == null ? "" : String(recipe.grabPrice),
      targetFoodCostPercent: String(recipe.targetFoodCostPercent),
      packagingCost: String(recipe.packagingCost),
      labourCost: String(recipe.labourCost),
      ingredients: recipe.ingredients.length ? recipe.ingredients.map((row) => ({ ...row, id: row.id || uid(), packQuantity: String(row.packQuantity), packPrice: String(row.packPrice), quantityUsed: String(row.quantityUsed) })) : [blankIngredient()],
      steps: recipe.steps.length ? recipe.steps.map((step) => ({ ...step, id: step.id || uid(), minutes: String(step.minutes || "") })) : [blankStep()],
      qualityChecks: recipe.qualityChecks.length ? recipe.qualityChecks : [""],
    });
  }

  const calculations = useMemo(() => {
    const totalIngredients = form.ingredients.reduce((sum: number, row: Ingredient) => sum + ingredientCost(row), 0);
    const totalBatchCost = totalIngredients + n(form.packagingCost) + n(form.labourCost);
    const costPerServing = totalBatchCost / Math.max(n(form.yieldQuantity), 1);
    const direct = n(form.directPrice);
    const grab = n(form.grabPrice);
    const target = Math.max(n(form.targetFoodCostPercent), 1);
    return {
      totalIngredients,
      totalBatchCost,
      costPerServing,
      suggested: costPerServing / (target / 100),
      directFoodCost: direct > 0 ? (costPerServing / direct) * 100 : null,
      grabFoodCost: grab > 0 ? (costPerServing / grab) * 100 : null,
      directProfit: direct > 0 ? direct - costPerServing : null,
      grabProfit: grab > 0 ? grab - costPerServing : null,
    };
  }, [form]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(isNew ? "/api/recipes" : `/api/recipes/${recipeId}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Save failed");
      return body as RecipeResponse;
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe saved" });
      if (isNew) navigate(`/menu/recipes/${body.recipe.id}/edit`, { replace: true });
    },
    onError: (error: Error) => toast({ title: "Unable to save recipe", description: error.message, variant: "destructive" }),
  });

  const archive = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Archive failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      navigate("/menu/recipes");
    },
  });

  const patchIngredient = (id: string, key: keyof Ingredient, value: string) => setForm((current: any) => ({ ...current, ingredients: current.ingredients.map((row: Ingredient) => row.id === id ? { ...row, [key]: value } : row) }));
  const patchStep = (id: string, key: keyof Step, value: string) => setForm((current: any) => ({ ...current, steps: current.steps.map((row: Step) => row.id === id ? { ...row, [key]: value } : row) }));

  if (isLoading) return <div className="p-10 text-center">Loading recipe…</div>;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <style>{`@media print { body * { visibility: hidden !important; } #recipe-print-card, #recipe-print-card * { visibility: visible !important; } #recipe-print-card { position: absolute; inset: 0; width: 100%; background: white; padding: 20px; } .no-print { display: none !important; } }`}</style>
      <div className="no-print sticky top-0 z-20 border-b bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/menu/recipes")}><ArrowLeft className="mr-2 h-4 w-4" />Recipes</Button>
          <div className="flex gap-2">
            {!isNew && <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Card</Button>}
            {!isNew && <Button variant="outline" onClick={() => archive.mutate()}><Archive className="mr-2 h-4 w-4" />Archive</Button>}
            <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save Recipe"}</Button>
          </div>
        </div>
      </div>

      <div className="no-print mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-3xl">
              <div className="grid md:grid-cols-[300px_1fr]">
                <label className="relative flex min-h-64 cursor-pointer items-center justify-center bg-slate-100">
                  {form.imageData ? <img src={form.imageData} className="absolute inset-0 h-full w-full object-cover" alt="Recipe" /> : <div className="text-center text-slate-400"><Camera className="mx-auto h-12 w-12" /><div className="mt-2 text-sm">Add recipe photo</div></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setForm({ ...form, imageData: await fileToDataUrl(file) }); }} />
                </label>
                <CardContent className="space-y-4 p-6">
                  <div><Label>Recipe name</Label><Input className="mt-1 text-lg font-semibold" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Category</Label><Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["Draft", "Active", "Archived"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div><Label>Description</Label><Textarea className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div><Label>Yield</Label><Input className="mt-1" type="number" value={form.yieldQuantity} onChange={(e) => setForm({ ...form, yieldQuantity: e.target.value })} /></div>
                    <div><Label>Yield unit</Label><Input className="mt-1" value={form.yieldUnit} onChange={(e) => setForm({ ...form, yieldUnit: e.target.value })} /></div>
                    <div><Label>Prep min</Label><Input className="mt-1" type="number" value={form.prepMinutes} onChange={(e) => setForm({ ...form, prepMinutes: e.target.value })} /></div>
                    <div><Label>Cook min</Label><Input className="mt-1" type="number" value={form.cookMinutes} onChange={(e) => setForm({ ...form, cookMinutes: e.target.value })} /></div>
                  </div>
                </CardContent>
              </div>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Ingredients & Costing</CardTitle><Button variant="outline" size="sm" onClick={() => setForm({ ...form, ingredients: [...form.ingredients, blankIngredient()] })}><Plus className="mr-1 h-4 w-4" />Ingredient</Button></CardHeader>
              <CardContent className="space-y-4">
                {form.ingredients.map((row: Ingredient, index: number) => (
                  <div key={row.id} className="rounded-2xl border bg-white p-4">
                    <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Ingredient {index + 1}</div><Button variant="ghost" size="icon" onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((item: Ingredient) => item.id !== row.id) })}><Trash2 className="h-4 w-4" /></Button></div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="xl:col-span-2"><Label>Name</Label><Input value={row.name} onChange={(e) => patchIngredient(row.id, "name", e.target.value)} /></div>
                      <div><Label>Brand</Label><Input value={row.brand} onChange={(e) => patchIngredient(row.id, "brand", e.target.value)} /></div>
                      <div><Label>Pack description</Label><Input value={row.packDescription} onChange={(e) => patchIngredient(row.id, "packDescription", e.target.value)} placeholder="e.g. 120 slices" /></div>
                      <div><Label>Pack quantity</Label><Input type="number" value={row.packQuantity} onChange={(e) => patchIngredient(row.id, "packQuantity", e.target.value)} /></div>
                      <div><Label>Pack unit</Label><Select value={row.packUnit} onValueChange={(value) => patchIngredient(row.id, "packUnit", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Pack price (THB)</Label><Input type="number" value={row.packPrice} onChange={(e) => patchIngredient(row.id, "packPrice", e.target.value)} /></div>
                      <div><Label>Recipe quantity</Label><Input type="number" value={row.quantityUsed} onChange={(e) => patchIngredient(row.id, "quantityUsed", e.target.value)} /></div>
                      <div><Label>Recipe unit</Label><Select value={row.usageUnit} onValueChange={(value) => patchIngredient(row.id, "usageUnit", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
                      <div className="flex items-end"><div className="w-full rounded-xl bg-slate-950 p-3 text-white"><div className="text-xs text-slate-400">Ingredient cost</div><div className="text-lg font-bold">{money(ingredientCost(row))}</div></div></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Method</CardTitle><Button variant="outline" size="sm" onClick={() => setForm({ ...form, steps: [...form.steps, blankStep()] })}><Plus className="mr-1 h-4 w-4" />Step</Button></CardHeader>
              <CardContent className="space-y-3">
                {form.steps.map((step: Step, index: number) => (
                  <div key={step.id} className="flex gap-3 rounded-2xl border bg-white p-4"><GripVertical className="mt-3 h-5 w-5 text-slate-300" /><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 font-bold text-white">{index + 1}</div><div className="grid flex-1 gap-3 md:grid-cols-[1fr_120px]"><Textarea value={step.instruction} onChange={(e) => patchStep(step.id, "instruction", e.target.value)} placeholder="Describe exactly what staff must do" /><div><Label>Minutes</Label><Input type="number" value={step.minutes} onChange={(e) => patchStep(step.id, "minutes", e.target.value)} /></div></div><Button variant="ghost" size="icon" onClick={() => setForm({ ...form, steps: form.steps.filter((item: Step) => item.id !== step.id) })}><Trash2 className="h-4 w-4" /></Button></div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-3xl"><CardHeader><CardTitle>Chef Notes</CardTitle></CardHeader><CardContent><Textarea className="min-h-40" value={form.chefNotes} onChange={(e) => setForm({ ...form, chefNotes: e.target.value })} placeholder="Technique, temperatures, warnings and quality notes" /></CardContent></Card>
              <Card className="rounded-3xl"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Quality Control</CardTitle><Button variant="outline" size="sm" onClick={() => setForm({ ...form, qualityChecks: [...form.qualityChecks, ""] })}><Plus className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-2">{form.qualityChecks.map((item: string, index: number) => <div key={index} className="flex gap-2"><Input value={item} onChange={(e) => setForm({ ...form, qualityChecks: form.qualityChecks.map((value: string, i: number) => i === index ? e.target.value : value) })} placeholder="e.g. Bun evenly toasted" /><Button variant="ghost" size="icon" onClick={() => setForm({ ...form, qualityChecks: form.qualityChecks.filter((_: string, i: number) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}</CardContent></Card>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-3xl bg-slate-950 text-white">
              <CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-slate-400">Ingredients</div><div className="text-xl font-bold">{money(calculations.totalIngredients)}</div></div><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-slate-400">Cost / serve</div><div className="text-xl font-bold">{money(calculations.costPerServing)}</div></div></div>
                <div className="grid grid-cols-2 gap-3"><div><Label className="text-slate-300">Packaging</Label><Input className="mt-1 bg-white text-slate-950" type="number" value={form.packagingCost} onChange={(e) => setForm({ ...form, packagingCost: e.target.value })} /></div><div><Label className="text-slate-300">Labour</Label><Input className="mt-1 bg-white text-slate-950" type="number" value={form.labourCost} onChange={(e) => setForm({ ...form, labourCost: e.target.value })} /></div></div>
                <div className="border-t border-white/20 pt-4"><div className="flex justify-between text-sm text-slate-400"><span>Total batch cost</span><span>{money(calculations.totalBatchCost)}</span></div></div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl"><CardHeader><CardTitle>Pricing</CardTitle></CardHeader><CardContent className="space-y-4">
              <div><Label>Target food cost %</Label><Input type="number" value={form.targetFoodCostPercent} onChange={(e) => setForm({ ...form, targetFoodCostPercent: e.target.value })} /></div>
              <div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs text-amber-700">Recommended selling price</div><div className="text-2xl font-bold text-amber-950">{money(calculations.suggested)}</div></div>
              <div><Label>Direct price</Label><Input type="number" value={form.directPrice} onChange={(e) => setForm({ ...form, directPrice: e.target.value })} /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Food cost {percent(calculations.directFoodCost)}</span><span>Profit {money(calculations.directProfit)}</span></div></div>
              <div><Label>Grab price</Label><Input type="number" value={form.grabPrice} onChange={(e) => setForm({ ...form, grabPrice: e.target.value })} /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Food cost {percent(calculations.grabFoodCost)}</span><span>Profit {money(calculations.grabProfit)}</span></div></div>
            </CardContent></Card>

            <Card className="rounded-3xl"><CardHeader><CardTitle>Serving Notes</CardTitle></CardHeader><CardContent><Textarea value={form.servingNotes} onChange={(e) => setForm({ ...form, servingNotes: e.target.value })} /></CardContent></Card>
          </div>
        </div>
      </div>

      <div id="recipe-print-card" className="hidden print:block">
        <div className="border-b-4 border-black pb-4">
          <div className="flex gap-6">{form.imageData && <img src={form.imageData} className="h-44 w-56 object-cover" alt="" />}<div><h1 className="text-4xl font-black">{form.name || "Recipe"}</h1><p className="mt-2 text-lg">{form.description}</p><div className="mt-4 flex gap-6 text-sm"><span>Yield: {form.yieldQuantity} {form.yieldUnit}</span><span>Prep: {form.prepMinutes || 0} min</span><span>Cook: {form.cookMinutes || 0} min</span></div></div></div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-8"><div><h2 className="text-2xl font-bold">Ingredients</h2><table className="mt-3 w-full text-sm"><tbody>{form.ingredients.filter((row: Ingredient) => row.name).map((row: Ingredient) => <tr key={row.id} className="border-b"><td className="py-2 font-semibold">{row.name}</td><td className="py-2 text-right">{row.quantityUsed} {row.usageUnit}</td></tr>)}</tbody></table></div><div><h2 className="text-2xl font-bold">Method</h2><ol className="mt-3 space-y-3">{form.steps.filter((step: Step) => step.instruction).map((step: Step, index: number) => <li key={step.id} className="flex gap-3"><span className="font-bold">{index + 1}.</span><span>{step.instruction}</span></li>)}</ol></div></div>
        <div className="mt-8 grid grid-cols-2 gap-8"><div><h2 className="text-xl font-bold">Quality Control</h2><ul className="mt-2 space-y-2">{form.qualityChecks.filter(Boolean).map((item: string, index: number) => <li key={index}>☐ {item}</li>)}</ul></div><div><h2 className="text-xl font-bold">Chef Notes</h2><p className="mt-2 whitespace-pre-wrap">{form.chefNotes}</p></div></div>
        <div className="mt-8 border-t pt-4 text-sm"><div className="flex justify-between"><span>Cost per serving: <strong>{money(calculations.costPerServing)}</strong></span><span>Direct: <strong>{money(n(form.directPrice))}</strong></span><span>Grab: <strong>{money(n(form.grabPrice))}</strong></span></div></div>
      </div>
    </div>
  );
}

export default function StandaloneRecipeStudio() {
  const { recipeId } = useParams();
  const isEditor = location.pathname.endsWith("/new") || Boolean(recipeId);
  return isEditor ? <Editor /> : <Library />;
}
