import { useQuery } from '@tanstack/react-query';

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  supplier: string;
  brand: string | null;
  purchaseQty: number;
  purchaseUnit: string;
  purchaseCost: number;
  portionUnit: string | null;
  portionsPerPurchase: number | null;
  portionCost: number | null;
  lastReview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientsResponse {
  success: boolean;
  categories: string[];
  ingredients: Record<string, Ingredient[]>;
  total: number;
}

export function useIngredients() {
  return useQuery<Ingredient[]>({
    queryKey: ['/api/ingredients'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in TanStack Query v5)
  });
}

export function parseIngredientsToFormFields(ingredients: Ingredient[]) {
  const formFields: Array<{
    label: string;
    name: string;
    unit: string;
    cost: number;
    supplier: string;
    category: string;
    portionSize: number;
  }> = [];

  ingredients.forEach(item => {
    formFields.push({
      label: `${item.name} (${item.purchaseUnit})`,
      name: item.name.toLowerCase().replace(/[^a-z0-9]/gi, '_'),
      unit: item.purchaseUnit,
      cost: item.purchaseCost || 0,
      supplier: item.supplier,
      category: item.category,
      portionSize: item.portionsPerPurchase || 0
    });
  });

  return formFields;
}