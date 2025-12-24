import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Calculator, FileText, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ---- Types ----
type UnitType = "g" | "kg" | "ml" | "litre" | "cup" | "tbsp" | "tsp" | "pcs" | "oz" | "lb" | "each";

type Ingredient = {
  id: string;
  name: string;
  unit: UnitType;
  packageSize: number;
  packageCostTHB: number;
  supplier?: string;
};

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;
  unit: UnitType;
  unitCostTHB: number;
  costTHB: number;
  supplier?: string;
};

type Recipe = {
  id: number;
  name: string;
  description?: string;
  category: string;
  totalCost: number;
  costPerServing: number;
  cogsPercent: number;
  suggestedPrice: number;
  ingredients: RecipeLine[];
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  wasteFactor: number;
  yieldEfficiency: number;
};

const THB = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);
const num = (v: any) => isFinite(+v) ? +v : 0;

// Unit conversion factors
const UNIT_CONVERSIONS: Record<UnitType, { toBase: number; baseUnit: string }> = {
  "g": { toBase: 1, baseUnit: "g" },
  "kg": { toBase: 1000, baseUnit: "g" },
  "oz": { toBase: 28.35, baseUnit: "g" },
  "lb": { toBase: 453.6, baseUnit: "g" },
  "ml": { toBase: 1, baseUnit: "ml" },
  "litre": { toBase: 1000, baseUnit: "ml" },
  "cup": { toBase: 240, baseUnit: "ml" },
  "tbsp": { toBase: 15, baseUnit: "ml" },
  "tsp": { toBase: 5, baseUnit: "ml" },
  "pcs": { toBase: 1, baseUnit: "pcs" },
  "each": { toBase: 1, baseUnit: "each" }
};

const UNIT_OPTIONS: UnitType[] = ["g", "kg", "ml", "litre", "cup", "tbsp", "tsp", "pcs", "oz", "lb", "each"];

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return "g";
  const u = unit.toLowerCase().trim();
  
  // Normalize common variations
  if (u.includes("kg") || u === "kg") return "kg";
  if (u.includes("gram") || u === "g") return "g"; 
  if (u.includes("ml") || u === "ml") return "ml";
  if (u.includes("litre") || u.includes("liter") || u === "l") return "litre";
  if (u.includes("piece") || u.includes("pcs") || u === "pc") return "pcs";
  if (u.includes("each") || u === "each") return "each";
  if (u.includes("cup")) return "cup";
  if (u.includes("tbsp") || u.includes("tablespoon")) return "tbsp";
  if (u.includes("tsp") || u.includes("teaspoon")) return "tsp";
  if (u.includes("oz") || u.includes("ounce")) return "oz";
  if (u.includes("lb") || u.includes("pound")) return "lb";
  
  // Default fallback for unknown units
  return "g";
}

// Enhanced parsePackage - Handles all packaging types per Cam's specifications
function parsePackage(packageSize: string | number | null | undefined): number {
  if (!packageSize) return 1;
  
  // Clean the input - remove common words that don't affect calculation
  let size = String(packageSize).toLowerCase()
    .replace(' bag', '')
    .replace(' per ', '')
    .replace(' pack', '')
    .trim();
  
  // Extract numeric value (handles decimals like 2.5)
  const numMatch = size.match(/(\d+(?:\.\d+)?)/);
  const baseNum = numMatch ? parseFloat(numMatch[1]) : 1;
  
  // Handle kg conversions - convert to grams (e.g., "10kg" → 10000g, "Per kg" → 1000g)
  if (size.includes('kg')) {
    return baseNum * 1000 || 1000;
  }
  
  // Handle litre conversions - convert to ml (e.g., "2 litre" → 2000ml)  
  if (size.includes('litre') || size.includes('liter') || size.includes(' l')) {
    return baseNum * 1000 || 1000;
  }
  
  // Handle countable items (e.g., "6 Cans" → 6, "12 boxes" → 12)
  if (size.includes('can') || size.includes('box') || size.includes('piece') || size.includes('each')) {
    return baseNum || 1;
  }
  
  // Default: return extracted number or 1 for "each"
  return baseNum || 1;
}

function convertUnits(fromQty: number, fromUnit: UnitType, toUnit: UnitType): number {
  const fromConv = UNIT_CONVERSIONS[fromUnit];
  const toConv = UNIT_CONVERSIONS[toUnit];
  
  // Safety check: if conversion data is missing, return original quantity
  if (!fromConv || !toConv || fromConv.baseUnit !== toConv.baseUnit) {
    return fromQty;
  }
  
  const baseQty = fromQty * fromConv.toBase;
  return baseQty / toConv.toBase;
}

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
  const [wastePct, setWastePct] = useState(5); // Default 5% waste factor per specifications
  const [portions, setPortions] = useState(1);
  const [menuPrice, setMenuPrice] = useState(0);
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
    queryKey: ['foodCostings-ingredients'],
    queryFn: async () => {
      const response = await fetch('/api/costing/ingredients');
      const data = await response.json();
      // ✅ Using TypeScript foodCostings.ts data with correct cost calculations
      return (data.list || []).map((x: any) => ({
        id: x.id, // Already clean ID from API
        name: x.name, // Direct from foodCostings.ts
        unit: normalizeUnit(x.unit) as UnitType,
        packageSize: x.packageSize || 1, // FIXED: Use correct packageSize field ("Per kg")
        packageCostTHB: num(x.cost), // Direct cost from foodCostings.ts
        supplier: x.supplier || "",
        category: x.category || "Other",
        brand: x.brand || "",
        portionSize: x.portionSize || null,
        lastReview: x.lastReview || null
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
      
      // COGS Alert as specified
      if (data.cogsAlert) {
        toast({ 
          title: "Recipe Saved", 
          description: "⚠️ COGS high (>35%) - consider optimizing ingredients", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Success", 
          description: `Recipe "${data.recipe?.name}" saved successfully` 
        });
      }
      
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
    const yieldEff = Math.max(0.01, (100 - Math.max(0, Math.min(100, wastePct))) / 100);
    const waste = Math.max(0, Math.min(100, wastePct)) / 100;
    
    return lines.map(l => {
      const ingredient = ingredients.find(ing => ing.id === l.ingredientId);
      if (!ingredient) return { ...l, costTHB: 0 };
      
      const packageNum = parsePackage(ingredient.packageSize);
      const unitPrice = ingredient.packageCostTHB;
      let portion = num(l.qty);
      
      // Unit conversion: Convert user input to base units (grams)
      if (l.unit === 'kg') {
        portion = portion * 1000; // Convert kg to grams
        console.log(`Unit conversion: ${l.qty}kg → ${portion}g`);
      } else if (l.unit === 'litre') {
        portion = portion * 1000; // Convert litres to ml
        console.log(`Unit conversion: ${l.qty}L → ${portion}ml`);
      }
      
      // Enhanced calculation with error handling and debugging
      const cost = (portion / packageNum * unitPrice) * (1 + waste) / yieldEff;
      
      // Debug logging for verification
      console.log(`Parsed package for ${ingredient.name}: ${packageNum} (from "${ingredient.packageSize}")`);
      console.log(`Cost calculation: (${portion} / ${packageNum} * ${unitPrice}) * (1 + ${waste}) / ${yieldEff} = ${cost.toFixed(3)}`);
      
      // Handle NaN cases
      if (isNaN(cost)) {
        console.log(`Missing packageSize for ${ingredient.name}`);
        return { ...l, costTHB: 0 };
      }
      
      return { ...l, costTHB: cost };
    });
  }, [lines, wastePct, ingredients]);

  const recipeCostTHB = useMemo(() => linesWithCosts.reduce((a, l) => a + l.costTHB, 0), [linesWithCosts]);
  const costPerPortionTHB = useMemo(() => recipeCostTHB / Math.max(1, portions), [recipeCostTHB, portions]);
  const foodCostPct = useMemo(() => menuPrice > 0 ? (costPerPortionTHB / menuPrice) * 100 : 0, [costPerPortionTHB, menuPrice]);
  const gpTHB = useMemo(() => menuPrice - costPerPortionTHB, [menuPrice, costPerPortionTHB]);
  const marginPct = useMemo(() => menuPrice > 0 ? (gpTHB / menuPrice) * 100 : 0, [gpTHB, menuPrice]);

  // ---- Actions ----
  function addIngredient(ing: Ingredient) {
    // Updated to use proper package parsing for cost calculation
    const packageNum = parsePackage(ing.packageSize);
    const unitCost = ing.packageCostTHB / packageNum;
    
    setLines(prev => [...prev, {
      ingredientId: ing.id,
      name: ing.name,
      qty: 0,
      unit: ing.unit,
      unitCostTHB: unitCost,
      costTHB: 0,
      supplier: ing.supplier
    }]);
    setSearch("");
  }

  function updateQty(idx: number, q: number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, qty: q } : l));
  }

  function updateUnit(idx: number, newUnit: UnitType) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const ingredient = ingredients.find(ing => ing.id === l.ingredientId);
      if (!ingredient) return { ...l, unit: newUnit };
      const baseCostPerUnit = ingredient.packageCostTHB / Math.max(1, ingredient.packageSize);
      const convertedCostPerUnit = baseCostPerUnit * convertUnits(1, ingredient.unit, newUnit);
      return { 
        ...l, 
        unit: newUnit,
        unitCostTHB: convertedCostPerUnit
      };
    }));
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function resetCalculator() {
    setLines([]);
    setRecipeName("");
    setRecipeDesc("");
    setMenuPrice(0);
    setWastePct(0);
    setPortions(1);
    setRecipeCategory("Burgers");
  }

  function loadRecipeToCalculator(recipe: Recipe) {
    setRecipeName(recipe.name);
    setRecipeDesc(recipe.description || "");
    setRecipeCategory(recipe.category);
    setLines(recipe.ingredients || []);
    setMenuPrice(recipe.suggestedPrice || 0);
    setWastePct((recipe.wasteFactor || 0.05) * 100);
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
        foodCostPct: foodCostPct || 0,
        gpTHB: gpTHB || 0,
        marginPct: marginPct || 0
      },
      note: "",
      wastePct: wastePct || 0,
      portions: portions || 1,
      menuPrice: menuPrice || 0,
      // Additional defaults per specifications
      yieldQuantity: portions || 1,
      margin: marginPct || 30,
      ingredients: linesWithCosts || [],
      wasteFactor: (wastePct || 0) / 100,
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
        targetPrice: menuPrice
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
      {/* READ-ONLY BANNER */}
      <Alert className="mb-6 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">POS Items (Read-Only) – Not Recipe Management</AlertTitle>
        <AlertDescription className="text-amber-700">
          This page shows POS item data for reference only. For recipe editing, go to{" "}
          <Link href="/recipe-management" className="text-blue-600 underline font-medium">
            Recipe Management
          </Link>
        </AlertDescription>
      </Alert>

      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">POS Items Reference</h1>
        <div className="flex gap-3 items-center">
          <Badge variant="outline" className="text-amber-600 border-amber-300">Read-Only</Badge>
        </div>
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
                    <Badge variant={recipe.cogsPercent <= 32 ? "default" : recipe.cogsPercent <= 38 ? "secondary" : "destructive"}>
                      {recipe.cogsPercent?.toFixed(1) || 0}% COGS
                    </Badge>
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
                      <div className="text-slate-600">Suggested Price</div>
                      <div className="font-semibold">{THB(recipe.suggestedPrice || 0)}</div>
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
                  <div>
                    <div className="text-xs text-slate-600">Waste %</div>
                    <Input 
                      type="number" 
                      min={0} 
                      max={100} 
                      value={wastePct} 
                      onChange={(e) => setWastePct(num(e.target.value))} 
                      className="mt-2 text-xs rounded-[4px] border-slate-200" 
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-slate-600">Menu Price (THB)</div>
                  <Input 
                    type="number" 
                    min={0} 
                    value={menuPrice} 
                    onChange={(e) => setMenuPrice(num(e.target.value))} 
                    className="mt-2 text-xs rounded-[4px] border-slate-200" 
                  />
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
                          Unit cost: {THB(ing.packageCostTHB / Math.max(1, ing.packageSize))} / {ing.unit}
                        </div>
                        {ing.supplier && <div className="text-xs text-gray-400">Supplier: {ing.supplier}</div>}
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
                      <th className="p-2 text-left text-xs text-gray-600">Supplier</th>
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
                        <td className="p-2">
                          <Select value={l.unit} onValueChange={(value: UnitType) => updateUnit(idx, value)}>
                            <SelectTrigger className="w-20 text-xs rounded-[4px] border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNIT_OPTIONS.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right tabular-nums">{THB(l.unitCostTHB)}</td>
                        <td className="p-2 text-right tabular-nums">{THB(l.costTHB)}</td>
                        <td className="p-2">{l.supplier || "-"}</td>
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
                        <td className="p-4 text-sm text-gray-600" colSpan={7}>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
              <div className="p-6">
                <div className="text-xs text-gray-600">Recipe Cost</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(recipeCostTHB)}</div>
                <div className="mt-3 text-xs text-gray-600">Cost per Portion</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(costPerPortionTHB)}</div>
              </div>
            </div>
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
              <div className="p-6">
                <div className="text-xs text-gray-600">Menu Price</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(menuPrice)}</div>
                <div className="mt-3 text-xs text-gray-600">Food Cost %</div>
                <div className={`inline-block mt-1 px-3 py-1 rounded-[4px] text-xs font-semibold ${
                  foodCostPct <= 32 ? "bg-green-100 text-green-800" : 
                  foodCostPct <= 38 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {foodCostPct.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
              <div className="p-6">
                <div className="text-xs text-gray-600">Gross Profit (per portion)</div>
                <div className="text-2xl font-semibold tabular-nums">{THB(gpTHB)}</div>
                <div className="mt-3 text-xs text-gray-600">Margin %</div>
                <div className="text-xl font-semibold tabular-nums">{marginPct.toFixed(1)}%</div>
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

          {/* Chef Ramsay Integration - DISABLED */}
          {/* {recipeName && linesWithCosts.length > 0 && (
            <ChefRamsayGordon 
              mode={chefMode}
              context={{
                recipeName,
                ingredientCount: linesWithCosts.length,
                foodCostPct,
                marginPct,
                costPerPortionTHB,
                menuPrice
              }}
            />
          )} */}
        </div>
      )}
    </div>
  );
}