import { queryClient } from "./queryClient";

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

  // Shopping List
  getShoppingList: (): Promise<ShoppingListItem[]> =>
    fetch("/api/shopping-list").then(res => res.json()),
  
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

  // Expenses
  getExpenses: (): Promise<Expense[]> =>
    fetch("/api/expensesV2").then(res => res.json()),
  
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
