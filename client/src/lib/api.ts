import { queryClient } from "./queryClient";

// PATCH L1 — Legacy Fallback Response Type
export interface LegacyFallbackResponse<T = any> {
  source: 'v2' | 'legacy';
  rows: T[];
  count: number;
}

/**
 * PATCH L1 — Fetch with Legacy Fallback
 * Tries primary endpoint first, falls back to legacy-bridge if empty
 * READ-ONLY - used for data visibility across V2/legacy tables
 */
export async function fetchWithLegacyFallback<T = any>(
  primaryUrl: string,
  legacyUrl: string
): Promise<LegacyFallbackResponse<T>> {
  try {
    const res = await fetch(primaryUrl);
    if (!res.ok) throw new Error(`Primary fetch failed: ${res.status}`);
    
    const data = await res.json();

    // Check if primary has data
    if (Array.isArray(data) && data.length > 0) {
      return { source: 'v2', rows: data, count: data.length };
    }
    if (data?.rows?.length > 0) {
      return data as LegacyFallbackResponse<T>;
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
      // Single object response
      return { source: 'v2', rows: [data], count: 1 };
    }

    // Fallback to legacy bridge
    const legacyRes = await fetch(legacyUrl);
    if (!legacyRes.ok) {
      return { source: 'v2', rows: [], count: 0 };
    }
    
    const legacyData = await legacyRes.json();
    
    if (legacyData?.rows) {
      return legacyData as LegacyFallbackResponse<T>;
    }
    if (Array.isArray(legacyData)) {
      return { source: 'legacy', rows: legacyData, count: legacyData.length };
    }
    
    return { source: 'legacy', rows: [], count: 0 };
  } catch (error) {
    console.error('[LegacyFallback] Error:', error);
    return { source: 'v2', rows: [], count: 0 };
  }
}

// Legacy fallback URL mappings
export const LEGACY_URLS = {
  dailySales: { primary: '/api/forms', legacy: '/api/legacy-bridge/daily-sales' },
  expenses: { primary: '/api/expensesV2', legacy: '/api/legacy-bridge/expenses' },
  shoppingList: { primary: '/api/shopping-list', legacy: '/api/legacy-bridge/shopping-list' },
  ingredients: { primary: '/api/ingredients', legacy: '/api/legacy-bridge/ingredients' },
  recipes: { primary: '/api/recipes', legacy: '/api/legacy-bridge/recipes' },
  suppliers: { primary: '/api/suppliers', legacy: '/api/legacy-bridge/suppliers' },
  menuItems: { primary: '/api/menu-v3/items', legacy: '/api/legacy-bridge/menu-items' },
} as const;

export interface KPIData {
  lastShiftSales: number;
  lastShiftOrders: number;
  monthToDateSales: number;
  inventoryValue: number;
  averageOrderValue: number;
  shiftDate: string;
  shiftPeriod: {
    start: Date;
    end: Date;
  };
  note: string;
}

export interface TopMenuItem {
  name: string;
  sales: number;
  orders: number;
  monthlyGrowth?: string;
  category?: string;
}

export interface Transaction {
  id: number;
  orderId: string;
  tableNumber?: number;
  amount: string;
  paymentMethod: string;
  timestamp: string;
  staffMember: string;
}

export interface AiInsight {
  id: number;
  type: string;
  severity: string;
  title: string;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  minStock: string;
  supplier: string;
  pricePerUnit: string;
}

export interface ShoppingListItem {
  id: number;
  itemName: string;
  quantity: string;
  unit: string;
  supplier: string;
  pricePerUnit: string;
  priority: string;
  selected: boolean;
  aiGenerated: boolean;
}

export interface Expense {
  id: number;
  description: string;
  amount: string;
  category: string;
  date: string;
  paymentMethod: string;
}

export interface Supplier {
  id: number;
  name: string;
  category: string;
  contactInfo: {
    email: string;
    phone: string;
    address: string;
  };
  deliveryTime: string;
  status: string;
}

// PATCH L1 — Legacy-aware API functions with automatic fallback
export const legacyApi = {
  getDailySales: () => fetchWithLegacyFallback(
    LEGACY_URLS.dailySales.primary,
    LEGACY_URLS.dailySales.legacy
  ),
  
  getExpenses: () => fetchWithLegacyFallback<Expense>(
    LEGACY_URLS.expenses.primary,
    LEGACY_URLS.expenses.legacy
  ),
  
  getShoppingList: () => fetchWithLegacyFallback<ShoppingListItem>(
    LEGACY_URLS.shoppingList.primary,
    LEGACY_URLS.shoppingList.legacy
  ),
  
  getIngredients: () => fetchWithLegacyFallback(
    LEGACY_URLS.ingredients.primary,
    LEGACY_URLS.ingredients.legacy
  ),
  
  getRecipes: () => fetchWithLegacyFallback(
    LEGACY_URLS.recipes.primary,
    LEGACY_URLS.recipes.legacy
  ),
  
  getSuppliers: () => fetchWithLegacyFallback<Supplier>(
    LEGACY_URLS.suppliers.primary,
    LEGACY_URLS.suppliers.legacy
  ),
  
  getMenuItems: () => fetchWithLegacyFallback(
    LEGACY_URLS.menuItems.primary,
    LEGACY_URLS.menuItems.legacy
  ),
};

// API functions
export const api = {
  // Dashboard
  getDashboardKPIs: (): Promise<KPIData> =>
    fetch("/api/dashboard/kpis").then(res => res.json()),
  
  getTopMenuItems: (): Promise<TopMenuItem[]> =>
    fetch("/api/dashboard/top-menu-items").then(res => res.json()),
  
  getRecentTransactions: (): Promise<Transaction[]> =>
    fetch("/api/dashboard/recent-transactions").then(res => res.json()),
  
  getAiInsights: (): Promise<AiInsight[]> =>
    fetch("/api/dashboard/ai-insights").then(res => res.json()),

  // Inventory
  getInventory: (): Promise<InventoryItem[]> =>
    fetch("/api/inventory").then(res => res.json()),
  
  getLowStockItems: (): Promise<InventoryItem[]> =>
    fetch("/api/inventory/low-stock").then(res => res.json()),

  // Shopping List (with legacy fallback)
  getShoppingList: (): Promise<ShoppingListItem[]> =>
    fetch("/api/shopping-list").then(res => res.json()),
  
  getShoppingListWithFallback: () => legacyApi.getShoppingList(),
  
  createShoppingListItem: (item: Omit<ShoppingListItem, "id">) =>
    fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    }).then(res => res.json()),
  
  updateShoppingListItem: (id: number, updates: Partial<ShoppingListItem>) =>
    fetch(`/api/shopping-list/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    }).then(res => res.json()),
  
  deleteShoppingListItem: (id: number) =>
    fetch(`/api/shopping-list/${id}`, { method: "DELETE" }).then(res => res.json()),
  
  generateShoppingList: () =>
    fetch("/api/shopping-list/generate", { method: "POST" }).then(res => res.json()),

  // Expenses (with legacy fallback)
  getExpenses: (): Promise<Expense[]> =>
    fetch("/api/expensesV2").then(res => res.json()),
  
  getExpensesWithFallback: () => legacyApi.getExpenses(),
  
  createExpense: (expense: Omit<Expense, "id">) =>
    fetch("/api/expensesV2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense)
    }).then(res => res.json()),
  
  getExpensesByCategory: (): Promise<Record<string, number>> =>
    fetch("/api/expensesV2/by-category").then(res => res.json()),

  // Suppliers
  getSuppliers: (): Promise<Supplier[]> =>
    fetch("/api/suppliers").then(res => res.json()),

  // Finance
  getFinanceComparison: () =>
    fetch("/api/finance/pos-vs-staff").then(res => res.json()),

  // POS
  analyzeReceipt: (imageBase64: string) =>
    fetch("/api/pos/analyze-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 })
    }).then(res => res.json()),
  
  detectAnomalies: () =>
    fetch("/api/pos/detect-anomalies", { method: "POST" }).then(res => res.json()),

  // AI Insights
  resolveAiInsight: (id: number) =>
    fetch(`/api/ai-insights/${id}/resolve`, { method: "PUT" }).then(res => res.json()),
};

// Mutation functions that invalidate cache
export const mutations = {
  createShoppingListItem: async (item: Omit<ShoppingListItem, "id">) => {
    const result = await api.createShoppingListItem(item);
    queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    return result;
  },

  createExpense: async (expense: Omit<Expense, "id">) => {
    const result = await api.createExpense(expense);
    queryClient.invalidateQueries({ queryKey: ["/api/expensesV2"] });
    queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/by-category"] });
    return result;
  },

  updateShoppingListItem: async (id: number, updates: Partial<ShoppingListItem>) => {
    const result = await api.updateShoppingListItem(id, updates);
    queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    return result;
  },

  deleteShoppingListItem: async (id: number) => {
    const result = await api.deleteShoppingListItem(id);
    queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    return result;
  },

  generateShoppingList: async () => {
    const result = await api.generateShoppingList();
    queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    return result;
  },

  resolveAiInsight: async (id: number) => {
    const result = await api.resolveAiInsight(id);
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/ai-insights"] });
    return result;
  }
};
