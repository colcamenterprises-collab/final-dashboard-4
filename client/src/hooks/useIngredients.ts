import { useQuery } from '@tanstack/react-query';

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  supplier: string;
  unitPrice: string;
  price: number;
  packageSize: number;
  portionSize: number;
  costPerPortion: number;
  unit: string;
  notes: string;
}

export interface IngredientsResponse {
  success: boolean;
  categories: string[];
  ingredients: Record<string, Ingredient[]>;
  total: number;
}

export function useIngredients() {
  return useQuery<IngredientsResponse>({
    queryKey: ['/api/ingredients/by-category'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in TanStack Query v5)
  });
}

export function parseCSVtoFormFields(ingredientsData: IngredientsResponse) {
  const formFields: Array<{
    label: string;
    name: string;
    unit: string;
    cost: number;
    supplier: string;
    category: string;
    portionSize: number;
  }> = [];

  Object.entries(ingredientsData.ingredients).forEach(([category, items]) => {
    items.forEach(item => {
      formFields.push({
        label: `${item.name} (${item.unit})`,
        name: item.name.toLowerCase().replace(/[^a-z0-9]/gi, '_'),
        unit: item.unit,
        cost: item.price || 0,
        supplier: item.supplier,
        category: category,
        portionSize: item.portionSize || 0
      });
    });
  });

  return formFields;
}