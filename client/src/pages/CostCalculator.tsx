import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function CostCalculator() {
  const [recipeName, setRecipeName] = useState("");
  const [recipeYield, setRecipeYield] = useState(1);
  const [targetMargin, setTargetMargin] = useState(0.3);
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredientId: string; qty: number }[]>([]);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  
  const { toast } = useToast();

  const { data: ingredientsData } = useQuery({
    queryKey: ["/api/costing/ingredients"],
  });

  const ingredients = ingredientsData?.list || [];

  const addIngredient = () => {
    setSelectedIngredients([...selectedIngredients, { ingredientId: "", qty: 0 }]);
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...selectedIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index));
  };

  const handleBlockedAction = () => {
    toast({ 
      title: "Action Blocked", 
      description: "Recipe editing has moved to Recipe Management. This page is deprecated.", 
      variant: "destructive" 
    });
  };

  return (
    <div className="p-4 space-y-6">
      <Alert className="border-amber-500 bg-amber-50" data-testid="deprecation-banner">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 font-medium">Read-Only View</AlertTitle>
        <AlertDescription className="text-amber-700">
          Recipe editing has moved to{" "}
          <Link href="/recipe-management" className="underline font-medium hover:text-amber-900">
            Recipe Management
          </Link>.
          This page is deprecated and will be removed.
        </AlertDescription>
      </Alert>

      <h1 className="text-3xl font-bold">Cost Calculator (Legacy)</h1>

      {/* Recipe Form */}
      <div className="rounded-[4px] border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium mb-4">Recipe Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs text-slate-600 mb-2">Recipe Name</label>
              <input
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-[4px] text-xs"
                placeholder="Enter recipe name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-2">Yield (servings)</label>
              <input
                type="number"
                value={recipeYield}
                onChange={(e) => setRecipeYield(Number(e.target.value))}
                min="1"
                className="w-full p-3 border border-slate-200 rounded-[4px] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-2">Target Margin (%)</label>
              <input
                type="number"
                value={targetMargin * 100}
                onChange={(e) => setTargetMargin(Number(e.target.value) / 100)}
                min="0"
                max="100"
                step="1"
                className="w-full p-3 border border-slate-200 rounded-[4px] text-xs"
              />
            </div>
          </div>

          {/* Ingredients */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">Ingredients</h3>
              <button
                onClick={addIngredient}
                className="px-4 py-2 bg-emerald-600 text-white rounded-[4px] hover:bg-emerald-700 text-xs"
              >
                Add Ingredient
              </button>
            </div>

            <div className="space-y-3">
              {selectedIngredients.map((ingredient, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <select
                    value={ingredient.ingredientId}
                    onChange={(e) => updateIngredient(index, "ingredientId", e.target.value)}
                    className="flex-1 p-3 border border-slate-200 rounded-[4px] text-xs"
                  >
                    <option value="">Select ingredient...</option>
                    {ingredients.map((ing: any) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ingredient.qty}
                    onChange={(e) => updateIngredient(index, "qty", Number(e.target.value))}
                    placeholder="Quantity"
                    min="0"
                    step="0.1"
                    className="w-32 p-3 border border-slate-200 rounded-[4px] text-xs"
                  />
                  <button
                    onClick={() => removeIngredient(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded-[4px] hover:bg-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions - BLOCKED (deprecated page) */}
          <div className="flex gap-3">
            <button
              onClick={handleBlockedAction}
              disabled
              className="px-6 py-3 bg-slate-400 text-white rounded-[4px] cursor-not-allowed text-xs"
            >
              Save Recipe (Disabled)
            </button>
            <button
              onClick={handleBlockedAction}
              disabled
              className="px-6 py-3 bg-slate-400 text-white rounded-[4px] cursor-not-allowed text-xs"
            >
              Calculate Cost (Disabled)
            </button>
          </div>
      </div>

      {/* Calculation Results */}
      {calculationResult && (
        <div className="rounded-[4px] border border-slate-200 bg-white p-4">
            <h2 className="h2 mb-4">Cost Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-[4px]">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-xl font-bold">฿{calculationResult.totalCost.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-[4px]">
                <div className="text-sm text-gray-600">Cost Per Serve</div>
                <div className="text-xl font-bold">฿{calculationResult.costPerServe.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-[4px]">
                <div className="text-sm text-gray-600">Target Margin</div>
                <div className="text-xl font-bold">{(calculationResult.targetMargin * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-[4px]">
                <div className="text-sm text-emerald-600">Suggested Price</div>
                <div className="text-xl font-bold text-emerald-600">฿{calculationResult.suggestedPrice.toFixed(2)}</div>
              </div>
            </div>

            {/* Ingredient Breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ingredient</th>
                    <th className="text-left py-2">Quantity</th>
                    <th className="text-left py-2">Unit Cost</th>
                    <th className="text-left py-2">Line Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {calculationResult.lines.map((line: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{line.ingredient}</td>
                      <td className="py-2">{line.qty} {line.unit}</td>
                      <td className="py-2">฿{Number(line.unitCost).toFixed(2)}</td>
                      <td className="py-2">฿{line.lineCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}
    </div>
  );
}