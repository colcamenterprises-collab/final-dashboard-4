import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n || 0);

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type UnitType = "g" | "ml" | "each";

type Ingredient = {
  id: number;
  name: string;
  portion_unit: UnitType;
};

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;
  unit: UnitType;
  baseUnit?: UnitType;
  unitCostTHB: number;
  costTHB: number;
};

type Recipe = {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  yield_quantity?: number;
};

export default function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const editingId = id ?? null;

  const [recipeName, setRecipeName] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("Burgers");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [recipeNotFound, setRecipeNotFound] = useState(false);

  const { data: recipeToEdit, isLoading: recipesLoading } = useQuery({
    queryKey: ["recipe", editingId],
    queryFn: async () => {
      const response = await axios.get<Recipe>(`/api/recipes/${editingId}`);
      return response.data;
    },
    enabled: Boolean(editingId),
    retry: false,
    onError: (error: any) => {
      if (error?.response?.status === 404) {
        setRecipeNotFound(true);
      }
    },
  });

  const { data: ingredientLines, isLoading: ingredientsLoading } = useQuery({
    queryKey: ["recipe-ingredients", editingId],
    queryFn: async () => {
      const response = await axios.get<{
        ingredients: Array<{
          ingredient_id: string;
          name: string;
          portion_quantity: number;
          portion_unit: UnitType;
          cost_per_portion: number;
          line_cost: number;
        }>;
      }>(`/api/recipes/${editingId}/ingredients`);
      return response.data.ingredients;
    },
    enabled: Boolean(editingId),
  });

  useEffect(() => {
    if (!editingId) return;
    if (recipeToEdit) {
      setRecipeName(recipeToEdit.name || "");
      setRecipeCategory(recipeToEdit.category || "Burgers");
      setRecipeDescription(recipeToEdit.description || "");
      setYieldQuantity(String(recipeToEdit.yield_quantity ?? 1));
    }
  }, [editingId, recipeToEdit]);

  useEffect(() => {
    if (!editingId) return;
    if (ingredientLines) {
      setLines(
        ingredientLines.map((line, index) => ({
          ingredientId: line.ingredient_id || `ingredient-${index}`,
          name: line.name || "Unnamed ingredient",
          qty: num(line.portion_quantity),
          unit: line.portion_unit || "g",
          baseUnit: line.portion_unit || "g",
          unitCostTHB: num(line.cost_per_portion),
          costTHB: num(line.line_cost),
        })),
      );
    }
  }, [editingId, ingredientLines]);

  useEffect(() => {
    if (recipeNotFound) {
      navigate("/menu/recipes");
    }
  }, [recipeNotFound, navigate]);

  const linesWithCosts = useMemo(() => {
    return lines.map((line) => {
      const qty = num(line.qty);
      const unitCost = num(line.unitCostTHB);
      return {
        ...line,
        unit: line.unit || line.baseUnit || "g",
        baseUnit: line.baseUnit || line.unit || "g",
        unitCostTHB: unitCost,
        costTHB: qty * unitCost,
      };
    });
  }, [lines]);

  const totalCost = useMemo(
    () => linesWithCosts.reduce((sum, line) => sum + num(line.costTHB), 0),
    [linesWithCosts],
  );

  const yieldCount = Math.max(1, num(yieldQuantity));
  const costPerServe = totalCost / yieldCount;

  const validation = useMemo(() => {
    if (!recipeName.trim()) {
      return { valid: false, reason: "Missing name" };
    }
    if (!recipeCategory.trim()) {
      return { valid: false, reason: "Missing category" };
    }
    if (num(yieldQuantity) <= 0) {
      return { valid: false, reason: "Yield required" };
    }
    if (linesWithCosts.length === 0) {
      return { valid: false, reason: "No ingredients" };
    }
    const hasMissingQty = linesWithCosts.some((line) => num(line.qty) <= 0);
    if (hasMissingQty) {
      return { valid: false, reason: "Ingredient quantity required" };
    }
    return { valid: true, reason: "Ready" };
  }, [recipeName, recipeCategory, yieldQuantity, linesWithCosts]);

  const handleSearch = async (q: string) => {
    const term = q.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await axios.get<Ingredient[]>(`/api/ingredients?search=${term}`);
      setSearchResults(res.data);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    void handleSearch(search);
  }, [search]);

  const reloadIngredients = async () => {
    if (!editingId) return;
    await queryClient.invalidateQueries({ queryKey: ["recipe-ingredients", editingId] });
  };

  const addIngredient = async (ingredient: Ingredient) => {
    if (!editingId) return;
    await axios.post(`/api/recipes/${editingId}/ingredients`, {
      ingredient_id: ingredient.id,
      portion_quantity: 1,
      portion_unit: ingredient.portion_unit,
    });
    await reloadIngredients();
    setSearch("");
  };

  const updateLineQty = (index: number, value: string) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index
          ? {
              ...line,
              qty: num(value),
            }
          : line,
      ),
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        recipeName: recipeName.trim(),
        description: recipeDescription || "",
        category: recipeCategory,
        lines: linesWithCosts,
        totals: {
          recipeCostTHB: totalCost,
          costPerPortionTHB: costPerServe,
        },
        portions: num(yieldQuantity) || 1,
      };

      const response = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to save recipe");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe saved", description: "Your recipe changes have been saved." });
      navigate("/menu/recipes");
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Unable to save the recipe.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Missing recipe id");
      const response = await fetch(`/api/recipes/${editingId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete recipe");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe deleted", description: "The recipe was removed." });
      navigate("/menu/recipes");
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete the recipe.",
        variant: "destructive",
      });
    },
  });

  if (ingredientsLoading || (recipesLoading && editingId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading recipe editor...</div>
      </div>
    );
  }

  if (editingId && recipeNotFound) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="text-lg text-slate-700">Recipe not found.</div>
          <Button asChild variant="outline" className="text-xs rounded-[4px]">
            <Link to="/menu/recipes">Back to recipe list</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 sm:px-8 py-6" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {editingId ? "Edit Recipe" : "New Recipe"}
          </h1>
          <p className="text-sm text-slate-600">Capture recipe details, ingredients, and cost summary.</p>
        </div>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Recipe Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
                placeholder="Recipe name"
                className="text-sm rounded-[4px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <Select value={recipeCategory} onValueChange={setRecipeCategory}>
                <SelectTrigger className="rounded-[4px] text-sm">
                  <SelectValue placeholder="Select category" />
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={recipeDescription}
                onChange={(event) => setRecipeDescription(event.target.value)}
                placeholder="Short description or preparation notes"
                className="rounded-[4px] text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Yield / Serves</label>
              <Input
                value={yieldQuantity}
                onChange={(event) => setYieldQuantity(event.target.value)}
                placeholder="Yield quantity"
                className="text-sm rounded-[4px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Ingredient Selector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Search ingredients</label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by ingredient name"
                className="text-sm rounded-[4px]"
              />
            </div>
            {search.trim().length > 0 && (
              <div className="space-y-2">
                {searchLoading ? (
                  <div className="text-sm text-slate-500">Searching...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="flex flex-col gap-2 rounded-[4px] border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900">{ingredient.name}</div>
                        <div className="text-xs text-slate-500">{ingredient.portion_unit}</div>
                      </div>
                      <Button
                        variant="outline"
                        className="text-xs rounded-[4px]"
                        onClick={() => addIngredient(ingredient)}
                      >
                        Add ingredient
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No ingredients found.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Ingredients Table</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden sm:grid sm:grid-cols-6 gap-4 text-xs font-medium text-slate-500">
              <div>Ingredient name</div>
              <div>Portion quantity</div>
              <div>Portion unit</div>
              <div>Conversion</div>
              <div>Line cost</div>
              <div>Remove</div>
            </div>
            {linesWithCosts.map((line, index) => {
              const conversionRequired = line.unit !== line.baseUnit;
              return (
                <div
                  key={`${line.ingredientId}-${index}`}
                  className="grid grid-cols-1 sm:grid-cols-6 gap-4 border border-slate-100 rounded-[4px] p-4 sm:items-center"
                >
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Ingredient name</div>
                    <div className="text-sm font-medium text-slate-900">{line.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Portion quantity</div>
                    <Input
                      value={line.qty}
                      onChange={(event) => updateLineQty(index, event.target.value)}
                      className="text-sm rounded-[4px]"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Portion unit</div>
                    <div className="text-sm text-slate-700">{line.unit}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Conversion</div>
                    <div className="text-sm text-slate-700">
                      {conversionRequired ? "Conversion required" : "Not required"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Line cost</div>
                    <div className="text-sm font-medium text-slate-900">{THB(line.costTHB)}</div>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      className="text-xs rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700"
                      onClick={() => removeLine(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
            {linesWithCosts.length === 0 && (
              <div className="text-sm text-slate-500">Add ingredients to begin costing.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Cost Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Total recipe cost</div>
                <div className="text-2xl font-semibold text-slate-900">{THB(totalCost)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Cost per serve</div>
                <div className="text-2xl font-semibold text-slate-900">{THB(costPerServe)}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Badge
                variant={validation.valid ? "default" : "secondary"}
                className={validation.valid ? "bg-emerald-600" : "bg-amber-100 text-amber-800"}
              >
                {validation.valid ? "VALID" : "INCOMPLETE"}
              </Badge>
              <span className="text-xs text-slate-500">{validation.reason}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="text-xs rounded-[4px]">
                <Link to="/menu/recipes">Back to recipe list</Link>
              </Button>
              {editingId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-xs rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700"
                    >
                      Delete recipe
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[4px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm">Delete recipe</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        This action cannot be undone. The recipe will be removed permanently.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-xs rounded-[4px]">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="text-xs rounded-[4px] bg-rose-600 hover:bg-rose-700"
                        onClick={() => deleteMutation.mutate()}
                      >
                        Delete recipe
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
              onClick={() => saveMutation.mutate()}
              disabled={!validation.valid || saveMutation.isLoading}
            >
              {editingId ? "Save changes" : "Save recipe"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
