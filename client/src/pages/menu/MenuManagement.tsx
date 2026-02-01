import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DishPreview3D } from "@/components/menu/DishPreview3D";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

type MenuItem = {
  id: string;
  name: string;
  basePrice: number;
  kitchenStation: string;
  isActive: boolean;
  categoryId: string;
  category?: MenuCategory;
  modifiers: Array<{ id: string; name: string }>;
  recipes: Array<{ ingredientId: string; quantityUsed: number; unit: string }>;
};

type Ingredient = {
  id: string;
  name: string;
  baseUnit?: string;
  packageQty?: number | null;
  packageUnit?: string | null;
};

type RecipeCard = {
  id: number;
  name: string;
  ingredients: Array<{ ingredientId: string; qty: number; unit: string; name: string }>;
  total_cost?: number;
  cost_per_serving?: number;
  image_url?: string | null;
};

export default function MenuManagement() {
  const { toast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemKitchen, setNewItemKitchen] = useState("prep");
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  const [ingredientSearch, setIngredientSearch] = useState("");
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [menuRecipeLines, setMenuRecipeLines] = useState<
    Array<{ ingredientId: string; quantityUsed: number; unit: string }>
  >([]);
  const [ingredientUnitOverride, setIngredientUnitOverride] = useState<string>("g");

  const { data: categories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-v3/categories"],
    queryFn: async () => {
      const res = await fetch("/api/menu-v3/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  const { data: items = [] } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-v3/items"],
    queryFn: async () => {
      const res = await fetch("/api/menu-v3/items");
      if (!res.ok) throw new Error("Failed to load items");
      return res.json();
    },
  });

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
    queryFn: async () => {
      const res = await fetch("/api/ingredients");
      if (!res.ok) throw new Error("Failed to load ingredients");
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
        baseUnit: item.portionUnit || item.baseUnit || "g",
        packageQty: item.packageQty ?? null,
        packageUnit: item.packageUnit ?? null,
      }));
    },
  });

  const { data: recipeCards = [] } = useQuery<RecipeCard[]>({
    queryKey: ["/api/recipes/cards"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/cards");
      if (!res.ok) throw new Error("Failed to load recipes");
      return res.json();
    },
  });

  const { data: modifierGroups = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/menu-v3/modifiers/groups"],
    queryFn: async () => {
      const res = await fetch("/api/menu-v3/modifiers/groups");
      if (!res.ok) throw new Error("Failed to load modifier groups");
      return res.json();
    },
  });

  const { data: menuItemRecipeData = [] } = useQuery<
    Array<{ ingredientId: string; quantityUsed: number; unit: string }>
  >({
    queryKey: ["/api/menu-v3/recipes", selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const res = await fetch(`/api/menu-v3/recipes/${selectedItemId}`);
      if (!res.ok) throw new Error("Failed to load menu item recipe");
      return res.json();
    },
    enabled: !!selectedItemId,
  });

  useEffect(() => {
    setMenuRecipeLines(menuItemRecipeData || []);
  }, [menuItemRecipeData]);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  const ingredientMap = useMemo(() => {
    return new Map(ingredients.map((item) => [item.id, item]));
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const term = ingredientSearch.toLowerCase();
    return ingredients
      .filter((item) => item.name.toLowerCase().includes(term))
      .slice(0, 12);
  }, [ingredients, ingredientSearch]);

  const matchingRecipes = useMemo(() => {
    if (!menuRecipeLines.length) return [];
    return recipeCards.filter((recipe) => {
      if (!recipe.ingredients?.length) return false;
      return recipe.ingredients.every((ing) =>
        menuRecipeLines.some(
          (line) =>
            String(line.ingredientId) === String(ing.ingredientId) &&
            toNumber(line.quantityUsed) === toNumber(ing.qty) &&
            line.unit === ing.unit
        )
      );
    });
  }, [menuRecipeLines, recipeCards]);

  const recipeMatchByItem = useMemo(() => {
    const map = new Map<string, RecipeCard>();
    items.forEach((item) => {
      if (!item.recipes?.length) return;
      const match = recipeCards.find((recipe) => {
        if (!recipe.ingredients?.length) return false;
        return recipe.ingredients.every((ing) =>
          item.recipes.some(
            (line) =>
              String(line.ingredientId) === String(ing.ingredientId) &&
              toNumber(line.quantityUsed) === toNumber(ing.qty) &&
              line.unit === ing.unit
          )
        );
      });
      if (match) map.set(item.id, match);
    });
    return map;
  }, [items, recipeCards]);

  const getMarginForecast = (item: MenuItem) => {
    const recipe = recipeMatchByItem.get(item.id);
    if (!recipe) return { status: "INSUFFICIENT_DATA" as const };
    const costPerServing = toNumber(recipe.cost_per_serving ?? recipe.total_cost);
    if (!costPerServing || item.basePrice <= 0) return { status: "INSUFFICIENT_DATA" as const };
    const margin = item.basePrice - costPerServing;
    const marginPct = (margin / item.basePrice) * 100;
    return { status: "READY" as const, margin, marginPct, costPerServing };
  };

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/menu-v3/categories/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/categories"] });
      setCategoryName("");
      toast({ title: "Category created" });
    },
    onError: (error: any) => {
      toast({ title: "Category failed", description: error.message, variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/menu-v3/items/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemName.trim(),
          basePrice: toNumber(newItemPrice),
          categoryId: newItemCategoryId,
          kitchenStation: newItemKitchen,
        }),
      });
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });
      setNewItemName("");
      setNewItemPrice("");
      toast({ title: "Menu item created" });
    },
    onError: (error: any) => {
      toast({ title: "Item failed", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/menu-v3/items/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onMutate: (payload: any) => {
      setSyncingItemId(payload?.id ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });
      toast({ title: "Menu item updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setSyncingItemId(null);
    },
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/menu-v3/recipes/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save recipe");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/recipes", selectedItemId] });
      toast({ title: "Menu item recipe saved" });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const attachModifierGroupMutation = useMutation({
    mutationFn: async ({ groupId, itemId }: { groupId: string; itemId: string }) => {
      const res = await fetch("/api/menu-v3/modifiers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, itemId }),
      });
      if (!res.ok) throw new Error("Failed to attach modifier group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });
      toast({ title: "Modifier group attached" });
    },
    onError: (error: any) => {
      toast({ title: "Attach failed", description: error.message, variant: "destructive" });
    },
  });

  const addIngredientLine = () => {
    if (!selectedIngredientId || !ingredientQty) {
      toast({ title: "Ingredient and quantity required", variant: "destructive" });
      return;
    }
    const qty = toNumber(ingredientQty);
    if (qty <= 0) {
      toast({ title: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }
    setMenuRecipeLines((prev) => [
      ...prev,
      { ingredientId: selectedIngredientId, quantityUsed: qty, unit: ingredientUnitOverride },
    ]);
    setIngredientQty("");
    setSelectedIngredientId("");
  };

  const removeIngredientLine = (index: number) => {
    setMenuRecipeLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateIngredientLine = (index: number, updates: Partial<{ quantityUsed: number; unit: string }>) => {
    setMenuRecipeLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...updates } : line))
    );
  };

  const addRecipeIngredients = () => {
    const recipe = recipeCards.find((card) => String(card.id) === selectedRecipeId);
    if (!recipe) {
      toast({ title: "Select a recipe", variant: "destructive" });
      return;
    }

    setMenuRecipeLines((prev) => {
      const next = [...prev];
      recipe.ingredients.forEach((ingredient) => {
        const existingIndex = next.findIndex(
          (line) => String(line.ingredientId) === String(ingredient.ingredientId) && line.unit === ingredient.unit
        );
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantityUsed: toNumber(next[existingIndex].quantityUsed) + toNumber(ingredient.qty),
          };
        } else {
          next.push({
            ingredientId: String(ingredient.ingredientId),
            quantityUsed: toNumber(ingredient.qty),
            unit: ingredient.unit,
          });
        }
      });
      return next;
    });

    toast({ title: "Recipe ingredients added" });
  };

  const handleSaveMenuItemRecipe = () => {
    if (!selectedItemId) return;
    if (!menuRecipeLines.length) {
      toast({ title: "Add recipe ingredients first", variant: "destructive" });
      return;
    }
    saveRecipeMutation.mutate({ itemId: selectedItemId, recipe: menuRecipeLines });
  };

  const handleUpdateSelectedItem = () => {
    if (!selectedItem) return;
    updateItemMutation.mutate({
      id: selectedItem.id,
      name: selectedItem.name,
      basePrice: selectedItem.basePrice,
      categoryId: selectedItem.categoryId,
      kitchenStation: selectedItem.kitchenStation,
      isActive: selectedItem.isActive,
    });
  };

  useEffect(() => {
    if (!selectedIngredientId) return;
    const ingredient = ingredientMap.get(selectedIngredientId);
    if (ingredient?.baseUnit) {
      setIngredientUnitOverride(ingredient.baseUnit);
    }
  }, [ingredientMap, selectedIngredientId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Menu Builder</h1>
        <p className="text-sm text-slate-500">
          Create menu items, attach recipes, and connect modifier groups using existing menu logic.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card className="rounded-[4px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Menu Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Input
                placeholder="Category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
              <Button onClick={() => createCategoryMutation.mutate()} disabled={!categoryName.trim()}>
                Add Category
              </Button>
            </div>

            <div className="grid gap-3 border-t pt-4">
              <Input placeholder="Menu item name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
              <Input
                placeholder="Base price (required by backend)"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                type="number"
                min={0}
              />
              <Select value={newItemCategoryId} onValueChange={setNewItemCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newItemKitchen} onValueChange={setNewItemKitchen}>
                <SelectTrigger>
                  <SelectValue placeholder="Kitchen station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prep">Prep</SelectItem>
                  <SelectItem value="grill">Grill</SelectItem>
                  <SelectItem value="fry">Fry</SelectItem>
                  <SelectItem value="drink">Drink</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => createItemMutation.mutate()}
                disabled={!newItemName.trim() || !newItemCategoryId}
              >
                Create Menu Item
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="text-xs font-semibold text-slate-600">Menu Items Grid</div>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => {
                  const forecast = getMarginForecast(item);
                  const isSyncing = syncingItemId === item.id && updateItemMutation.isPending;
                  return (
                    <Card key={item.id} className="rounded-[10px] border border-slate-200 shadow-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.category?.name || "UNMAPPED"}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {forecast.status === "READY"
                              ? `Margin ${forecast.marginPct.toFixed(1)}%`
                              : "Forecast unavailable"}
                          </Badge>
                        </div>

                        <DishPreview3D className="h-24 w-full rounded-[10px]" />

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Base price: ฿{item.basePrice.toFixed(2)}</span>
                          <span>Recipe lines: {item.recipes?.length || 0}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <div className={`h-2 w-2 rounded-full ${isSyncing ? "bg-amber-400" : "bg-emerald-500"}`} />
                            {isSyncing ? "Syncing" : "Synced"}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Publish</span>
                            <Switch
                              checked={item.isActive}
                              onCheckedChange={(checked) =>
                                updateItemMutation.mutate({
                                  id: item.id,
                                  name: item.name,
                                  basePrice: item.basePrice,
                                  categoryId: item.categoryId,
                                  kitchenStation: item.kitchenStation,
                                  isActive: checked,
                                })
                              }
                            />
                          </div>
                        </div>

                        <Button size="sm" variant="outline" onClick={() => setSelectedItemId(item.id)}>
                          Manage
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <Card className="rounded-[10px] border border-dashed border-slate-200">
                    <CardContent className="py-6 text-center text-xs text-slate-400">
                      No menu items created yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selectedItem && (
            <Card className="rounded-[4px]">
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Select a menu item to edit recipes and modifiers.
              </CardContent>
            </Card>
          )}

          {selectedItem && (
            <>
              <Card className="rounded-[4px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Menu Item Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-600">Name</label>
                    <Input
                      value={selectedItem.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        queryClient.setQueryData<MenuItem[]>(["/api/menu-v3/items"], (prev) =>
                          (prev || []).map((item) => (item.id === selectedItem.id ? { ...item, name: value } : item))
                        );
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Base price</label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedItem.basePrice}
                      onChange={(e) => {
                        const value = toNumber(e.target.value);
                        queryClient.setQueryData<MenuItem[]>(["/api/menu-v3/items"], (prev) =>
                          (prev || []).map((item) => (item.id === selectedItem.id ? { ...item, basePrice: value } : item))
                        );
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Category</label>
                    <Select
                      value={selectedItem.categoryId}
                      onValueChange={(value) => {
                        queryClient.setQueryData<MenuItem[]>(["/api/menu-v3/items"], (prev) =>
                          (prev || []).map((item) =>
                            item.id === selectedItem.id
                              ? { ...item, categoryId: value, category: categories.find((cat) => cat.id === value) }
                              : item
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Kitchen station</label>
                    <Select
                      value={selectedItem.kitchenStation}
                      onValueChange={(value) => {
                        queryClient.setQueryData<MenuItem[]>(["/api/menu-v3/items"], (prev) =>
                          (prev || []).map((item) =>
                            item.id === selectedItem.id ? { ...item, kitchenStation: value } : item
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prep">Prep</SelectItem>
                        <SelectItem value="grill">Grill</SelectItem>
                        <SelectItem value="fry">Fry</SelectItem>
                        <SelectItem value="drink">Drink</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={handleUpdateSelectedItem}>Save Menu Item</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[4px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recipe Attachments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-600">Add recipe from library</label>
                      <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select recipe" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipeCards.map((recipe) => (
                            <SelectItem key={recipe.id} value={String(recipe.id)}>
                              {recipe.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addRecipeIngredients}>Add Recipe Ingredients</Button>
                    </div>
                  </div>

                  <div className="rounded border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Ingredient</TableHead>
                          <TableHead className="text-xs text-right">Quantity</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs">Pack</TableHead>
                          <TableHead className="text-xs text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menuRecipeLines.map((line, idx) => {
                          const ingredient = ingredientMap.get(String(line.ingredientId));
                          return (
                            <TableRow key={`${line.ingredientId}-${idx}`}>
                              <TableCell className="text-xs font-medium">{ingredient?.name || "Unknown"}</TableCell>
                              <TableCell className="text-xs text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.quantityUsed}
                                  onChange={(e) =>
                                    updateIngredientLine(idx, { quantityUsed: toNumber(e.target.value) })
                                  }
                                  className="h-8 w-24 text-right text-xs"
                                />
                              </TableCell>
                              <TableCell className="text-xs">
                                <Select
                                  value={line.unit}
                                  onValueChange={(value) => updateIngredientLine(idx, { unit: value })}
                                >
                                  <SelectTrigger className="h-8 w-24 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="each">each</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-xs">
                                {ingredient?.packageQty ?? "UNMAPPED"} {ingredient?.packageUnit ?? ""}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                <Button size="sm" variant="ghost" onClick={() => removeIngredientLine(idx)}>
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {menuRecipeLines.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-xs text-slate-400 text-center py-6">
                              No recipe ingredients attached yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Search ingredient"
                    />
                    <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredIngredients.map((ingredient) => (
                          <SelectItem key={ingredient.id} value={ingredient.id}>
                            {ingredient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={ingredientQty}
                      onChange={(e) => setIngredientQty(e.target.value)}
                      placeholder="Quantity"
                      type="number"
                      min={0}
                    />
                    <Select value={ingredientUnitOverride} onValueChange={setIngredientUnitOverride}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="each">each</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addIngredientLine}>Add Ingredient</Button>
                  </div>

                  <div>
                    <Button onClick={handleSaveMenuItemRecipe}>Save Menu Item Recipe</Button>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-600">Recipes consumed when sold</h3>
                    {matchingRecipes.length > 0 ? (
                      <ul className="mt-2 text-xs text-slate-700 space-y-1">
                        {matchingRecipes.map((recipe) => (
                          <li key={recipe.id}>{recipe.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No matching recipes in the library.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[4px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Modifiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Select
                      onValueChange={(value) => {
                        if (selectedItem) {
                          attachModifierGroupMutation.mutate({ groupId: value, itemId: selectedItem.id });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Attach modifier group" />
                      </SelectTrigger>
                      <SelectContent>
                        {modifierGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div />
                  </div>

                  <div className="rounded border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Modifier group</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItem.modifiers?.map((group) => (
                          <TableRow key={group.id}>
                            <TableCell className="text-xs font-medium">{group.name}</TableCell>
                          </TableRow>
                        ))}
                        {(!selectedItem.modifiers || selectedItem.modifiers.length === 0) && (
                          <TableRow>
                            <TableCell className="text-xs text-slate-400 text-center py-6">
                              No modifier groups attached.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
