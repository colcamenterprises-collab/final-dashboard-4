import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray, normalizeMenuCategories, normalizeMenuItems } from "@/lib/menuData";

type TabKey = "items" | "recipes" | "purchasing";

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  posEnabled: boolean;
  onlineEnabled: boolean;
  grabEnabled?: boolean;
  foodpandaEnabled?: boolean;
  kitchenStation: string | null;
  isActive: boolean;
  soldOut?: boolean;
  recipeId?: number | null;
  recipeCost?: number | string | null;
};

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Recipe = {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  yieldQuantity: string;
  yieldUnit: string;
  totalCost: string | number | null;
  costPerServing: string | number | null;
  cogsPercent?: string | number | null;
  suggestedPrice?: string | number | null;
  sellingPrice?: string | number | null;
  margin?: string | number | null;
  isActive: boolean;
};

type PurchasingLine = {
  fieldKey?: string;
  item?: string;
  name?: string;
  category?: string | null;
  supplier?: string | null;
  brand?: string | null;
  unitDescription?: string | null;
  purchaseUnit?: string | null;
  orderUnit?: string | null;
  unitCost?: number | string | null;
  manualOverrideUnitCost?: number | string | null;
  lineTotal?: number | string | null;
  quantity?: number | string | null;
  active?: boolean;
  isActive?: boolean;
};

type PurchasingListResponse = {
  lines?: PurchasingLine[];
  items?: PurchasingLine[];
  rows?: PurchasingLine[];
  source?: string;
  noData?: boolean;
  message?: string;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtMoney(value: unknown) {
  const n = toNumber(value);
  return n === null ? "UNMAPPED" : `฿${n.toFixed(2)}`;
}

function fmtPercent(value: unknown) {
  const n = toNumber(value);
  return n === null ? "UNMAPPED" : `${n.toFixed(1)}%`;
}

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

function calculateItemCost(item: MenuItem, recipes: Recipe[]) {
  const directCost = toNumber(item.recipeCost);
  if (directCost !== null) return directCost;
  if (item.recipeId) {
    const recipe = recipes.find((r) => r.id === item.recipeId);
    return toNumber(recipe?.costPerServing);
  }
  const nameMatch = recipes.find((r) => r.name?.toLowerCase() === item.name?.toLowerCase());
  return toNumber(nameMatch?.costPerServing);
}

function blockerText(message: string) {
  return (
    <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg p-3 text-xs">
      <p className="font-semibold">INSUFFICIENT DATA</p>
      <p>{message}</p>
    </div>
  );
}

export default function MenuWorkspace() {
  const location = useLocation();
  const activeTab: TabKey = location.pathname.includes("/menu/recipes") || location.pathname.includes("cost-calculator")
    ? "recipes"
    : location.pathname.includes("/menu/ingredients")
      ? "purchasing"
      : "items";
  const [search, setSearch] = useState("");
  const [recipeForm, setRecipeForm] = useState({ name: "", category: "", description: "", yieldQuantity: "1", yieldUnit: "servings" });

  const { data: rawItems, isLoading: itemsLoading } = useQuery<unknown>({ queryKey: ["/api/menu-v3/items"] });
  const { data: rawCategories, isLoading: categoriesLoading } = useQuery<unknown>({ queryKey: ["/api/menu-v3/categories"] });
  const { data: recipesData, isLoading: recipesLoading } = useQuery<Recipe[] | { rows?: Recipe[] }>({ queryKey: ["/api/recipes"] });
  const { data: purchasingData, isLoading: purchasingLoading } = useQuery<PurchasingListResponse>({ queryKey: ["/api/purchasing-list/latest"] });

  const createRecipeMutation = useMutation({
    mutationFn: () => apiRequest("/api/recipes", {
      method: "POST",
      body: JSON.stringify({
        name: recipeForm.name,
        category: recipeForm.category,
        description: recipeForm.description || null,
        yieldQuantity: recipeForm.yieldQuantity,
        yieldUnit: recipeForm.yieldUnit,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setRecipeForm({ name: "", category: "", description: "", yieldQuantity: "1", yieldUnit: "servings" });
    },
  });

  const itemResult = normalizeMenuItems<MenuItem>(rawItems);
  const categoryResult = normalizeMenuCategories<MenuCategory>(rawCategories);
  const items = asArray<MenuItem>(itemResult.items);
  const categories = asArray<MenuCategory>(categoryResult.items);
  const recipes = Array.isArray(recipesData) ? recipesData : asArray<Recipe>(recipesData?.rows);
  const purchasingLines = asArray<PurchasingLine>(purchasingData?.lines ?? purchasingData?.items ?? purchasingData?.rows);

  const categoryMap = useMemo(() => categories.reduce<Record<string, string>>((acc, category) => {
    if (category.id) acc[category.id] = category.name;
    return acc;
  }, {}), [categories]);

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase();
    return item.name?.toLowerCase().includes(q) || (categoryMap[item.categoryId] || "").toLowerCase().includes(q);
  });

  const filteredRecipes = recipes.filter((recipe) => {
    const q = search.toLowerCase();
    return recipe.name?.toLowerCase().includes(q) || recipe.category?.toLowerCase().includes(q);
  });

  const filteredPurchasing = purchasingLines.filter((line) => {
    const q = search.toLowerCase();
    return (line.item || line.name || "").toLowerCase().includes(q) || (line.supplier || "").toLowerCase().includes(q) || (line.category || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="space-y-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Menu</h1>
          <p className="text-xs text-slate-500">Purchasing List → recipe costing → sellable menu items → channel availability.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/menu/items" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "items" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Items</Link>
          <Link to="/menu/recipes" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "recipes" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Recipes and Costing</Link>
          <Link to="/menu/ingredients" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "purchasing" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Purchasing Ingredients</Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search menu workflow..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
      </div>

      {activeTab === "items" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Main POS/menu item list. Cost and margin are shown only when recipe cost data is linked or name-matched; otherwise values remain UNMAPPED.</p>
          {(itemsLoading || categoriesLoading || recipesLoading) && <div className="text-center py-12 text-slate-400 text-xs">Loading menu items...</div>}
          {!itemsLoading && filteredItems.length === 0 && <div className="text-center py-12 text-slate-400 text-xs">No menu items found.</div>}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full min-w-[1050px] text-xs">
              <thead><tr className="border-b bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Item name</th><th className="text-left px-3 py-2 font-medium text-slate-500">Category</th><th className="text-right px-3 py-2 font-medium text-slate-500">Price</th><th className="text-right px-3 py-2 font-medium text-slate-500">Cost</th><th className="text-right px-3 py-2 font-medium text-slate-500">Margin</th><th className="text-right px-3 py-2 font-medium text-slate-500">Food cost %</th><th className="text-center px-3 py-2 font-medium text-slate-500">Stock status</th><th className="text-center px-3 py-2 font-medium text-slate-500">POS enabled</th><th className="text-center px-3 py-2 font-medium text-slate-500">Online enabled</th><th className="text-center px-3 py-2 font-medium text-slate-500">Grab</th><th className="text-center px-3 py-2 font-medium text-slate-500">Foodpanda</th><th className="text-center px-3 py-2 font-medium text-slate-500">Status</th>
              </tr></thead>
              <tbody>{filteredItems.map((item) => {
                const price = toNumber(item.basePrice);
                const cost = calculateItemCost(item, recipes);
                const grossProfit = price !== null && cost !== null ? price - cost : null;
                const margin = price && grossProfit !== null ? (grossProfit / price) * 100 : null;
                const foodCost = price && cost !== null ? (cost / price) * 100 : null;
                return <tr key={item.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.name || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{categoryMap[item.categoryId] || "UNMAPPED"}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(price)}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(cost)}</td><td className="px-3 py-2 text-right font-mono">{fmtPercent(margin)}</td><td className="px-3 py-2 text-right font-mono">{fmtPercent(foodCost)}</td><td className="px-3 py-2 text-center">{item.soldOut ? "Sold out" : "In stock"}</td><td className="px-3 py-2 text-center">{yesNo(item.posEnabled)}</td><td className="px-3 py-2 text-center">{yesNo(item.onlineEnabled)}</td><td className="px-3 py-2 text-center">{yesNo(item.grabEnabled)}</td><td className="px-3 py-2 text-center">{yesNo(item.foodpandaEnabled)}</td><td className="px-3 py-2 text-center"><Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "recipes" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Recipes may exist without being live menu items. Recipe costing is displayed from recipe cost fields and must be backed by Purchasing List ingredient costs or manual overrides.</p>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 space-y-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Create recipe from Purchasing List items</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Input placeholder="Recipe name" value={recipeForm.name} onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })} className="text-xs" />
              <Input placeholder="Category" value={recipeForm.category} onChange={(e) => setRecipeForm({ ...recipeForm, category: e.target.value })} className="text-xs" />
              <Input placeholder="Description" value={recipeForm.description} onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })} className="text-xs" />
              <Input placeholder="Yield qty" value={recipeForm.yieldQuantity} onChange={(e) => setRecipeForm({ ...recipeForm, yieldQuantity: e.target.value })} className="text-xs" />
              <Input placeholder="Yield unit" value={recipeForm.yieldUnit} onChange={(e) => setRecipeForm({ ...recipeForm, yieldUnit: e.target.value })} className="text-xs" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-500">Ingredient rows, auto unit cost, and manual override cost remain source-backed; missing costs are not filled here.</p>
              <button
                onClick={() => createRecipeMutation.mutate()}
                disabled={!recipeForm.name || !recipeForm.category || createRecipeMutation.isPending}
                className="text-xs px-3 py-1.5 bg-black text-white rounded-lg disabled:opacity-40"
              >
                {createRecipeMutation.isPending ? "Saving..." : "Save Recipe"}
              </button>
            </div>
          </div>
          {recipesLoading && <div className="text-center py-12 text-slate-400 text-xs">Loading recipes...</div>}
          {!recipesLoading && recipes.length === 0 && blockerText("No active recipes were returned by /api/recipes. Create recipes from purchasable items before relying on menu item costs.")}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full min-w-[900px] text-xs"><thead><tr className="border-b bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-3 py-2 font-medium text-slate-500">Recipe name</th><th className="text-left px-3 py-2 font-medium text-slate-500">Category</th><th className="text-left px-3 py-2 font-medium text-slate-500">Description</th><th className="text-right px-3 py-2 font-medium text-slate-500">Yield quantity</th><th className="text-left px-3 py-2 font-medium text-slate-500">Yield unit</th><th className="text-right px-3 py-2 font-medium text-slate-500">Total recipe cost</th><th className="text-right px-3 py-2 font-medium text-slate-500">Cost per serving</th><th className="text-right px-3 py-2 font-medium text-slate-500">Suggested price</th><th className="text-right px-3 py-2 font-medium text-slate-500">Food cost %</th>
            </tr></thead><tbody>{filteredRecipes.map((recipe) => <tr key={recipe.id} className="border-b last:border-0"><td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{recipe.name}</td><td className="px-3 py-2 text-slate-500">{recipe.category || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{recipe.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{recipe.yieldQuantity || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{recipe.yieldUnit || "UNMAPPED"}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(recipe.totalCost)}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(recipe.costPerServing)}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(recipe.suggestedPrice || recipe.sellingPrice)}</td><td className="px-3 py-2 text-right font-mono">{fmtPercent(recipe.cogsPercent)}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}

      {activeTab === "purchasing" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Purchasable items are read from the existing Purchasing List source. Missing cost data is not guessed.</p>
          {purchasingLoading && <div className="text-center py-12 text-slate-400 text-xs">Loading purchasing ingredients...</div>}
          {!purchasingLoading && purchasingData?.noData && blockerText(purchasingData.message || "No Purchasing List data is available.")}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full min-w-[900px] text-xs"><thead><tr className="border-b bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-3 py-2 font-medium text-slate-500">Purchasable item</th><th className="text-left px-3 py-2 font-medium text-slate-500">Category</th><th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th><th className="text-left px-3 py-2 font-medium text-slate-500">Purchase unit</th><th className="text-right px-3 py-2 font-medium text-slate-500">Pack size / qty</th><th className="text-right px-3 py-2 font-medium text-slate-500">Purchase price</th><th className="text-right px-3 py-2 font-medium text-slate-500">Calculated unit cost</th><th className="text-right px-3 py-2 font-medium text-slate-500">Manual override unit cost</th><th className="text-center px-3 py-2 font-medium text-slate-500">Status</th>
            </tr></thead><tbody>{filteredPurchasing.length === 0 && !purchasingLoading ? <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No purchasing ingredients found.</td></tr> : filteredPurchasing.map((line, index) => <tr key={line.fieldKey || `${line.item}-${index}`} className="border-b last:border-0"><td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{line.item || line.name || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{line.category || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{line.supplier || "UNMAPPED"}</td><td className="px-3 py-2 text-slate-500">{line.unitDescription || line.purchaseUnit || line.orderUnit || "UNMAPPED"}</td><td className="px-3 py-2 text-right font-mono">{line.quantity ?? "UNMAPPED"}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(line.lineTotal)}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(line.unitCost)}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(line.manualOverrideUnitCost)}</td><td className="px-3 py-2 text-center">{line.active === false || line.isActive === false ? "Inactive" : "Active"}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
