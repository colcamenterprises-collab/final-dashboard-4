import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const THB = (value: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type UnitFamily = "mass" | "volume" | "each" | "unknown";

type IngredientCatalogItem = {
  id: string;
  name: string;
  baseUnit: string;
  unitCostPerBase: number;
  packageQty: number | null;
  packageUnit: string | null;
};

type RecipeIngredientLine = {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
  unitCostTHB: number;
  costTHB: number;
};

type RecipeCard = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  total_cost: number;
  cost_per_serving: number;
  ingredients: RecipeIngredientLine[];
  updated_at: string | null;
  yield_quantity?: number | null;
};

const unitFamilies: Record<string, UnitFamily> = {
  g: "mass",
  kg: "mass",
  ml: "volume",
  l: "volume",
  each: "each",
  unit: "each",
  units: "each",
  piece: "each",
  pieces: "each",
};

const normalizeUnit = (unit?: string | null) => (unit ? unit.toLowerCase().trim() : "");

const getUnitFamily = (unit?: string | null): UnitFamily => {
  if (!unit) return "unknown";
  return unitFamilies[normalizeUnit(unit)] ?? "unknown";
};

const toBaseQty = (qty: number, unit?: string | null): number | null => {
  const normalized = normalizeUnit(unit);
  if (!normalized) return null;
  if (normalized === "g" || normalized === "ml" || normalized === "each") return qty;
  if (normalized === "kg") return qty * 1000;
  if (normalized === "l") return qty * 1000;
  if (normalized === "unit" || normalized === "units" || normalized === "piece" || normalized === "pieces") {
    return qty;
  }
  return null;
};

const buildIngredientCatalog = (
  canonical: Array<{ id: string; name: string; baseUnit: string; unitCostPerBase: number }> = [],
  purchasing: Array<{ id: string; name: string; packageQty: number | null; packageUnit: string | null }> = []
) => {
  const purchasingMap = new Map(
    purchasing.map((item) => [String(item.id), { packageQty: item.packageQty, packageUnit: item.packageUnit }])
  );

  return canonical.map((item) => {
    const purchase = purchasingMap.get(String(item.id));
    return {
      id: String(item.id),
      name: item.name,
      baseUnit: item.baseUnit,
      unitCostPerBase: toNumber(item.unitCostPerBase),
      packageQty: purchase?.packageQty ?? null,
      packageUnit: purchase?.packageUnit ?? null,
    } satisfies IngredientCatalogItem;
  });
};

export default function Recipes() {
  const { toast } = useToast();
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("Burgers");
  const [portions, setPortions] = useState(1);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [lines, setLines] = useState<RecipeIngredientLine[]>([]);

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<RecipeCard[]>({
    queryKey: ["/api/recipes/cards"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/cards");
      if (!res.ok) throw new Error("Failed to load recipes");
      return res.json();
    },
  });

  const { data: canonicalIngredients = [] } = useQuery<
    Array<{ id: string; name: string; baseUnit: string; unitCostPerBase: number }>
  >({
    queryKey: ["/api/ingredients/canonical"],
    queryFn: async () => {
      const res = await fetch("/api/ingredients/canonical");
      if (!res.ok) throw new Error("Failed to load canonical ingredients");
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
        baseUnit: item.baseUnit,
        unitCostPerBase: toNumber(item.unitCostPerBase),
      }));
    },
  });

  const { data: purchasingIngredients = [] } = useQuery<
    Array<{ id: string; name: string; packageQty: number | null; packageUnit: string | null }>
  >({
    queryKey: ["/api/ingredients"],
    queryFn: async () => {
      const res = await fetch("/api/ingredients");
      if (!res.ok) throw new Error("Failed to load ingredients");
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
        packageQty: item.packageQty ?? null,
        packageUnit: item.packageUnit ?? null,
      }));
    },
  });

  const ingredientCatalog = useMemo(
    () => buildIngredientCatalog(canonicalIngredients, purchasingIngredients),
    [canonicalIngredients, purchasingIngredients]
  );

  const ingredientMap = useMemo(() => {
    return new Map(ingredientCatalog.map((item) => [item.id, item]));
  }, [ingredientCatalog]);

  const filteredIngredients = useMemo(() => {
    const term = ingredientSearch.toLowerCase();
    return ingredientCatalog
      .filter((item) => item.name.toLowerCase().includes(term))
      .slice(0, 12);
  }, [ingredientCatalog, ingredientSearch]);

  const linesWithCosts = useMemo(() => {
    return lines.map((line) => {
      const ingredient = ingredientMap.get(line.ingredientId);
      const unitCost = ingredient?.unitCostPerBase ?? 0;
      const qty = toNumber(line.qty);
      const cost = qty * unitCost;
      return {
        ...line,
        unit: ingredient?.baseUnit || line.unit,
        unitCostTHB: unitCost,
        costTHB: cost,
      };
    });
  }, [lines, ingredientMap]);

  const recipeCostTHB = useMemo(
    () => linesWithCosts.reduce((sum, line) => sum + line.costTHB, 0),
    [linesWithCosts]
  );

  const costPerPortionTHB = useMemo(
    () => recipeCostTHB / Math.max(1, portions),
    [recipeCostTHB, portions]
  );

  const invalidQty = linesWithCosts.some((line) => line.qty <= 0);

  const addIngredientLine = (ingredient: IngredientCatalogItem) => {
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        qty: 0,
        unit: ingredient.baseUnit,
        unitCostTHB: ingredient.unitCostPerBase,
        costTHB: 0,
      },
    ]);
    setIngredientSearch("");
  };

  const updateLineQty = (index: number, qty: number) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, qty } : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setSelectedRecipeId(null);
    setRecipeName("");
    setRecipeDescription("");
    setRecipeCategory("Burgers");
    setPortions(1);
    setLines([]);
  };

  const selectRecipe = (recipe: RecipeCard) => {
    setSelectedRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeDescription(recipe.description || "");
    setRecipeCategory(recipe.category || "Burgers");
    setPortions(toNumber(recipe.yield_quantity ?? 1) || 1);

    const mappedLines = (recipe.ingredients || []).map((line) => {
      const ingredient = ingredientMap.get(String(line.ingredientId));
      const baseUnit = ingredient?.baseUnit || line.unit;
      const unitCost = ingredient?.unitCostPerBase ?? toNumber(line.unitCostTHB);
      const qty = toNumber(line.qty);
      return {
        ingredientId: String(line.ingredientId),
        name: line.name,
        qty,
        unit: baseUnit,
        unitCostTHB: unitCost,
        costTHB: qty * unitCost,
      };
    });

    setLines(mappedLines);
  };

  const updateRecipeRecord = async (id: number, payload: any) => {
    const res = await fetch(`/api/recipes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to update recipe");
    }
    return data;
  };

  const saveRecipeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Failed to save recipe");
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        try {
          await updateRecipeRecord(data.id, buildUpdatePayload());
        } catch (error: any) {
          toast({ title: "Recipe saved with warnings", description: error.message, variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cards"] });
      toast({ title: "Recipe saved", description: "Recipe created successfully." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const updateRecipeMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => updateRecipeRecord(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cards"] });
      toast({ title: "Recipe updated", description: "Recipe updated successfully." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const buildUpdatePayload = () => ({
    name: recipeName.trim(),
    description: recipeDescription,
    category: recipeCategory,
    yield_quantity: portions || 1,
    yield_unit: "servings",
    ingredients: JSON.stringify(linesWithCosts),
    total_cost: recipeCostTHB,
    cost_per_serving: costPerPortionTHB,
    waste_factor: 0,
    yield_efficiency: 0.9,
    notes: "",
  });

  const handleSave = () => {
    if (!recipeName.trim()) {
      toast({ title: "Recipe name required", variant: "destructive" });
      return;
    }
    if (linesWithCosts.length === 0) {
      toast({ title: "Add ingredients before saving", variant: "destructive" });
      return;
    }
    if (invalidQty) {
      toast({ title: "All quantities must be greater than 0", variant: "destructive" });
      return;
    }

    if (selectedRecipeId) {
      updateRecipeMutation.mutate({ id: selectedRecipeId, payload: buildUpdatePayload() });
      return;
    }

    saveRecipeMutation.mutate({
      recipeName: recipeName.trim(),
      description: recipeDescription,
      lines: linesWithCosts,
      totals: {
        recipeCostTHB,
        costPerPortionTHB,
      },
      note: "",
      portions: portions || 1,
    });
  };

  const lineWarnings = (line: RecipeIngredientLine) => {
    const ingredient = ingredientMap.get(line.ingredientId);
    const warnings: string[] = [];

    if (!ingredient) {
      return ["Ingredient missing from catalog."];
    }

    if (ingredient.unitCostPerBase <= 0 || line.costTHB <= 0) {
      warnings.push("Cost is 0.");
    }

    const packQty = ingredient.packageQty;
    const packUnit = ingredient.packageUnit;
    if (packQty && packUnit) {
      const packFamily = getUnitFamily(packUnit);
      const baseFamily = getUnitFamily(ingredient.baseUnit);

      if (packFamily !== "unknown" && baseFamily !== "unknown" && packFamily !== baseFamily) {
        warnings.push("Unit mismatch with purchase unit.");
      }

      const packBase = toBaseQty(packQty, packUnit);
      const lineBase = toBaseQty(line.qty, ingredient.baseUnit);

      if (packBase !== null && lineBase !== null && lineBase > packBase) {
        warnings.push("Portion exceeds pack size.");
      }
    }

    return warnings;
  };

  if (recipesLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading recipes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recipe Management</h1>
          <p className="text-sm text-slate-500">Create and edit recipes with verified ingredient costs.</p>
        </div>
        <Button variant="outline" onClick={resetForm}>
          New Recipe
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card className="rounded-[4px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Total Cost</TableHead>
                  <TableHead className="text-xs text-right">Updated</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="text-xs font-medium">{recipe.name}</TableCell>
                    <TableCell className="text-xs">{recipe.category || "UNMAPPED"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{THB(recipe.total_cost)}</TableCell>
                    <TableCell className="text-xs text-right text-slate-500">
                      {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString("en-GB") : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Button size="sm" variant="outline" onClick={() => selectRecipe(recipe)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {recipes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-6">
                      No recipes available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[4px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recipe Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600">Recipe name</label>
                  <Input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Category</label>
                  <Select value={recipeCategory} onValueChange={setRecipeCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Burgers">Burgers</SelectItem>
                      <SelectItem value="Side Orders">Side Orders</SelectItem>
                      <SelectItem value="Sauce">Sauce</SelectItem>
                      <SelectItem value="Beverages">Beverages</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Portions</label>
                  <Input
                    type="number"
                    min={1}
                    value={portions}
                    onChange={(e) => setPortions(toNumber(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600">Description</label>
                <Textarea
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  className="mt-1 min-h-[90px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[4px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingredient Library</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                placeholder="Search ingredients"
                className="mb-3"
              />
              {ingredientSearch && (
                <div className="grid gap-2 md:grid-cols-2">
                  {filteredIngredients.map((ingredient) => (
                    <button
                      type="button"
                      key={ingredient.id}
                      onClick={() => addIngredientLine(ingredient)}
                      className="rounded border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <div className="font-medium text-slate-900">{ingredient.name}</div>
                      <div className="text-slate-500">
                        Unit cost: {THB(ingredient.unitCostPerBase)} / {ingredient.baseUnit}
                      </div>
                      <div className="text-slate-500">
                        Pack: {ingredient.packageQty ?? "UNMAPPED"} {ingredient.packageUnit ?? ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[4px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingredients</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ingredient</TableHead>
                    <TableHead className="text-xs text-right">Portion Qty</TableHead>
                    <TableHead className="text-xs">Unit</TableHead>
                    <TableHead className="text-xs">Pack</TableHead>
                    <TableHead className="text-xs text-right">Unit Cost</TableHead>
                    <TableHead className="text-xs text-right">Line Cost</TableHead>
                    <TableHead className="text-xs">Warnings</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linesWithCosts.map((line, idx) => {
                    const ingredient = ingredientMap.get(line.ingredientId);
                    const warnings = lineWarnings(line);
                    return (
                      <TableRow key={`${line.ingredientId}-${idx}`}>
                        <TableCell className="text-xs font-medium">{line.name}</TableCell>
                        <TableCell className="text-xs text-right">
                          <Input
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => updateLineQty(idx, toNumber(e.target.value))}
                            className="h-8 w-24 text-right text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-xs">{ingredient?.baseUnit || line.unit}</TableCell>
                        <TableCell className="text-xs">
                          {ingredient?.packageQty ?? "UNMAPPED"} {ingredient?.packageUnit ?? ""}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{THB(line.unitCostTHB)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{THB(line.costTHB)}</TableCell>
                        <TableCell className="text-xs text-rose-600">
                          {warnings.length ? (
                            <ul className="space-y-1">
                              {warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400">OK</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Button size="sm" variant="ghost" onClick={() => removeLine(idx)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {linesWithCosts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs text-slate-500 py-6 text-center">
                        Add ingredients to begin costing.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[4px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cost Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-slate-600">Total cost</div>
                <div className="text-lg font-semibold tabular-nums">{THB(recipeCostTHB)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-600">Cost per portion</div>
                <div className="text-lg font-semibold tabular-nums">{THB(costPerPortionTHB)}</div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!recipeName.trim() || linesWithCosts.length === 0}>
              {selectedRecipeId ? "Update Recipe" : "Save Recipe"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
