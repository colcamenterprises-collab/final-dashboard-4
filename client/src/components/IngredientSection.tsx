import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Note: Collapsible component may need to be installed or created if not available
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { useIngredients, type Ingredient } from "../hooks/useIngredients";

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
      case 'fresh food':
        return 'Fresh';
      case 'frozen food':
        return 'Frozen';
      case 'drinks':
      case 'beverages':
        return 'Drinks';
      case 'meat':
        return 'Meat';
      case 'condiments':
        return 'Condiments';
      case 'packaging':
        return 'Packaging';
      case 'supplies':
      case 'kitchen supplies':
        return 'Supplies';
      case 'shelf stock':
      case 'shelf items':
        return 'Shelf';
      default:
        return 'Items';
    }
  };

  return (
    <Card className="mb-4">
      <div>
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span>{getCategoryIcon(category)} - {category}</span>
              <Badge variant="secondary" className="ml-2">
                {ingredients.length} items
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CardTitle>
        </CardHeader>
        
        {isOpen && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ingredients.map((ingredient) => {
                const fieldName = ingredient.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
                const currentValue = formValues[fieldName] || 0;
                
                return (
                  <div key={ingredient.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{ingredient.name}</h4>
                        <p className="text-xs text-gray-500">
                          {ingredient.supplier} • {ingredient.unit}
                        </p>
                        {ingredient.portionSize > 0 && (
                          <p className="text-xs text-blue-600">
                            Portion: {ingredient.portionSize} {ingredient.unit}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-green-600">
                          ฿{ingredient.price || ingredient.unitPrice}
                        </p>
                        {ingredient.costPerPortion > 0 && (
                          <p className="text-xs text-gray-500">
                            ฿{ingredient.costPerPortion.toFixed(2)}/portion
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={currentValue}
                        onChange={(e) => onFieldChange(fieldName, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="text-sm"
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {ingredient.unit}
                      </span>
                    </div>
                    
                    {ingredient.notes && (
                      <p className="text-xs text-gray-400 italic">
                        {ingredient.notes}
                      </p>
                    )}
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

interface DatabaseDrivenIngredientsProps {
  formValues: Record<string, number>;
  onFieldChange: (fieldName: string, value: number) => void;
}

export function DatabaseDrivenIngredients({ formValues, onFieldChange }: DatabaseDrivenIngredientsProps) {
  const { data: ingredientsData, isLoading, error } = useIngredients();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">Loading ingredients from database...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !ingredientsData?.success) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p className="text-red-500 mb-2">Failed to load ingredients from database</p>
          <p className="text-sm text-gray-500">Using fallback ingredient list</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Stock Inventory</h3>
        <Badge variant="outline" className="ml-2">
          {ingredientsData.total} items across {ingredientsData.categories.length} categories
        </Badge>
      </div>
      
      {ingredientsData.categories.map((category) => (
        <IngredientSection
          key={category}
          category={category}
          ingredients={ingredientsData.ingredients[category]}
          formValues={formValues}
          onFieldChange={onFieldChange}
        />
      ))}
    </div>
  );
}