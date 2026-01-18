/**
 * RecipeViewModal - Read-only view of recipe details
 * Shows recipe name, ingredients, portions, and calculated costs
 * Tablet and mobile responsive
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RecipeIngredient = {
  id: number;
  recipeId: number;
  ingredientId?: number;
  purchasingItemId?: number;
  quantity?: string;
  portionQty?: string;
  unit?: string;
  ingredientName?: string;
  ingredientCost?: number;
  lineCost?: number;
  baseUnit?: string;
  unitCostPerBase?: number;
};

type RecipeData = {
  id: number;
  name: string;
  category?: string;
  yieldUnits?: string | null;
  active: boolean;
  ingredients: RecipeIngredient[];
  totalCost: number | null;
};

interface RecipeViewModalProps {
  recipe: RecipeData | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onCreateProduct?: () => void;
}

export function RecipeViewModal({ recipe, isOpen, onClose, onEdit, onCreateProduct }: RecipeViewModalProps) {
  if (!recipe) return null;

  const allowedUnits = new Set(["g", "ml", "each", "grams"]);

  const parsePositiveNumber = (value: string | undefined) => {
    if (!value || !value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const formatUnitLabel = (unit?: string) => {
    if (!unit) return "UNMAPPED";
    return unit === "grams" ? "g" : unit;
  };

  const serves = parsePositiveNumber(recipe.yieldUnits || "");
  const hasIngredientErrors = recipe.ingredients.some((ing) => {
    const qty = parsePositiveNumber(ing.portionQty || ing.quantity || "");
    const unit = ing.baseUnit || ing.unit || "";
    return !qty || !allowedUnits.has(unit);
  });
  const canCreateProduct = Boolean(serves) && recipe.ingredients.length > 0 && !hasIngredientErrors;
  const totalCost = recipe.totalCost ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <DialogTitle className="text-sm font-semibold pr-2">{recipe.name}</DialogTitle>
            <Badge 
              variant={recipe.active ? "default" : "secondary"} 
              className={`text-[10px] rounded-[4px] w-fit ${recipe.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
            >
              {recipe.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs">
            <span className="text-slate-500">SKU: RECIPE-{recipe.id}</span>
            {recipe.yieldUnits && (
              <span className="text-slate-500">Serves: {recipe.yieldUnits}</span>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-slate-900">Ingredients ({recipe.ingredients.length})</h3>
              <span className="text-sm font-semibold text-emerald-600">
                Total: {totalCost !== null ? `฿${totalCost.toFixed(2)}` : "Unavailable"}
              </span>
            </div>

            {recipe.ingredients.length > 0 ? (
              <>
                {/* Desktop/Tablet table view */}
                <div className="hidden sm:block">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-2 font-medium text-slate-600">Ingredient</th>
                        <th className="text-right py-2 px-2 font-medium text-slate-600">Quantity per portion</th>
                        <th className="text-left py-2 px-2 font-medium text-slate-600">Unit</th>
                        <th className="text-right py-2 px-2 font-medium text-slate-600">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.ingredients.map((ing) => {
                        const qty = parsePositiveNumber(ing.portionQty || ing.quantity || "") ?? 0;
                        const unitCost = ing.unitCostPerBase || ing.ingredientCost || 0;
                        const lineCost = unitCost * qty;
                        return (
                          <tr key={ing.id} className="border-b border-slate-100">
                            <td className="py-2 px-2 text-slate-900">{ing.ingredientName || 'Unknown'}</td>
                            <td className="py-2 px-2 text-right text-slate-700">{qty}</td>
                            <td className="py-2 px-2 text-slate-500">{formatUnitLabel(ing.baseUnit || ing.unit)}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">฿{lineCost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {recipe.ingredients.map((ing) => {
                    const qty = parsePositiveNumber(ing.portionQty || ing.quantity || "") ?? 0;
                    const unitCost = ing.unitCostPerBase || ing.ingredientCost || 0;
                    const lineCost = unitCost * qty;
                    return (
                      <div key={ing.id} className="bg-slate-50 rounded-[4px] p-3 border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium text-slate-900">{ing.ingredientName || 'Unknown'}</span>
                          <span className="text-xs font-mono text-emerald-600">฿{lineCost.toFixed(2)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {qty} {formatUnitLabel(ing.baseUnit || ing.unit)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No ingredients added yet
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="text-xs rounded-[4px] h-9 min-h-[36px]" 
            data-testid="button-close-view"
          >
            Close
          </Button>
          {onCreateProduct && (
            <Button
              onClick={onCreateProduct}
              disabled={!canCreateProduct}
              className="text-xs rounded-[4px] bg-slate-900 hover:bg-slate-800 h-9 min-h-[36px]"
              title={!canCreateProduct ? "Recipe must be valid before creating a product" : undefined}
              data-testid="button-create-product"
            >
              Create Product
            </Button>
          )}
          {onEdit && (
            <Button 
              onClick={onEdit} 
              className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700 h-9 min-h-[36px]" 
              data-testid="button-edit-from-view"
            >
              Edit Recipe
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
