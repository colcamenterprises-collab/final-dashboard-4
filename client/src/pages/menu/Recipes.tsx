import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Recipe {
  id: number;
  name: string;
  description?: string;
  category: string;
  yieldQuantity: string;
  yieldUnit: string;
  totalCost: string;
  costPerServing: string;
  cogsPercent?: string;
  suggestedPrice?: string;
  sellingPrice?: string;
  margin?: string;
  wasteFactor?: string;
  preparationTime?: number;
  servingSize?: string;
  instructions?: string;
  notes?: string;
  isActive: boolean;
  version?: number;
}

const CATEGORY_COLOURS: Record<string, string> = {
  Burgers: "bg-amber-100 text-amber-700 border-amber-200",
  "Side Orders": "bg-green-100 text-green-700 border-green-200",
  Beverages: "bg-blue-100 text-blue-700 border-blue-200",
  Sauce: "bg-red-100 text-red-700 border-red-200",
  Other: "bg-slate-100 text-slate-600 border-slate-200",
};

function catColour(cat: string) {
  return CATEGORY_COLOURS[cat] ?? "bg-purple-100 text-purple-700 border-purple-200";
}

function fmt(n: string | number | undefined) {
  const v = Number(n);
  return isNaN(v) ? "—" : `฿${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: string | number | undefined) {
  const v = Number(n);
  return isNaN(v) || v === 0 ? "—" : `${v.toFixed(1)}%`;
}

export default function Recipes() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Burgers", description: "", yieldQuantity: "1", yieldUnit: "servings" });
  const [filterCat, setFilterCat] = useState("All");

  const { data, isLoading, isError } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/recipes", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setShowForm(false);
      setForm({ name: "", category: "Burgers", description: "", yieldQuantity: "1", yieldUnit: "servings" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recipes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }),
  });

  const recipes = data ?? [];
  const categories = ["All", ...Array.from(new Set(recipes.map((r) => r.category))).sort()];
  const visible = filterCat === "All" ? recipes : recipes.filter((r) => r.category === filterCat);

  const byCategory = visible.reduce<Record<string, Recipe[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Recipes</h1>
            <p className="text-xs text-slate-500">{recipes.length} recipes</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-black text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Recipe
        </button>
      </div>

      {showForm && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">New Recipe</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 block mb-1">Name *</label>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Recipe name"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Category *</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {["Burgers", "Side Orders", "Sauce", "Beverages", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Yield Qty</label>
              <input
                type="number"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.yieldQuantity}
                onChange={(e) => setForm({ ...form, yieldQuantity: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Unit</label>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.yieldUnit}
                onChange={(e) => setForm({ ...form, yieldUnit: e.target.value })}
                placeholder="servings / pieces"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Description</label>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || createMutation.isPending}
              className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
            >
              {createMutation.isPending ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              filterCat === c
                ? "bg-black text-white border-black"
                : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading recipes...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load recipes.</div>}

      {!isLoading && !isError && visible.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-xs">
          No recipes found.{filterCat !== "All" ? " Try a different filter." : " Click 'Add Recipe' to create one."}
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{cat}</p>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {items.map((recipe) => {
                const isOpen = expandedId === recipe.id;
                return (
                  <div key={recipe.id} className="bg-white dark:bg-slate-900">
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                      onClick={() => setExpandedId(isOpen ? null : recipe.id)}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 dark:text-white">{recipe.name}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 border ${catColour(recipe.category)}`}>{recipe.category}</Badge>
                          {recipe.version && recipe.version > 1 && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border border-purple-200">v{recipe.version}</Badge>
                          )}
                        </div>
                        {recipe.description && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{recipe.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(recipe.costPerServing)}</p>
                        <p className="text-[10px] text-slate-400">per serving</p>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{recipe.yieldQuantity} {recipe.yieldUnit}</p>
                            <p className="text-[10px] text-slate-400">Yield</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(recipe.totalCost)}</p>
                            <p className="text-[10px] text-slate-400">Total Cost</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmtPct(recipe.cogsPercent)}</p>
                            <p className="text-[10px] text-slate-400">COGS %</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(recipe.suggestedPrice || recipe.sellingPrice)}</p>
                            <p className="text-[10px] text-slate-400">Suggested Price</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmtPct(recipe.margin)}</p>
                            <p className="text-[10px] text-slate-400">Target Margin</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-800 dark:text-white">{recipe.preparationTime ? `${recipe.preparationTime} min` : "—"}</p>
                            <p className="text-[10px] text-slate-400">Prep Time</p>
                          </div>
                        </div>

                        {recipe.instructions && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 mb-1">Instructions</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{recipe.instructions}</p>
                          </div>
                        )}

                        {recipe.notes && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 mb-1">Notes</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{recipe.notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => archiveMutation.mutate(recipe.id)}
                          disabled={archiveMutation.isPending}
                          className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Archive recipe
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
