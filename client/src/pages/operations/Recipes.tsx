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

type PurchaseUnit = "kg" | "g" | "l" | "ml" | "each";
type PortionUnit = "g" | "ml" | "each" | "slice";
type BaseUnit = "g" | "ml" | "each";

type IngredientCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  purchaseQty: number | null;
  purchaseUnit: PurchaseUnit | null;
  purchaseCost: number | null;
};

type RecipeIngredientLine = {
  ingredientId: string;
  name: string;
  portionQty: number;
  portionUnit: PortionUnit;
  conversionFactor: number | null;
};

type RecipeCard = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  total_cost: number;
  cost_per_serving: number;
  ingredients: any[];
  updated_at: string | null;
  yield_quantity?: number | null;
};

const purchaseUnitToBase: Record<PurchaseUnit, BaseUnit> = {
  kg: "g",
  g: "g",
  l: "ml",
  ml: "ml",
  each: "each",
};

const portionUnitType: Record<PortionUnit, BaseUnit | "slice"> = {
  g: "g",
  ml: "ml",
  each: "each",
  slice: "slice",
};

const toBaseQty = (qty: number, unit?: PurchaseUnit | null): number | null => {
  if (!unit) return null;
  if (unit === "kg" || unit === "l") return qty * 1000;
  if (unit === "g" || unit === "ml" || unit === "each") return qty;
  return null;
};

const getBaseUnit = (unit?: PurchaseUnit | null): BaseUnit | null => {
  if (!unit) return null;
  return purchaseUnitToBase[unit] ?? null;
};

const isConversionRequired = (purchaseUnit: PurchaseUnit | null, portionUnit: PortionUnit) => {
  const purchaseType = getBaseUnit(purchaseUnit);
  const portionType = portionUnitType[portionUnit];
  if (!purchaseType || !portionType) return false;
  return purchaseType !== portionType;
};

const formatQty = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "UNMAPPED";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
};

const portionUnits: PortionUnit[] = ["g", "ml", "each", "slice"];

const normalizePortionUnit = (unit: unknown, fallback?: BaseUnit | null): PortionUnit => {
  const normalized = String(unit ?? "").toLowerCase().trim();
  if (portionUnits.includes(normalized as PortionUnit)) {
    return normalized as PortionUnit;
  }
  if (fallback) return fallback;
  return "g";
};

type LineStatus = "valid" | "missing-conversion" | "zero-cost" | "invalid-unit";

type LineWithCost = RecipeIngredientLine & {
  purchaseQty: number | null;
  purchaseUnit: PurchaseUnit | null;
  purchaseCost: number | null;
  baseUnit: BaseUnit | null;
  baseCostPerUnit: number;
  costTHB: number;
  conversionRequired: boolean;
  status: LineStatus;
  statusLabel: string;
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

  const { data: ingredientCatalog = [] } = useQuery<IngredientCatalogItem[]>({
    queryKey: ["/api/ingredients/canonical"],
    queryFn: async () => {
      const res = await fetch("/api/ingredients/canonical");
      if (!res.ok) throw new Error("Failed to load canonical ingredients");
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
        category: item.category ?? null,
        purchaseQty: item.purchaseQty !== null ? toNumber(item.purchaseQty) : null,
        purchaseUnit: item.purchaseUnit ? (String(item.purchaseUnit).toLowerCase() as PurchaseUnit) : null,
        purchaseCost: item.purchaseCost !== null ? toNumber(item.purchaseCost) : null,
      }));
    },
  });

  const ingredientMap = useMemo(() => {
    return new Map(ingredientCatalog.map((item) => [item.id, item]));
  }, [ingredientCatalog]);

  // Canonical recipe costing
  // Cost is derived deterministically from ingredient purchase data.
  // Manual overrides are not permitted.
  // INCOMPLETE recipes must not be attached to products.
  const buildLineWithCost = (line: RecipeIngredientLine): LineWithCost => {
    const ingredient = ingredientMap.get(line.ingredientId);
    const purchaseQty = ingredient?.purchaseQty ?? null;
    const purchaseUnit = ingredient?.purchaseUnit ?? null;
    const purchaseCost = ingredient?.purchaseCost ?? null;
    const baseQty = purchaseQty !== null ? toBaseQty(purchaseQty, purchaseUnit) : null;
    const baseUnit = getBaseUnit(purchaseUnit);
    const baseCostPerUnit = baseQty && purchaseCost && baseQty > 0 && purchaseCost > 0 ? purchaseCost / baseQty : 0;
    const portionQty = toNumber(line.portionQty);
    const conversionRequired = isConversionRequired(purchaseUnit, line.portionUnit);

    let costTHB = 0;
    let status: LineStatus = "valid";
    let statusLabel = "Valid";

    if (!ingredient || !purchaseUnit || !baseUnit || baseQty === null) {
      status = "invalid-unit";
      statusLabel = "Invalid unit";
    } else if (purchaseCost === null || purchaseCost <= 0 || baseCostPerUnit <= 0) {
      status = "zero-cost";
      statusLabel = "Zero cost";
    } else if (portionQty <= 0) {
      status = "zero-cost";
      statusLabel = "Zero cost";
    } else if (conversionRequired) {
      if (!line.conversionFactor || line.conversionFactor <= 0) {
        status = "missing-conversion";
        statusLabel = "Missing conversion";
      } else {
        const baseQtyPerPortion = baseQty / line.conversionFactor;
        costTHB = portionQty * baseQtyPerPortion * baseCostPerUnit;
        if (!Number.isFinite(costTHB) || costTHB <= 0) {
          status = "zero-cost";
          statusLabel = "Zero cost";
        }
      }
    } else {
      costTHB = portionQty * baseCostPerUnit;
      if (!Number.isFinite(costTHB) || costTHB <= 0) {
        status = "zero-cost";
        statusLabel = "Zero cost";
      }
    }

    return {
      ...line,
      purchaseQty,
      purchaseUnit,
      purchaseCost,
      baseUnit,
      baseCostPerUnit,
      costTHB,
      conversionRequired,
      status,
      statusLabel,
    };
  };

  const filteredIngredients = useMemo(() => {
    const term = ingredientSearch.toLowerCase();
    return ingredientCatalog
      .filter((item) => item.name.toLowerCase().includes(term))
      .slice(0, 12);
  }, [ingredientCatalog, ingredientSearch]);

  const linesWithCosts = useMemo<LineWithCost[]>(() => {
    return lines.map(buildLineWithCost);
  }, [lines, ingredientMap]);

  const recipeCostTHB = useMemo(
    () => linesWithCosts.reduce((sum, line) => sum + line.costTHB, 0),
    [linesWithCosts]
  );

  const costPerPortionTHB = useMemo(
    () => recipeCostTHB / Math.max(1, portions),
    [recipeCostTHB, portions]
  );

  const hasInvalidLines = linesWithCosts.some((line) => line.status !== "valid");

  const getRecipeStatus = (recipe: RecipeCard) => {
    const mappedLines = (recipe.ingredients || []).map(normalizeRecipeLine);
    if (mappedLines.length === 0) {
      return "INCOMPLETE";
    }
    const invalid = mappedLines.map(buildLineWithCost).some((line) => line.status !== "valid");
    return invalid ? "INCOMPLETE" : "VALID";
  };

  const addIngredientLine = (ingredient: IngredientCatalogItem) => {
    const defaultUnit = getBaseUnit(ingredient.purchaseUnit) ?? "g";
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        portionQty: 0,
        portionUnit: defaultUnit,
        conversionFactor: null,
      },
    ]);
    setIngredientSearch("");
  };

  const updateLineQty = (index: number, portionQty: number) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, portionQty } : line)));
  };

  const updateLineUnit = (index: number, portionUnit: PortionUnit) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, portionUnit } : line)));
  };

  const updateConversionFactor = (index: number, conversionFactor: number | null) => {
    setLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, conversionFactor } : line))
    );
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

  const normalizeRecipeLine = (line: any): RecipeIngredientLine => {
    const ingredientId = String(line.ingredientId ?? line.ingredient_id ?? "");
    const ingredient = ingredientMap.get(ingredientId);
    const fallbackUnit = getBaseUnit(ingredient?.purchaseUnit ?? null);
    return {
      ingredientId,
      name: line.name || line.ingredientName || "Unknown",
      portionQty: toNumber(line.portionQty ?? line.qty ?? line.portion ?? 0),
      portionUnit: normalizePortionUnit(line.portionUnit ?? line.unit, fallbackUnit),
      conversionFactor:
        line.conversionFactor !== undefined && line.conversionFactor !== null
          ? toNumber(line.conversionFactor)
          : line.conversion_factor !== undefined && line.conversion_factor !== null
          ? toNumber(line.conversion_factor)
          : null,
    };
  };

  const selectRecipe = (recipe: RecipeCard) => {
    setSelectedRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeDescription(recipe.description || "");
    setRecipeCategory(recipe.category || "Burgers");
    setPortions(toNumber(recipe.yield_quantity ?? 1) || 1);

    const mappedLines = (recipe.ingredients || []).map(normalizeRecipeLine);

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

  const buildLinePayload = (line: LineWithCost) => ({
    ingredientId: line.ingredientId,
    name: line.name,
    qty: line.portionQty,
    unit: line.portionUnit,
    unitCostTHB: line.baseCostPerUnit,
    costTHB: line.costTHB,
    purchaseQty: line.purchaseQty,
    purchaseUnit: line.purchaseUnit,
    purchaseCost: line.purchaseCost,
    conversionFactor: line.conversionFactor,
    baseUnit: line.baseUnit,
  });

  const buildUpdatePayload = () => ({
    name: recipeName.trim(),
    description: recipeDescription,
    category: recipeCategory,
    yield_quantity: portions || 1,
    yield_unit: "servings",
    ingredients: JSON.stringify(linesWithCosts.map(buildLinePayload)),
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
    if (hasInvalidLines) {
      const firstInvalid = linesWithCosts.find((line) => line.status !== "valid");
      toast({
        title: "Fix ingredient lines before saving",
        description: firstInvalid ? `${firstInvalid.name}: ${firstInvalid.statusLabel}` : undefined,
        variant: "destructive",
      });
      return;
    }

    if (selectedRecipeId) {
      updateRecipeMutation.mutate({ id: selectedRecipeId, payload: buildUpdatePayload() });
      return;
    }

    saveRecipeMutation.mutate({
      recipeName: recipeName.trim(),
      description: recipeDescription,
      lines: linesWithCosts.map(buildLinePayload),
      totals: {
        recipeCostTHB,
        costPerPortionTHB,
      },
      note: "",
      portions: portions || 1,
    });
  };

  const isSaveDisabled = !recipeName.trim() || linesWithCosts.length === 0 || hasInvalidLines;

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
            <p className="mb-3 text-xs text-slate-500">INCOMPLETE recipes cannot be attached to menu items.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Cost/Serve</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                  <TableHead className="text-xs text-right">Updated</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="text-xs font-medium">{recipe.name}</TableCell>
                    <TableCell className="text-xs">{recipe.category || "UNMAPPED"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{THB(recipe.cost_per_serving)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
                          getRecipeStatus(recipe) === "VALID"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {getRecipeStatus(recipe)}
                      </span>
                    </TableCell>
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
                    <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-6">
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
                        Purchase: {formatQty(ingredient.purchaseQty)} {ingredient.purchaseUnit ?? ""}
                      </div>
                      <div className="text-slate-500">
                        Category: {ingredient.category ?? "Uncategorised"}
                      </div>
                      <div className="text-slate-500">
                        Cost: {ingredient.purchaseCost !== null ? THB(ingredient.purchaseCost) : "UNMAPPED"}
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
                    <TableHead className="text-xs">Portion</TableHead>
                    <TableHead className="text-xs">Conversion</TableHead>
                    <TableHead className="text-xs text-right">Line Cost</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linesWithCosts.map((line, idx) => {
                    const conversionLabel =
                      line.conversionRequired && line.purchaseUnit
                        ? `How many ${line.portionUnit} per ${line.purchaseUnit}?`
                        : "Conversion not required";
                    const baseCostLabel =
                      line.baseUnit && line.baseCostPerUnit > 0
                        ? `${THB(line.baseCostPerUnit)} / ${line.baseUnit}`
                        : "UNMAPPED";

                    return (
                      <TableRow key={`${line.ingredientId}-${idx}`} className="align-top">
                        <TableCell className="text-xs">
                          <div className="font-medium text-slate-900">{line.name}</div>
                          <div className="mt-1 text-slate-500">
                            Purchase: {formatQty(line.purchaseQty)} {line.purchaseUnit ?? ""}
                          </div>
                          <div className="text-slate-500">
                            Purchase cost: {line.purchaseCost !== null ? THB(line.purchaseCost) : "UNMAPPED"}
                          </div>
                          <div className="text-slate-500">Base cost: {baseCostLabel}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={line.portionQty}
                              onChange={(e) => updateLineQty(idx, toNumber(e.target.value))}
                              className="h-8 w-28 text-right text-xs"
                            />
                            <Select
                              value={line.portionUnit}
                              onValueChange={(value) => updateLineUnit(idx, value as PortionUnit)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {portionUnits.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {line.conversionRequired ? (
                            <div className="space-y-2">
                              <div className="text-slate-600">{conversionLabel}</div>
                              <Input
                                type="number"
                                min={0}
                                value={line.conversionFactor ?? ""}
                                onChange={(e) =>
                                  updateConversionFactor(
                                    idx,
                                    e.target.value === "" ? null : toNumber(e.target.value)
                                  )
                                }
                                className="h-8 w-32 text-xs"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-500">{conversionLabel}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-slate-500">Line cost</div>
                            <div className="text-sm font-semibold tabular-nums">{THB(line.costTHB)}</div>
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
                                line.status === "valid"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : line.status === "missing-conversion"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : line.status === "zero-cost"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-100 text-slate-700"
                              }`}
                            >
                              {line.statusLabel}
                            </span>
                          </div>
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
                      <TableCell colSpan={5} className="text-xs text-slate-500 py-6 text-center">
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
            <Button onClick={handleSave} disabled={isSaveDisabled}>
              {selectedRecipeId ? "Update Recipe" : "Save Recipe"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
