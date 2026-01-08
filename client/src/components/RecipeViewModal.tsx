/**
 * RecipeViewModal - Read-only view of recipe details
 * Shows recipe name, ingredients, portions, and calculated costs
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
  totalCost: number;
};

interface RecipeViewModalProps {
  recipe: RecipeData | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function RecipeViewModal({ recipe, isOpen, onClose, onEdit }: RecipeViewModalProps) {
  if (!recipe) return null;

  const totalCost = recipe.ingredients.reduce((sum, ing) => {
    const qty = parseFloat(ing.portionQty || ing.quantity || "0");
    const unitCost = ing.unitCostPerBase || ing.ingredientCost || 0;
    return sum + (unitCost * qty);
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">{recipe.name}</DialogTitle>
            <Badge 
              variant={recipe.active ? "default" : "secondary"} 
              className={`text-[10px] rounded-[4px] ${recipe.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
            >
              {recipe.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">SKU: RECIPE-{recipe.id}</span>
            {recipe.yieldUnits && (
              <span className="text-slate-500">Serves: {recipe.yieldUnits}</span>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-slate-900">Ingredients ({recipe.ingredients.length})</h3>
              <span className="text-sm font-semibold text-emerald-600">Total: ฿{totalCost.toFixed(2)}</span>
            </div>

            {recipe.ingredients.length > 0 ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-2 px-2 font-medium text-slate-600">Ingredient</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600">Portion</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600">Unit</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ing) => {
                    const qty = parseFloat(ing.portionQty || ing.quantity || "0");
                    const unitCost = ing.unitCostPerBase || ing.ingredientCost || 0;
                    const lineCost = unitCost * qty;
                    return (
                      <tr key={ing.id} className="border-b border-slate-100">
                        <td className="py-2 px-2 text-slate-900">{ing.ingredientName || 'Unknown'}</td>
                        <td className="py-2 px-2 text-right text-slate-700">{qty}</td>
                        <td className="py-2 px-2 text-slate-500">{ing.baseUnit || ing.unit || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-600">฿{lineCost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No ingredients added yet
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="text-xs rounded-[4px]" data-testid="button-close-view">
            Close
          </Button>
          {onEdit && (
            <Button onClick={onEdit} className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700" data-testid="button-edit-from-view">
              Edit Recipe
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
