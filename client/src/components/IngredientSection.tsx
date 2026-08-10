import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { type Ingredient } from "../hooks/useIngredients";

interface IngredientSectionProps {
  category: string;
  ingredients: Ingredient[];
  formValues: Record<string, number>;
  onFieldChange: (fieldName: string, value: number) => void;
}

export function IngredientSection({ category, ingredients, formValues, onFieldChange }: IngredientSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'fresh food': return 'Fresh';
      case 'frozen food': return 'Frozen';
      case 'drinks':
      case 'beverages': return 'Drinks';
      case 'meat': return 'Meat';
      case 'condiments': return 'Condiments';
      case 'packaging': return 'Packaging';
      case 'supplies':
      case 'kitchen supplies': return 'Supplies';
      case 'shelf stock':
      case 'shelf items': return 'Shelf';
      default: return 'Items';
    }
  };

  return (
    <Card className="mb-4">
      <div>
        <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setIsOpen(!isOpen)}>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span>{getCategoryIcon(category)} - {category}</span>
              <Badge variant="secondary" className="ml-2">{ingredients.length} items</Badge>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {isOpen && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ingredients.map((ingredient) => {
                const fieldName = ingredient.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
                const currentValue = formValues[fieldName] || 0;
                const displayUnit = ingredient.portionUnit || ingredient.purchaseUnit;
                const portionSize = ingredient.portionsPerPurchase || 0;
                const displayCost = ingredient.portionCost ?? ingredient.purchaseCost ?? 0;
                return (
                  <div key={ingredient.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{ingredient.name}</h4>
                        <p className="text-xs text-gray-500">{ingredient.supplier} • {displayUnit}</p>
                        {portionSize > 0 && <p className="text-xs text-blue-600">Portions per purchase: {portionSize}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-green-600">฿{displayCost}</p>
                        {ingredient.portionCost != null && <p className="text-xs text-gray-500">฿{Number(ingredient.portionCost).toFixed(2)}/portion</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" step="0.1" value={currentValue} onChange={(e) => onFieldChange(fieldName, parseFloat(e.target.value) || 0)} placeholder="0" className="text-sm" />
                      <span className="text-xs text-gray-500 whitespace-nowrap">{displayUnit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </div>
    </Card>
  );
}
