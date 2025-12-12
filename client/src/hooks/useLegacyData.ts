// PATCH L1 — Legacy Data Hooks
// React Query hooks with automatic V2 → Legacy fallback
// READ-ONLY - for data visibility across tables

import { useQuery } from "@tanstack/react-query";
import { legacyApi, LegacyFallbackResponse } from "@/lib/api";

/**
 * Hook for fetching daily sales with legacy fallback
 */
export function useDailySalesWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/daily-sales"],
    queryFn: legacyApi.getDailySales,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching expenses with legacy fallback
 */
export function useExpensesWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/expenses"],
    queryFn: legacyApi.getExpenses,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching shopping list with legacy fallback
 */
export function useShoppingListWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/shopping-list"],
    queryFn: legacyApi.getShoppingList,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching ingredients with legacy fallback
 */
export function useIngredientsWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/ingredients"],
    queryFn: legacyApi.getIngredients,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching recipes with legacy fallback
 */
export function useRecipesWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/recipes"],
    queryFn: legacyApi.getRecipes,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching suppliers with legacy fallback
 */
export function useSuppliersWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/suppliers"],
    queryFn: legacyApi.getSuppliers,
    staleTime: 30000,
  });
}

/**
 * Hook for fetching menu items with legacy fallback
 */
export function useMenuItemsWithFallback() {
  return useQuery<LegacyFallbackResponse>({
    queryKey: ["/api/legacy-bridge/menu-items"],
    queryFn: legacyApi.getMenuItems,
    staleTime: 30000,
  });
}

/**
 * Generic hook for any legacy fallback endpoint
 */
export function useLegacyData(
  primaryUrl: string,
  legacyUrl: string,
  options?: { enabled?: boolean }
) {
  return useQuery<LegacyFallbackResponse>({
    queryKey: [legacyUrl],
    queryFn: async () => {
      const { fetchWithLegacyFallback } = await import("@/lib/api");
      return fetchWithLegacyFallback(primaryUrl, legacyUrl);
    },
    staleTime: 30000,
    enabled: options?.enabled ?? true,
  });
}
