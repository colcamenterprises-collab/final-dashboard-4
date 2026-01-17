import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChefHat, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// ---- Types ----
type UnitType = "g" | "ml" | "each";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: UnitType;
  unitCostPerBase: number;
};

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;
  unit: UnitType;
  unitCostTHB: number;
  costTHB: number;
};

type Recipe = {
  id: number;
  name: string;
  description?: string;
  category: string;
  totalCost: number;
  costPerServing: number;
  ingredients: RecipeLine[];
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  wasteFactor: number;
  yieldEfficiency: number;
};

const THB = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);
const num = (v: any) => isFinite(+v) ? +v : 0;

export default function RecipesUnified() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ---- State ----
  const [view, setView] = useState<"cards" | "calculator">("cards");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Calculator state
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [portions, setPortions] = useState(1);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDesc, setRecipeDesc] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("Burgers");
  const [chefMode, setChefMode] = useState<"helpful" | "ramsay">("ramsay");

  // ---- Data Queries ----
  const { data: recipes = [], isLoading, refetch } = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const response = await fetch('/api/recipes');
      return response.json();
    }
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['canonical-ingredients'],
    queryFn: async () => {
      const response = await fetch('/api/ingredients/canonical');
      const data = await response.json();
      return (data.items || []).map((x: any) => ({
        id: String(x.id),
        name: x.name,
        baseUnit: x.baseUnit as UnitType,
        unitCostPerBase: num(x.unitCostPerBase),
      }));
    }
  });

  // ---- Mutations ----
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete recipe');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Recipe deleted successfully" });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete recipe", variant: "destructive" });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (recipeData: any) => {
      console.log('[Frontend] Sending save request:', recipeData);
      
      const response = await fetch('/api/recipes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData)
      });
      
      const result = await response.json();
      console.log('[Frontend] Save response:', result);
      
      if (!response.ok) {
        const errorMessage = result.details || result.error || 'Failed to save recipe';
        throw new Error(errorMessage);
      }
      
      return result;
    },
    onSuccess: (data: any) => {
      console.log('[Frontend] ✅ Recipe saved successfully:', data);
      
      toast({ 
        title: "Success", 
        description: `Recipe "${data.recipe?.name}" saved successfully` 
      });
      
      refetch();
      resetCalculator();
    },
    onError: (error: any) => {
      console.error('[Frontend] ❌ Save Error:', error);
      
      const errorMessage = error.message || 'Failed to save recipe';
      
      toast({ 
        title: "Recipe Save Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  // ---- Calculator Logic ---- Fixed per Cam's specifications
  const linesWithCosts = useMemo(() => {
    return lines.map(l => {
      const ingredient = ingredients.find(ing => ing.id === l.ingredientId);
      if (!ingredient) return { ...l, costTHB: 0 };

      const portionQty = num(l.qty);
      const unitCost = num(ingredient.unitCostPerBase);
      const cost = portionQty * unitCost;

      return { ...l, costTHB: cost, unitCostTHB: unitCost, unit: ingredient.baseUnit };
    });
  }, [lines, ingredients]);

  const recipeCostTHB = useMemo(() => linesWithCosts.reduce((a, l) => a + l.costTHB, 0), [linesWithCosts]);
  const costPerPortionTHB = useMemo(() => recipeCostTHB / Math.max(1, portions), [recipeCostTHB, portions]);
  // ---- Actions ----
  function addIngredient(ing: Ingredient) {
    setLines(prev => [...prev, {
      ingredientId: ing.id,
      name: ing.name,
      qty: 0,
      unit: ing.baseUnit,
      unitCostTHB: ing.unitCostPerBase,
      costTHB: 0,
    }]);
    setSearch("");
  }

  function updateQty(idx: number, q: number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, qty: q } : l));
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function resetCalculator() {
    setLines([]);
    setRecipeName("");
    setRecipeDesc("");
    setPortions(1);
    setRecipeCategory("Burgers");
  }

  function loadRecipeToCalculator(recipe: Recipe) {
    setRecipeName(recipe.name);
    setRecipeDesc(recipe.description || "");
    setRecipeCategory(recipe.category);
    setLines(recipe.ingredients || []);
    setPortions(1);
    setView("calculator");
    setIsEditing(true);
    setSelectedRecipe(recipe);
  }

  async function saveRecipe() {
    if (!recipeName.trim()) {
      toast({ title: "Error", description: "Recipe name is required", variant: "destructive" });
      return;
    }

    // Enhanced recipe data with all required fields and defaults per specifications
    const recipeData = {
      recipeName: recipeName.trim(),
      description: recipeDesc || '',
      category: recipeCategory || 'Burgers',
      lines: linesWithCosts || [],
      totals: {
        recipeCostTHB: recipeCostTHB || 0,
        costPerPortionTHB: costPerPortionTHB || 0,
      },
      note: "",
      portions: portions || 1,
      // Additional defaults per specifications
      yieldQuantity: portions || 1,
      ingredients: linesWithCosts || [],
      yieldEfficiency: 0.90,
      allergens: [],
      nutritional: {}
    };

    console.log('[Frontend] Submitting recipe data:', recipeData);
    saveMutation.mutate(recipeData);
  }

  async function generateDescription() {
    if (!recipeName || linesWithCosts.length === 0) {
      toast({ title: "Error", description: "Add recipe name and ingredients first", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        recipe: {
          name: recipeName,
          ingredients: linesWithCosts.map(l => ({ name: l.name, qty: l.qty, unit: l.unit })),
          totalCost: recipeCostTHB
        },
        targetPrice: 0
      };
      
      const response = await fetch("/api/recipes/ramsay", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      
      const data = await response.json();
      setRecipeDesc(data.analysis || "");
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate description", variant: "destructive" });
    }
  }

  // ---- Filters ----
  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recipes</h1>
      </div>

      {view === "cards" ? (
        // ---- RECIPE CARDS VIEW ----
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-xs font-medium text-slate-600">
              {recipes.length} Recipe{recipes.length !== 1 ? 's' : ''} Available
            </div>
            <Button onClick={() => { resetCalculator(); setView("calculator"); }} className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]">
              <Plus className="h-4 w-4 mr-2" />
              Create Recipe
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe: Recipe) => (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow border-slate-200" style={{ borderRadius: '4px' }}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-semibold">{recipe.name}</CardTitle>
                  </div>
                  {recipe.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{recipe.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {recipe.imageUrl && (
                    <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-32 object-cover rounded-[4px]" />
                  )}
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-600">Total Cost</div>
                      <div className="font-semibold">{THB(recipe.totalCost || 0)}</div>
                    </div>
                    <div>
                      <div className="text-slate-600">Cost/Serving</div>
                      <div className="font-semibold">{THB(recipe.costPerServing || 0)}</div>
                    </div>
                    <div>
                      <div className="text-slate-600">Ingredients</div>
                      <div className="font-semibold">{recipe.ingredients?.length || 0} items</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => loadRecipeToCalculator(recipe)}
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs rounded-[4px] border-slate-200"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      onClick={() => deleteMutation.mutate(recipe.id)}
                      variant="outline" 
                      size="sm"
                      className="text-red-600 hover:text-red-700 text-xs rounded-[4px] border-slate-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      asChild
                      variant="outline" 
                      size="sm"
                      className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs rounded-[4px]"
                      title="Generate professional A4 recipe card with QR code"
                      data-testid={`button-generate-card-${recipe.id}`}
                    >
                      <Link href="/menu/recipe-cards">
                        <FileText className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {recipes.length === 0 && (
            <div className="text-center py-12">
              <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-slate-600 mb-2">No Recipes Yet</h3>
              <p className="text-xs text-slate-500 mb-4">Start creating your first recipe with our cost calculator</p>
              <Button onClick={() => setView("calculator")} className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]">
                <Plus className="h-4 w-4 mr-2" />
                Create First Recipe
              </Button>
            </div>
          )}
        </div>
      ) : (
        // ---- COST CALCULATOR VIEW ----
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-700">
              {isEditing ? `Editing: ${selectedRecipe?.name}` : "Create New Recipe"}
            </div>
            <div className="flex gap-3 items-center">
              <label className="text-sm text-gray-600">AI Mode</label>
              <Select value={chefMode} onValueChange={(value: "helpful" | "ramsay") => setChefMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helpful">Helpful</SelectItem>
                  <SelectItem value="ramsay">Ramsay Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipe Header */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
              <div className="p-6">
                <div className="text-xs text-slate-600">Recipe Details</div>
                <Input 
                  value={recipeName} 
                  onChange={(e) => setRecipeName(e.target.value)} 
                  placeholder="Recipe name" 
                  className="mt-2 text-xs rounded-[4px] border-slate-200" 
                />
                <Select value={recipeCategory} onValueChange={setRecipeCategory}>
                  <SelectTrigger className="mt-3 text-xs rounded-[4px] border-slate-200">
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
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-600">Portions</div>
                    <Input 
                      type="number" 
                      min={1} 
                      value={portions} 
                      onChange={(e) => setPortions(num(e.target.value))} 
                      className="mt-2 text-xs rounded-[4px] border-slate-200" 
                    />
                  </div>
                  <div />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200 lg:col-span-2">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <Input 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    placeholder="Search ingredients…" 
                    className="flex-1 text-xs rounded-[4px] border-slate-200" 
                  />
                </div>
                {search && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map(ing => (
                      <button 
                        key={ing.id} 
                        onClick={() => addIngredient(ing)} 
                        className="border border-slate-200 rounded-[4px] px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="font-medium">{ing.name}</div>
                        <div className="text-xs text-gray-500">
                          Unit cost: {THB(ing.unitCostPerBase)} / {ing.baseUnit}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
            <div className="p-6">
              <h3 className="text-sm font-medium">Ingredients</h3>
              <div className="mt-3 overflow-auto">
                <table className="min-w-[820px] w-full">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-xs text-gray-600">Ingredient</th>
                      <th className="p-2 text-right text-xs text-gray-600">Qty</th>
                      <th className="p-2 text-left text-xs text-gray-600">Unit</th>
                      <th className="p-2 text-right text-xs text-gray-600">Unit Cost</th>
                      <th className="p-2 text-right text-xs text-gray-600">Cost</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linesWithCosts.map((l, idx) => (
                      <tr key={idx} className={idx % 2 ? "bg-gray-50/50" : ""}>
                        <td className="p-2">{l.name}</td>
                        <td className="p-2 text-right">
                          <Input 
                            type="number" 
                            min={0} 
                            value={l.qty} 
                            onChange={(e) => updateQty(idx, num(e.target.value))} 
                            className="w-28 text-right text-xs rounded-[4px] border-slate-200" 
                          />
                        </td>
                        <td className="p-2 text-xs text-slate-600">{l.unit}</td>
                        <td className="p-2 text-right tabular-nums">{THB(l.unitCostTHB)}</td>
                        <td className="p-2 text-right tabular-nums">{THB(l.costTHB)}</td>
                        <td className="p-2 text-right">
                          <Button 
                            onClick={() => removeLine(idx)} 
                            variant="ghost" 
                            size="sm"
                            className="text-rose-600 hover:text-rose-800 text-xs"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!linesWithCosts.length && (
                      <tr>
                        <td className="p-4 text-sm text-gray-600" colSpan={6}>
                          Add ingredients to start costing.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
              <div className="p-6">
                <div className="text-xs text-gray-600">Recipe Cost</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(recipeCostTHB)}</div>
                <div className="mt-3 text-xs text-gray-600">Cost per Portion</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(costPerPortionTHB)}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-900">Recipe Description</h3>
                <Button onClick={generateDescription} className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]">
                  {chefMode === "ramsay" ? "Ask Chef Ramsay" : "Generate Description"}
                </Button>
              </div>
              <textarea 
                value={recipeDesc} 
                onChange={(e) => setRecipeDesc(e.target.value)} 
                placeholder="Recipe description for Grab, ingredients, preparation notes..." 
                className="mt-4 w-full border border-slate-200 rounded-[4px] px-3 py-2 h-24 resize-none text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <Button 
                onClick={() => setView("cards")} 
                variant="outline"
                className="text-xs rounded-[4px] border-slate-200"
              >
                Back to Recipes
              </Button>
              {isEditing && (
                <Button 
                  onClick={() => {
                    resetCalculator();
                    setIsEditing(false);
                    setSelectedRecipe(null);
                  }} 
                  variant="outline"
                  className="text-xs rounded-[4px] border-slate-200"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
            <Button 
              onClick={saveRecipe} 
              disabled={!recipeName.trim() || linesWithCosts.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
            >
              {isEditing ? "Update Recipe" : "Save Recipe"}
            </Button>
          </div>

        </div>
      )}
    </div>
  );
}
