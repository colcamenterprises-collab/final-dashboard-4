import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray } from "@/lib/menuData";
import { fmtMoney, fmtPercent, parseStatus, toNumber, type Recipe } from "./recipeTypes";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function RecipeListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<Recipe[] | { rows?: Recipe[] }>({ queryKey: ["/api/recipes"] });
  const recipes = Array.isArray(data) ? data : asArray<Recipe>(data?.rows);
  const archiveMutation = useMutation({ mutationFn: (id: number) => apiRequest(`/api/recipes/${id}`, { method: "DELETE" }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }); } });
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Purchasing List → Ingredients → Recipe → Cost Calculation → Menu Item.</p><Link to="/menu/recipes/new" className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-black text-white rounded-lg"><Plus className="h-4 w-4" />Add New Recipe</Link></div>
    <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-x-auto"><table className="w-full min-w-[780px] text-xs"><thead><tr className="border-b bg-slate-50"><th className="text-left p-2">Thumbnail</th><th className="text-left p-2">Recipe</th><th className="text-left p-2">Category</th><th className="text-left p-2">Description</th><th className="text-left p-2">RRP</th><th className="text-left p-2">Margin %</th><th className="text-left p-2">Status</th><th className="text-left p-2">Actions</th></tr></thead><tbody>{isLoading ? <tr><td className="p-3" colSpan={8}>Loading recipes...</td></tr> : recipes.length === 0 ? <tr><td className="p-3" colSpan={8}>No recipes found.</td></tr> : recipes.map((recipe) => { const price = toNumber(recipe.sellingPrice); const cost = toNumber(recipe.costPerServing); const margin = price !== null && cost !== null ? ((price - cost) / price) * 100 : null; const status = parseStatus(recipe); return <tr key={recipe.id} className="border-b"><td className="p-2"><div className="h-12 w-12 rounded border bg-slate-100 overflow-hidden flex items-center justify-center text-[10px] text-slate-500">{recipe.imageUrl ? <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover" /> : "No image"}</div></td><td className="p-2 font-medium">{recipe.name || "UNMAPPED"}</td><td className="p-2">{recipe.category || "UNMAPPED"}</td><td className="p-2 max-w-xs whitespace-normal">{recipe.description || "UNMAPPED"}</td><td className="p-2 font-mono">{fmtMoney(price)}</td><td className="p-2 font-mono">{fmtPercent(margin)}</td><td className="p-2"><Badge variant={status === "Live" ? "default" : "outline"}>{status}</Badge></td><td className="p-2"><div className="flex gap-2"><button aria-label={`Edit ${recipe.name}`} title="Edit" className="p-1.5 border rounded" onClick={() => navigate(`/menu/recipes/${recipe.id}/edit`)}><Pencil className="h-4 w-4" /></button><button aria-label={`Delete ${recipe.name}`} title="Delete" className="p-1.5 border border-red-300 text-red-700 rounded" onClick={() => window.confirm(`Archive recipe "${recipe.name}"?`) && archiveMutation.mutate(recipe.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>; })}</tbody></table></div>
  </div>;
}
