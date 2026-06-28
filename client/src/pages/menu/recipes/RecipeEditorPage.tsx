import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray, normalizeMenuCategories } from "@/lib/menuData";
import RecipeIngredientEditor from "./RecipeIngredientEditor";
import { COSTING_NOTES_PREFIX, emptyRecipeForm, fmtMoney, fmtPercent, notesWithoutWorkflowData, parseCostingRows, parseStatus, splitInstructions, toNumber, type MenuCategory, type PurchasingLine, type Recipe, type RecipeIngredientRow } from "./recipeTypes";

function blockerText(message: string) { return <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg p-3 text-xs"><p className="font-semibold">INSUFFICIENT DATA</p><p>{message}</p></div>; }

type PurchasingListResponse = { ok?: boolean; items?: PurchasingLine[]; rows?: PurchasingLine[]; lines?: PurchasingLine[] };

export default function RecipeEditorPage() {
  const navigate = useNavigate();
  const { recipeId } = useParams<{ recipeId?: string }>();
  const isNewRecipe = recipeId === "new";
  const [form, setForm] = useState(emptyRecipeForm());
  const [ingredients, setIngredients] = useState<RecipeIngredientRow[]>([]);
  const [draftIngredient, setDraftIngredient] = useState<RecipeIngredientRow | null>(null);

  const { data: recipesData, isLoading: recipesLoading } = useQuery<Recipe[] | { rows?: Recipe[] }>({ queryKey: ["/api/recipes"] });
  const { data: rawCategories } = useQuery<unknown>({ queryKey: ["/api/menu-v3/categories"] });
  const { data: purchasingData } = useQuery<PurchasingListResponse>({ queryKey: ["/api/purchasing-items?active=true"] });
  const categories = asArray<MenuCategory>(normalizeMenuCategories<MenuCategory>(rawCategories).items).filter((category) => category.isActive !== false);
  const recipes = Array.isArray(recipesData) ? recipesData : asArray<Recipe>(recipesData?.rows);
  const recipe = isNewRecipe ? null : recipes.find((candidate) => String(candidate.id) === recipeId) ?? null;
  const purchasingLines = asArray<PurchasingLine>(purchasingData?.items ?? purchasingData?.rows ?? purchasingData?.lines);

  useEffect(() => {
    if (isNewRecipe) {
      setForm(emptyRecipeForm());
      setIngredients([]);
      return;
    }
    if (!recipe) return;
    const split = splitInstructions(recipe.instructions);
    setForm({ name: recipe.name ?? "", category: recipe.category ?? "", description: recipe.description ?? "", imageUrl: recipe.imageUrl ?? "", yieldQuantity: String(recipe.yieldQuantity ?? "1"), yieldUnit: recipe.yieldUnit ?? "servings", preparationInstructions: split.preparationInstructions, cookingInstructions: split.cookingInstructions, specialNotes: notesWithoutWorkflowData(recipe.notes), directPrice: recipe.sellingPrice === null || recipe.sellingPrice === undefined ? "" : String(recipe.sellingPrice), deliveryPartnerPrice: recipe.suggestedPrice === null || recipe.suggestedPrice === undefined ? "" : String(recipe.suggestedPrice), status: parseStatus(recipe) });
    setIngredients(parseCostingRows(recipe));
  }, [isNewRecipe, recipe?.id]);

  const costRows = useMemo(() => ingredients.map((row) => { const unitCost = toNumber(row.manualOverrideUnitCost) ?? row.autoUnitCost; const qty = toNumber(row.quantityUsed); return { row, unitCost, qty, lineCost: unitCost !== null && qty !== null ? unitCost * qty : null }; }), [ingredients]);
  const mappedRows = costRows.filter((entry) => entry.row.sourceType === "purchasing" && entry.unitCost !== null && entry.qty !== null);
  const missingRows = costRows.filter((entry) => entry.row.name && (entry.unitCost === null || entry.qty === null || entry.row.sourceType !== "purchasing"));
  const hasValidCostData = mappedRows.length > 0 && missingRows.length === 0;
  const totalCost = hasValidCostData ? mappedRows.reduce((sum, entry) => sum + (entry.lineCost ?? 0), 0) : null;
  const yieldQty = toNumber(form.yieldQuantity);
  const costPerServing = totalCost !== null && yieldQty !== null && yieldQty > 0 ? totalCost / yieldQty : null;
  const directPrice = toNumber(form.directPrice);
  const deliveryPartnerPrice = toNumber(form.deliveryPartnerPrice);
  const directMargin = directPrice !== null && costPerServing !== null ? ((directPrice - costPerServing) / directPrice) * 100 : null;
  const deliveryPartnerMargin = deliveryPartnerPrice !== null && costPerServing !== null ? ((deliveryPartnerPrice - costPerServing) / deliveryPartnerPrice) * 100 : null;
  const directProfit = directPrice !== null && costPerServing !== null ? directPrice - costPerServing : null;
  const deliveryPartnerProfit = deliveryPartnerPrice !== null && costPerServing !== null ? deliveryPartnerPrice - costPerServing : null;
  const suggestedPrice = costPerServing !== null ? Math.ceil(costPerServing / 0.3) : null;

  const saveMutation = useMutation({
    mutationFn: () => apiRequest(isNewRecipe ? "/api/recipes" : `/api/recipes/${recipe!.id}`, { method: isNewRecipe ? "POST" : "PUT", body: JSON.stringify({ name: form.name, category: form.category, description: form.description || null, imageUrl: form.imageUrl || null, yieldQuantity: form.yieldQuantity, yieldUnit: form.yieldUnit, sellingPrice: directPrice, suggestedPrice: deliveryPartnerPrice, status: form.status, isActive: form.status === "Live", instructions: `Preparation instructions:\n${form.preparationInstructions}\n\nCooking/build instructions:\n${form.cookingInstructions}`, notes: `${form.specialNotes ? `${form.specialNotes}\n` : ""}${COSTING_NOTES_PREFIX} ${JSON.stringify(ingredients.map(({ id, ...row }) => row))}\nRecipe status: ${form.status}`, recipeIngredients: ingredients }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }); navigate("/menu/recipes"); },
  });

  if (!isNewRecipe && recipesLoading) return <div className="p-4 text-xs text-slate-500">Loading recipe...</div>;
  if (!isNewRecipe && !recipe) return <div className="p-4 space-y-3"><Link to="/menu/recipes" className="text-xs underline">Back to Recipes</Link>{blockerText("Recipe could not be loaded from /api/recipes.")}</div>;

  return <div className="p-4 space-y-4 max-w-5xl mx-auto">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><Link to="/menu/recipes" className="text-xs underline">Back to Recipes</Link><h1 className="text-xl font-semibold">{isNewRecipe ? "Add New Recipe" : recipe!.name}</h1><Badge variant={form.status === "Live" ? "default" : "outline"}>{form.status}</Badge></div><button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.category || saveMutation.isPending} className="text-xs px-4 py-2 bg-black text-white rounded-lg disabled:opacity-40">{saveMutation.isPending ? "Saving..." : "Save"}</button></div>
    <section className="border rounded-lg bg-white p-4 space-y-3"><h2 className="font-semibold text-sm">Recipe Details</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Input placeholder="Recipe title" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="border rounded px-2 py-2 text-xs"><option value="">Menu category</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><Input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="md:col-span-2" /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append("image", file); const res = await fetch("/api/upload/menu-item-image", { method: "POST", body: data }); const uploaded = await res.json(); if (!res.ok) throw new Error(uploaded?.error || "Image upload failed"); setForm({ ...form, imageUrl: uploaded.imageUrl || uploaded.url }); }} className="md:col-span-2 w-full rounded-md border border-slate-200 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" /><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })} className="border rounded px-2 py-2 text-xs"><option>Draft</option><option>Live</option><option>Archived</option></select></div><div className="h-36 w-36 rounded-lg border bg-slate-100 overflow-hidden flex items-center justify-center text-xs text-slate-500">{form.imageUrl ? <img src={form.imageUrl} alt={form.name} className="h-full w-full object-cover" /> : "No image"}</div></section>
    <section className="border rounded-lg bg-white p-4 space-y-3"><h2 className="font-semibold text-sm">Selling Prices</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="block text-xs font-medium">Direct / in-store price<Input placeholder="Direct / in-store price" value={form.directPrice} onChange={(event) => setForm({ ...form, directPrice: event.target.value })} className="mt-1" /></label><label className="block text-xs font-medium">Delivery partner price<Input placeholder="Delivery partner price" value={form.deliveryPartnerPrice} onChange={(event) => setForm({ ...form, deliveryPartnerPrice: event.target.value })} className="mt-1" /></label></div></section>
    <RecipeIngredientEditor purchasingLines={purchasingLines} rows={ingredients} draft={draftIngredient} onDraftChange={setDraftIngredient} onRowsChange={setIngredients} />
    {missingRows.length > 0 && blockerText(`${missingRows.length} ingredient row(s) have insufficient ingredient data.`)}
    <section className="border rounded-lg bg-white p-4 space-y-3"><h2 className="font-semibold text-sm">Instructions</h2><textarea placeholder="Preparation instructions" value={form.preparationInstructions} onChange={(event) => setForm({ ...form, preparationInstructions: event.target.value })} className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" /><textarea placeholder="Cooking/build instructions" value={form.cookingInstructions} onChange={(event) => setForm({ ...form, cookingInstructions: event.target.value })} className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" /><textarea placeholder="Special notes" value={form.specialNotes} onChange={(event) => setForm({ ...form, specialNotes: event.target.value })} className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" /></section>
    <section className="border rounded-lg bg-white p-4 space-y-3"><h2 className="font-semibold text-sm">Cost Summary</h2>{hasValidCostData ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs"><div>Total recipe cost: <span className="font-mono">{fmtMoney(totalCost)}</span></div><div>Cost per serving: <span className="font-mono">{fmtMoney(costPerServing)}</span></div><div>Direct margin %: <span className="font-mono">{fmtPercent(directMargin)}</span></div><div>Delivery partner margin %: <span className="font-mono">{fmtPercent(deliveryPartnerMargin)}</span></div><div>Direct profit: <span className="font-mono">{fmtMoney(directProfit)}</span></div><div>Delivery partner profit: <span className="font-mono">{fmtMoney(deliveryPartnerProfit)}</span></div><div>Suggested price: <span className="font-mono">{fmtMoney(suggestedPrice)}</span></div></div> : <p className="text-xs text-amber-800">Insufficient ingredient data</p>}</section>
  </div>;
}
