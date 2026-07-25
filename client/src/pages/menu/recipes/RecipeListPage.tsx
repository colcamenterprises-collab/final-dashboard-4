import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray } from "@/lib/menuData";
import { fmtMoney, fmtPercent, parseStatus, toNumber, type Recipe } from "./recipeTypes";
import RecipeCard from "./RecipeCard";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";

function calculateMargin(price: number | null, cost: number | null, stored: unknown) {
  const storedValue = toNumber(stored);
  if (storedValue !== null) return storedValue;
  if (price === null || price <= 0 || cost === null) return null;
  return ((price - cost) / price) * 100;
}

function missingReason(price: number | null, cost: number | null) {
  if (price === null || price <= 0) return "Missing selling price";
  if (cost === null) return "Missing recipe cost";
  return "Margin unavailable";
}

export default function RecipeListPage() {
  const navigate = useNavigate();
  const [cardRecipe, setCardRecipe] = useState<Recipe | null>(null);
  const { data, isLoading } = useQuery<Recipe[] | { rows?: Recipe[] }>({ queryKey: ["/api/recipes"] });
  const recipes = Array.isArray(data) ? data : asArray<Recipe>(data?.rows);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recipes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });
    },
  });

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Recipe development and costing library. Recipe cards contain kitchen instructions only.</p><Link to="/menu/recipes/new" className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-xs text-white"><Plus className="h-4 w-4" />Add New Recipe</Link></div>
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-slate-900"><table className="w-full min-w-[1180px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Thumbnail</th><th className="p-2 text-left">Recipe</th><th className="p-2 text-left">Category</th><th className="p-2 text-left">Description</th><th className="p-2 text-left">Food Cost</th><th className="p-2 text-left">Direct Price</th><th className="p-2 text-left">Direct Margin %</th><th className="p-2 text-left">Delivery Price</th><th className="p-2 text-left">Delivery Margin %</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{isLoading ? <tr><td className="p-3" colSpan={11}>Loading recipes...</td></tr> : recipes.length === 0 ? <tr><td className="p-3" colSpan={11}>No recipes found.</td></tr> : recipes.map((recipe) => {
      const cost = toNumber(recipe.costPerServing);
      const directPrice = toNumber(recipe.sellingPrice);
      const deliveryPrice = toNumber(recipe.suggestedPrice);
      const directMargin = calculateMargin(directPrice, cost, recipe.directMarginPercent);
      const deliveryMargin = calculateMargin(deliveryPrice, cost, recipe.deliveryPartnerMarginPercent);
      const status = parseStatus(recipe);
      return <tr key={recipe.id} className="border-b"><td className="p-2"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border bg-slate-100 text-[10px] text-slate-500">{recipe.imageUrl ? <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-contain" /> : "No image"}</div></td><td className="p-2 font-medium">{recipe.name || "Untitled"}</td><td className="p-2">{recipe.category || "—"}</td><td className="max-w-xs whitespace-normal p-2">{recipe.description || "—"}</td><td className="p-2 font-mono">{fmtMoney(cost)}</td><td className="p-2 font-mono">{fmtMoney(directPrice)}</td><td className="p-2 font-mono">{directMargin === null ? <span className="text-amber-700" title={missingReason(directPrice, cost)}>—</span> : fmtPercent(directMargin)}</td><td className="p-2 font-mono">{fmtMoney(deliveryPrice)}</td><td className="p-2 font-mono">{deliveryMargin === null ? <span className="text-amber-700" title={missingReason(deliveryPrice, cost)}>—</span> : fmtPercent(deliveryMargin)}</td><td className="p-2"><Badge variant={status === "Approved" ? "default" : "outline"}>{status}</Badge></td><td className="p-2"><div className="flex gap-2"><button aria-label={`Recipe card ${recipe.name}`} title="Recipe Card" className="rounded border p-1.5" onClick={() => setCardRecipe(recipe)}><FileText className="h-4 w-4" /></button><button aria-label={`Edit ${recipe.name}`} title="Edit" className="rounded border p-1.5" onClick={() => navigate(`/menu/recipes/${recipe.id}/edit`)}><Pencil className="h-4 w-4" /></button><button aria-label={`Delete ${recipe.name}`} title="Delete permanently" className="rounded border border-red-300 p-1.5 text-red-700" onClick={() => window.confirm(`Permanently delete recipe "${recipe.name}"? This cannot be undone.`) && deleteMutation.mutate(recipe.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>;
    })}</tbody></table></div>
    {deleteMutation.isError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(deleteMutation.error as Error)?.message || "Recipe could not be deleted. It may still be linked to a menu item."}</p>}
    {cardRecipe && <RecipeCard recipe={cardRecipe} onClose={() => setCardRecipe(null)} />}
  </div>;
}
