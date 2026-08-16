import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Clock, Download, ImageIcon, Plus, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray, normalizeMenuCategories, normalizeMenuItems } from "@/lib/menuData";
import RecipeEditorPage from "./recipes/RecipeEditorPage";
import RecipeListPage from "./recipes/RecipeListPage";
import MenuCategoriesPage from "./recipes/MenuCategoriesPage";
import ModifierManager from "./ModifierManager";
import MenuItemEditor from "./MenuItemEditor";

type TabKey = "items" | "recipes" | "modifiers" | "categories" | "purchasing";
type SourceType = "purchasing" | "manual";

type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; imageUrl?: string | null; posEnabled?: boolean; onlineEnabled?: boolean; isOnlineEnabled?: boolean; grabEnabled?: boolean; foodpandaEnabled?: boolean; isActive?: boolean; soldOut?: boolean; recipeId?: number | null; recipeCost?: number | string | null; displayOrder?: number | string | null; sortOrder?: number | string | null; modifiers?: ModifierGroup[]; recipes?: Array<{ recipeId?: number; recipe?: Recipe }> };
type MenuCategory = { id: string; name: string; description?: string | null; sortOrder?: number; displayOrder?: number; isActive?: boolean; onlineEnabled?: boolean; visibleOnline?: boolean; grabEnabled?: boolean; foodpandaEnabled?: boolean };
type Recipe = { id: number; name: string; description?: string | null; category?: string; yieldQuantity?: string | number; yieldUnit?: string; totalCost?: string | number | null; costPerServing?: string | number | null; instructions?: string | null; deliveryPartnerMarginPercent?: string | number | null; directMarginPercent?: string | number | null; cogsPercent?: string | number | null; suggestedPrice?: string | number | null; sellingPrice?: string | number | null; imageUrl?: string | null; notes?: string | null; isActive?: boolean };
type PurchasingLine = { fieldKey?: string; id?: string | number; item?: string; name?: string; category?: string | null; supplier?: string | null; supplierName?: string | null; unitDescription?: string | null; purchaseUnit?: string | null; orderUnit?: string | null; unitCost?: number | string | null; packCost?: number | string | null; manualOverrideUnitCost?: number | string | null; lineTotal?: number | string | null; quantity?: number | string | null; purchaseUnitQty?: number | string | null; active?: boolean; isActive?: boolean };
type PurchasingListResponse = { ok?: boolean; lines?: PurchasingLine[]; items?: PurchasingLine[]; rows?: PurchasingLine[]; noData?: boolean; message?: string };
type IngredientDraft = { id: string; name: string; sourceType: SourceType; purchasingItemKey: string; quantityUsed: string; unitUsed: string; autoUnitCost: number | null; costingStatus: string | null; manualOverrideUnitCost: string; notes: string };
type ModifierOption = { id?: string; name: string; thaiName?: string; price?: string | number; priceDelta?: string | number; active?: boolean; isActive?: boolean };
type ModifierGroup = { id?: string; name: string; menuItemId?: string; linkedMenuItemIds?: string[]; modifiers?: ModifierOption[]; options?: ModifierOption[]; isActive?: boolean };

function createClientId(prefix = "tmp") {
  const randomUUID =
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomUUID}`;
}

const VALID_UNITS = ["Each", "g", "kg", "ml", "L", "pcs", "pack", "box"] as const;
const COSTING_NOTES_PREFIX = "Recipe costing rows:";
const makeIngredient = (): IngredientDraft => ({ id: createClientId("ingredient"), name: "", sourceType: "manual", purchasingItemKey: "", quantityUsed: "", unitUsed: "", autoUnitCost: null, costingStatus: null, manualOverrideUnitCost: "", notes: "" });
function toNumber(value: unknown): number | null { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function fmtMoney(value: unknown) { const n = toNumber(value); return n === null ? "UNMAPPED" : `฿${n.toFixed(2)}`; }
function fmtPercent(value: unknown) { const n = toNumber(value); return n === null ? "UNMAPPED" : `${n.toFixed(1)}%`; }
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function yesNo(value: boolean | undefined) { return value ? "Yes" : "No"; }
function itemCategoryName(item: MenuItem, categoryMap: Record<string, string>) { return typeof item.category === "string" ? item.category : categoryMap[item.categoryId || ""] || item.category?.name || "UNMAPPED"; }
function itemAvailable(item: MenuItem) { return item.isActive !== false && item.soldOut !== true && (item.onlineEnabled ?? item.isOnlineEnabled ?? true) !== false; }
function blockerText(message: string) { return <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg p-3 text-xs"><p className="font-semibold">INSUFFICIENT DATA</p><p>{message}</p></div>; }
function purchasingKey(line: PurchasingLine, index: number) { return String(line.id ?? line.fieldKey ?? `${line.item || line.name}-${index}`); }
function normalizeUnit(unit: string | null | undefined) { const value = String(unit ?? "").trim().toLowerCase(); if (["each", "ea", "unit", "bun"].includes(value)) return "each"; if (["g", "gram", "grams"].includes(value)) return "g"; if (["kg", "kilogram", "kilograms"].includes(value)) return "kg"; if (["ml", "millilitre", "milliliter"].includes(value)) return "ml"; if (["l", "litre", "liter"].includes(value)) return "l"; if (["pc", "pcs", "piece", "pieces"].includes(value)) return "pcs"; if (["pack", "packet"].includes(value)) return "pack"; if (["box", "carton"].includes(value)) return "box"; return value; }
function calculateAutoUnitCost(line: PurchasingLine | undefined, unitUsed: string): { cost: number | null; reason: string | null } { if (!line) return { cost: null, reason: "Missing purchasing item" }; const directUnitCost = toNumber(line.unitCost ?? line.manualOverrideUnitCost); const packCost = toNumber(line.packCost ?? line.lineTotal); const purchaseQty = toNumber(line.purchaseUnitQty ?? line.quantity); const sourceUnit = normalizeUnit(line.unitDescription ?? line.purchaseUnit ?? line.orderUnit); const usedUnit = normalizeUnit(unitUsed); if (!sourceUnit && !line.unitDescription && !line.purchaseUnit && !line.orderUnit) return { cost: null, reason: "Missing purchase unit" }; if (directUnitCost !== null) { if (!usedUnit || usedUnit === sourceUnit || ["each", "pcs"].includes(usedUnit) || ["each", "pcs"].includes(sourceUnit)) return { cost: directUnitCost, reason: null }; if (sourceUnit === "kg" && usedUnit === "g") return { cost: directUnitCost / 1000, reason: null }; if (sourceUnit === "g" && usedUnit === "kg") return { cost: directUnitCost * 1000, reason: null }; if (sourceUnit === "l" && usedUnit === "ml") return { cost: directUnitCost / 1000, reason: null }; if (sourceUnit === "ml" && usedUnit === "l") return { cost: directUnitCost * 1000, reason: null }; return { cost: null, reason: "Missing conversion" }; } if (packCost === null) return { cost: null, reason: "Missing purchase price" }; if (purchaseQty === null || purchaseQty <= 0) return { cost: null, reason: "Missing conversion" }; return { cost: packCost / purchaseQty, reason: null }; }
function parseCostingRows(notes?: string | null): IngredientDraft[] | null { const marker = `${COSTING_NOTES_PREFIX} `; const line = String(notes ?? "").split("\n").find((entry) => entry.startsWith(marker)); if (!line) return null; try { const rows = JSON.parse(line.slice(marker.length)); return Array.isArray(rows) ? rows.map((row) => ({ ...makeIngredient(), ...row, id: createClientId("ingredient"), autoUnitCost: toNumber(row.autoUnitCost), costingStatus: row.costingStatus ?? null })) : null; } catch { return null; } }
function notesWithoutCostingRows(notes?: string | null) { return String(notes ?? "").split("\n").filter((line) => !line.startsWith(`${COSTING_NOTES_PREFIX} `) && !line.startsWith("Recipe status:") && !line.startsWith("Manual override recipe cost:")).join("\n").trim(); }

export default function MenuWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { recipeId } = useParams<{ recipeId?: string }>();
  const isNewRecipeRoute = location.pathname === "/menu/recipes/new";
  const activeTab: TabKey = location.pathname.includes("/menu/recipes") || location.pathname.includes("cost-calculator") ? "recipes" : location.pathname.includes("/menu/modifiers") ? "modifiers" : location.pathname.includes("/menu/categories") ? "categories" : location.pathname.includes("/menu/ingredients") ? "purchasing" : "items";
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | "new">("new");
  const [recipeForm, setRecipeForm] = useState({ name: "", category: "", description: "", imageUrl: "", yieldQuantity: "1", yieldUnit: "servings", preparationInstructions: "", cookingInstructions: "", specialNotes: "", directPrice: "", deliveryPartnerPrice: "", status: "Draft" });
  const [ingredientRows, setIngredientRows] = useState<IngredientDraft[]>(() => []);
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraft>(() => makeIngredient());
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", sortOrder: "" });
  const [modifierGroupForm, setModifierGroupForm] = useState({ name: "Make it Better", menuItemId: "" });
  const [modifierOptionForm, setModifierOptionForm] = useState({ groupId: "", name: "", thaiName: "", price: "", active: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const { data: rawItems, isLoading: itemsLoading } = useQuery<unknown>({ queryKey: ["/api/menu-v3/items"] });
  const { data: rawCategories, isLoading: categoriesLoading } = useQuery<unknown>({ queryKey: ["/api/menu-v3/categories"] });
  const { data: recipesData, isLoading: recipesLoading } = useQuery<Recipe[] | { rows?: Recipe[] }>({ queryKey: ["/api/recipes"] });
  const { data: purchasingData, isLoading: purchasingLoading } = useQuery<PurchasingListResponse>({ queryKey: ["/api/purchasing-items?active=true"] });
  const { data: modifierData, isLoading: modifiersLoading } = useQuery<{ groups?: ModifierGroup[] } | ModifierGroup[]>({ queryKey: ["/api/menu-v3/modifiers/groups"] });

  const exportDataLoading = itemsLoading || categoriesLoading || recipesLoading || modifiersLoading;
  const items = asArray<MenuItem>(normalizeMenuItems<MenuItem>(rawItems).items);
  const categories = asArray<MenuCategory>(normalizeMenuCategories<MenuCategory>(rawCategories).items);
  const recipes = Array.isArray(recipesData) ? recipesData : asArray<Recipe>(recipesData?.rows);
  const purchasingLines = asArray<PurchasingLine>(purchasingData?.lines ?? purchasingData?.items ?? purchasingData?.rows);
  const modifierGroups = Array.isArray(modifierData) ? modifierData : asArray<ModifierGroup>(modifierData?.groups);

  const categoryMap = useMemo(() => categories.reduce<Record<string, string>>((acc, category) => { if (category.id) acc[category.id] = category.name; return acc; }, {}), [categories]);
  const routeRecipe = recipeId ? recipes.find((recipe) => String(recipe.id) === recipeId) ?? null : null;
  const selectedRecipe = routeRecipe ?? (selectedRecipeId === "new" ? null : recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null);
  const validIngredientCosts = ingredientRows.map((row) => {
    const unitCost = toNumber(row.manualOverrideUnitCost) ?? row.autoUnitCost;
    const qty = toNumber(row.quantityUsed);
    return unitCost !== null && qty !== null ? unitCost * qty : null;
  });
  const realCostRows = ingredientRows.filter((row) => row.sourceType === "purchasing" && row.name && (toNumber(row.manualOverrideUnitCost) ?? row.autoUnitCost) !== null && toNumber(row.quantityUsed) !== null);
  const missingCostRows = ingredientRows.filter((row) => row.name && (toNumber(row.manualOverrideUnitCost) ?? row.autoUnitCost) === null);
  const hasValidRecipeCostData = realCostRows.length > 0 && missingCostRows.length === 0;
  const recipeTotal: number | null = hasValidRecipeCostData ? validIngredientCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null;
  const yieldQty = toNumber(recipeForm.yieldQuantity);
  const calculatedCostPerServing = yieldQty && recipeTotal !== null ? recipeTotal / yieldQty : null;
  const costPerServing = calculatedCostPerServing;
  const suggestedPrice = hasValidRecipeCostData && costPerServing !== null ? Math.ceil(costPerServing / 0.3) : null;
  const directPrice = toNumber(recipeForm.directPrice);
  const deliveryPartnerPrice = toNumber(recipeForm.deliveryPartnerPrice);
  const directMargin = hasValidRecipeCostData ? ((directPrice && costPerServing !== null ? ((directPrice - costPerServing) / directPrice) * 100 : null)) : null;
  const deliveryPartnerMargin = hasValidRecipeCostData ? ((deliveryPartnerPrice && costPerServing !== null ? ((deliveryPartnerPrice - costPerServing) / deliveryPartnerPrice) * 100 : null)) : null;
  const directProfit = hasValidRecipeCostData && directPrice !== null && costPerServing !== null ? directPrice - costPerServing : null;
  const deliveryPartnerProfit = hasValidRecipeCostData && deliveryPartnerPrice !== null && costPerServing !== null ? deliveryPartnerPrice - costPerServing : null;

  const saveRecipeMutation = useMutation({
    mutationFn: () => apiRequest(selectedRecipe ? `/api/recipes/${selectedRecipe.id}` : "/api/recipes", { method: selectedRecipe ? "PUT" : "POST", body: JSON.stringify({ name: recipeForm.name, category: recipeForm.category, description: recipeForm.description || null, yieldQuantity: recipeForm.yieldQuantity, yieldUnit: recipeForm.yieldUnit, imageUrl: recipeForm.imageUrl || null, totalCost: recipeTotal, costPerServing, sellingPrice: directPrice, suggestedPrice: deliveryPartnerPrice, deliveryPartnerMarginPercent: deliveryPartnerMargin, directMarginPercent: directMargin, isActive: recipeForm.status === "Live", instructions: `Preparation instructions:\n${recipeForm.preparationInstructions}\n\nCooking/build instructions:\n${recipeForm.cookingInstructions}`, notes: `${recipeForm.specialNotes ? `${recipeForm.specialNotes}\n` : ""}${COSTING_NOTES_PREFIX} ${JSON.stringify(ingredientRows.map(({ id, ...row }) => row))}\nRecipe status: ${recipeForm.status}` }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); if (recipeId) navigate("/menu/recipes"); },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recipes/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); navigate("/menu/recipes"); },
  });
  const createCategoryMutation = useMutation({ mutationFn: () => apiRequest("/api/menu-v3/categories/create", { method: "POST", body: JSON.stringify({ name: categoryForm.name, sortOrder: toNumber(categoryForm.sortOrder) ?? 0, isActive: true }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/categories"] }); setCategoryForm({ id: "", name: "", sortOrder: "" }); } });
  const updateCategoryMutation = useMutation({ mutationFn: () => apiRequest("/api/menu-v3/categories/update", { method: "POST", body: JSON.stringify({ id: categoryForm.id, name: categoryForm.name, sortOrder: toNumber(categoryForm.sortOrder) ?? 0, isActive: true }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/categories"] }); setCategoryForm({ id: "", name: "", sortOrder: "" }); } });
  const deleteCategoryMutation = useMutation({ mutationFn: (id: string) => apiRequest("/api/menu-v3/categories/delete", { method: "POST", body: JSON.stringify({ id }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/categories"] }) });
  const createModifierGroupMutation = useMutation({ mutationFn: () => apiRequest("/api/menu-v3/modifiers/groups/create", { method: "POST", body: JSON.stringify({ name: modifierGroupForm.name, menuItemId: modifierGroupForm.menuItemId }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] }) });
  const createModifierMutation = useMutation({ mutationFn: () => apiRequest("/api/menu-v3/modifiers/create", { method: "POST", body: JSON.stringify({ groupId: modifierOptionForm.groupId, name: modifierOptionForm.thaiName ? `${modifierOptionForm.name} (${modifierOptionForm.thaiName})` : modifierOptionForm.name, priceDelta: modifierOptionForm.price, isActive: modifierOptionForm.active }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] }) });
  const toggleMenuItemMutation = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("/api/menu-v3/items/toggle", { method: "POST", body: JSON.stringify({ id, isActive }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }) });
  const updateMenuItemMutation = useMutation({ mutationFn: (item: MenuItem) => apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: item.name, categoryId: item.categoryId, description: item.description, price: item.price ?? item.basePrice, imageUrl: item.imageUrl, isActive: item.isActive !== false, isOnlineEnabled: item.onlineEnabled ?? item.isOnlineEnabled ?? true, displayOrder: item.displayOrder ?? item.sortOrder }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }); setEditingItemId(null); } });

  const filteredItems = items.filter((item) => { const term = searchTerm.trim().toLowerCase(); const recipe = item.recipeId ? recipes.find((r) => String(r.id) === String(item.recipeId)) : item.recipes?.[0]?.recipe ?? recipes.find((r) => r.name?.toLowerCase() === item.name?.toLowerCase()); const matchesSearch = !term || [item.name, item.description, itemCategoryName(item, categoryMap), recipe?.name].some((value) => String(value ?? "").toLowerCase().includes(term)); const matchesStock = !showOutOfStockOnly || !itemAvailable(item); return matchesSearch && matchesStock; });
  const filteredRecipes = recipes;
  const filteredPurchasing = purchasingLines;
  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) ?? null : null;
  const outOfStockCount = items.filter((item) => !itemAvailable(item)).length;
  const exportMenuItems = () => {
    const header = ["Menu Item", "Category", "Description", "Menu Price", "Linked Recipe", "Food Cost / Serve", "Direct Recipe Price", "Direct Margin %", "Delivery Recipe Price", "Delivery Margin %", "Available", "Online Enabled", "POS Enabled", "Sold Out", "Modifiers"];
    const rows = items
      .map((item) => {
        const recipe = item.recipeId
          ? recipes.find((candidate) => String(candidate.id) === String(item.recipeId))
          : item.recipes?.[0]?.recipe ?? recipes.find((candidate) => candidate.name?.toLowerCase() === item.name?.toLowerCase());
        const groupsForItem = modifierGroups.filter((group) => group.menuItemId === item.id || group.linkedMenuItemIds?.includes(item.id));
        return [
          item.name || "UNMAPPED",
          itemCategoryName(item, categoryMap),
          item.description || "",
          toNumber(item.basePrice ?? item.price),
          recipe?.name || "",
          toNumber(recipe?.costPerServing),
          toNumber(recipe?.sellingPrice),
          toNumber(recipe?.directMarginPercent),
          toNumber(recipe?.suggestedPrice),
          toNumber(recipe?.deliveryPartnerMarginPercent),
          itemAvailable(item) ? "Yes" : "No",
          yesNo(item.onlineEnabled ?? item.isOnlineEnabled ?? true),
          yesNo(item.posEnabled),
          yesNo(item.soldOut),
          groupsForItem.map((group) => group.name).join("; "),
        ].map(csvCell).join(",");
      })
      .join("\n");
    const blob = new Blob([[header.map(csvCell).join(","), rows].filter(Boolean).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sbb-menu-items-pricing.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const itemGroups = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of filteredItems) {
      const category = itemCategoryName(item, categoryMap);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(item);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const categoryA = categories.find((category) => category.name === a);
      const categoryB = categories.find((category) => category.name === b);
      const orderA = categoryA?.sortOrder ?? categoryA?.displayOrder ?? 9999;
      const orderB = categoryB?.sortOrder ?? categoryB?.displayOrder ?? 9999;
      return orderA === orderB ? a.localeCompare(b) : Number(orderA) - Number(orderB);
    });
  }, [categories, categoryMap, filteredItems]);

  const openRecipe = (recipe: Recipe | null) => { if (recipe) { navigate(`/menu/recipes/${recipe.id}/edit`); return; } setSelectedRecipeId("new"); navigate(`/menu/recipes/new`); setRecipeForm({ name: "", category: "", description: "", imageUrl: "", yieldQuantity: "1", yieldUnit: "servings", preparationInstructions: "", cookingInstructions: "", specialNotes: "", directPrice: "", deliveryPartnerPrice: "", status: "Draft" }); setIngredientRows([]); };
  const updateIngredient = (id: string, patch: Partial<IngredientDraft>) => setIngredientRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateIngredientUnit = (row: IngredientDraft, unitUsed: string) => { const line = purchasingLines.find((candidate, index) => purchasingKey(candidate, index) === row.purchasingItemKey); const costing = calculateAutoUnitCost(line, unitUsed); updateIngredient(row.id, { unitUsed, autoUnitCost: costing.cost, costingStatus: costing.reason }); };
  const selectPurchasingLine = (rowId: string, key: string) => { const line = purchasingLines.find((candidate, index) => purchasingKey(candidate, index) === key); const unitUsed = line?.unitDescription || line?.purchaseUnit || line?.orderUnit || "Each"; const costing = calculateAutoUnitCost(line, unitUsed); updateIngredient(rowId, { purchasingItemKey: key, sourceType: "purchasing", name: line?.item || line?.name || "", unitUsed, autoUnitCost: costing.cost, costingStatus: costing.reason }); };


  const confirmDelete = (recipe: Recipe) => {
    if (window.confirm(`Delete recipe "${recipe.name}"? This archives the recipe and cannot be done instantly without confirmation.`)) {
      deleteRecipeMutation.mutate(recipe.id);
    }
  };

  useEffect(() => {
    if (activeTab !== "recipes" || !recipeId || !selectedRecipe || selectedRecipeId === selectedRecipe.id) return;
    setSelectedRecipeId(selectedRecipe.id);
    const instructions = String(selectedRecipe.instructions ?? "");
    setRecipeForm({ name: selectedRecipe.name ?? "", category: selectedRecipe.category ?? "", description: selectedRecipe.description ?? "", imageUrl: selectedRecipe.imageUrl ?? "", yieldQuantity: String(selectedRecipe.yieldQuantity ?? "1"), yieldUnit: selectedRecipe.yieldUnit ?? "servings", preparationInstructions: instructions.split("Cooking/build instructions:")[0]?.replace("Preparation instructions:", "").trim() ?? "", cookingInstructions: instructions.split("Cooking/build instructions:")[1]?.trim() ?? "", specialNotes: notesWithoutCostingRows(selectedRecipe.notes), directPrice: selectedRecipe.sellingPrice === null || selectedRecipe.sellingPrice === undefined ? "" : String(selectedRecipe.sellingPrice), deliveryPartnerPrice: selectedRecipe.suggestedPrice === null || selectedRecipe.suggestedPrice === undefined ? "" : String(selectedRecipe.suggestedPrice), status: selectedRecipe.notes?.includes("Recipe status: Archived") ? "Archived" : selectedRecipe.notes?.includes("Recipe status: Draft") ? "Draft" : (selectedRecipe.isActive === false ? "Draft" : "Live") });
    setIngredientRows(parseCostingRows(selectedRecipe.notes) ?? []);
  }, [activeTab, recipeId, selectedRecipe, selectedRecipeId]);

  if (activeTab === "recipes" && (recipeId || isNewRecipeRoute)) {
    return <RecipeEditorPage />;
  }

  return <div className="p-4 space-y-4 max-w-7xl mx-auto">
    <div className="space-y-2"><div><h1 className="text-lg font-semibold text-slate-900 dark:text-white">Menu</h1><p className="text-xs text-slate-500">Purchasing List → recipe costing → sellable menu items → Loyverse-style modifiers → categories.</p></div><div className="flex flex-wrap gap-2"><Link to="/menu/items" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "items" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Menu Items</Link><Link to="/menu/recipes" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "recipes" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Recipes & Costing</Link><Link to="/menu/modifiers" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "modifiers" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Modifiers</Link><Link to="/menu/categories" className={`text-xs px-3 py-1.5 rounded-lg border ${activeTab === "categories" ? "bg-black text-white border-black" : "bg-white text-slate-600 border-slate-200"}`}>Categories</Link>{activeTab === "purchasing" && <Link to="/menu/ingredients" className="text-xs px-3 py-1.5 rounded-lg border bg-black text-white border-black">Purchasing source compatibility</Link>}</div></div>
    {activeTab === "items" && <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"><Search className="h-4 w-4" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search" className="w-40 bg-transparent outline-none" /></label>
        <button type="button" onClick={() => setShowOutOfStockOnly((value) => !value)} className={`rounded-full border px-4 py-2 text-sm ${showOutOfStockOnly ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}>Out of Stock ({outOfStockCount})</button>
        <button type="button" className="inline-flex cursor-default items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500" title="No editable availability schedule is configured for this source"><Clock className="h-4 w-4" />Availability schedule</button>
        <button type="button" onClick={exportMenuItems} disabled={exportDataLoading || items.length === 0} className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" />Export Menu CSV</button>
      </div>
      {(itemsLoading || categoriesLoading || recipesLoading) && <div className="text-center py-12 text-slate-400 text-xs">Loading menu items...</div>}
      {!itemsLoading && itemGroups.length === 0 && blockerText("No menu items matched the current filters. Existing records are not hidden unless a filter is active.")}
      <div className="space-y-6">{itemGroups.map(([categoryName, categoryItems]) => {
        const collapsed = collapsedCategories[categoryName] === true;
        return <section key={categoryName} className="space-y-3"><button type="button" onClick={() => setCollapsedCategories((current) => ({ ...current, [categoryName]: !collapsed }))} className="flex w-full items-center justify-between gap-3 text-left"><h2 className="text-2xl font-bold text-slate-950">{categoryName}</h2><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">{collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}</span></button>{!collapsed && <div className="space-y-3">{categoryItems.map((item) => {
          const price = toNumber(item.basePrice ?? item.price);
          const recipe = item.recipeId ? recipes.find((r) => String(r.id) === String(item.recipeId)) : item.recipes?.[0]?.recipe ?? recipes.find((r) => r.name?.toLowerCase() === item.name?.toLowerCase());
          const available = itemAvailable(item);
          const groupsForItem = modifierGroups.filter((group) => group.menuItemId === item.id || group.linkedMenuItemIds?.includes(item.id));
          return <article key={item.id} role="button" tabIndex={0} onClick={() => setEditingItemId(item.id)} onKeyDown={(event) => { if (event.key === "Enter") setEditingItemId(item.id); }} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">{item.imageUrl ? <img src={item.imageUrl} alt={item.name || "Menu item"} className="h-full w-full object-cover" /> : <ImageIcon className="h-7 w-7" />}</div><div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-slate-950">{item.name || "UNMAPPED"}</h3><p className="mt-1 text-sm text-slate-500">{item.description || "—"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="font-mono text-sm text-slate-900">{price === null ? "UNMAPPED" : fmtMoney(price)}</span><span>Linked recipe: {recipe?.name || "No recipe linked"}</span>{groupsForItem.length > 0 && <span>Modifiers: {groupsForItem.map((group) => group.name).join(", ")}</span>}</div></div><button type="button" aria-label={`${available ? "Mark unavailable" : "Mark available"} ${item.name || "menu item"}`} onClick={(event) => { event.stopPropagation(); toggleMenuItemMutation.mutate({ id: item.id, isActive: !available }); }} className={`relative h-8 w-14 shrink-0 rounded-full transition ${available ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${available ? "left-7" : "left-1"}`} /></button></article>;
        })}</div>}</section>;
      })}</div>
      {editingItem && <MenuItemEditor item={editingItem} categories={categories} recipes={recipes} modifierGroups={modifierGroups} onClose={() => setEditingItemId(null)} />}
    </div>}
    {activeTab === "recipes" && <RecipeListPage />}
    {activeTab === "modifiers" && <ModifierManager />}
    {activeTab === "categories" && <MenuCategoriesPage />}
    {activeTab === "purchasing" && <div className="space-y-3"><p className="text-xs text-slate-500">Compatibility route only. Use Operations &gt; Purchasing as source of truth; this route is hidden from primary Menu navigation.</p>{purchasingLoading && <div className="text-center py-12 text-slate-400 text-xs">Loading purchasing ingredients...</div>}{!purchasingLoading && purchasingData?.noData && blockerText(purchasingData.message || "No Purchasing List data is available.")}<div className="border rounded-lg overflow-x-auto bg-white"><table className="w-full min-w-[900px] text-xs"><thead><tr className="border-b bg-slate-50">{["Purchasable item","Category","Supplier","Purchase unit","Pack size / qty","Purchase price","Calculated unit cost","Manual override unit cost","Status"].map((h) => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead><tbody>{filteredPurchasing.map((line, index) => <tr key={line.fieldKey || `${line.item}-${index}`} className="border-b"><td className="p-2 font-medium">{line.item || line.name || "UNMAPPED"}</td><td className="p-2">{line.category || "UNMAPPED"}</td><td className="p-2">{line.supplierName || line.supplier || "UNMAPPED"}</td><td className="p-2">{line.unitDescription || line.purchaseUnit || line.orderUnit || "UNMAPPED"}</td><td className="p-2 font-mono">{line.quantity ?? "UNMAPPED"}</td><td className="p-2 font-mono">{fmtMoney(line.lineTotal)}</td><td className="p-2 font-mono">{fmtMoney(line.unitCost)}</td><td className="p-2 font-mono">{fmtMoney(line.manualOverrideUnitCost)}</td><td className="p-2">{line.active === false || line.isActive === false ? "Inactive" : "Active"}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
