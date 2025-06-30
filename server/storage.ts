import { 
  users, menuItems, inventory, shoppingList, expenses, transactions, 
  aiInsights, suppliers, staffShifts, dailySales, dailyStockSales,
  type User, type InsertUser, type MenuItem, type InsertMenuItem,
  type Inventory, type InsertInventory, type ShoppingList, type InsertShoppingList,
  type Expense, type InsertExpense, type Transaction, type InsertTransaction,
  type AiInsight, type InsertAiInsight, type Supplier, type InsertSupplier,
  type StaffShift, type InsertStaffShift, type DailySales, type InsertDailySales,
  type DailyStockSales, type InsertDailyStockSales
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Dashboard & Analytics
  getDashboardKPIs(): Promise<{
    todaySales: number;
    ordersCount: number;
    inventoryValue: number;
    anomaliesCount: number;
  }>;
  getTopMenuItems(): Promise<Array<{name: string, sales: number, orders: number}>>;
  getRecentTransactions(): Promise<Transaction[]>;
  getAiInsights(): Promise<AiInsight[]>;
  
  // Daily Sales
  getDailySales(date?: Date): Promise<DailySales[]>;
  createDailySales(sales: InsertDailySales): Promise<DailySales>;
  
  // Menu Items
  getMenuItems(): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  
  // Inventory
  getInventory(): Promise<Inventory[]>;
  updateInventoryQuantity(id: number, quantity: number): Promise<Inventory>;
  getLowStockItems(): Promise<Inventory[]>;
  
  // Shopping List
  getShoppingList(): Promise<ShoppingList[]>;
  createShoppingListItem(item: InsertShoppingList): Promise<ShoppingList>;
  updateShoppingListItem(id: number, updates: Partial<ShoppingList>): Promise<ShoppingList>;
  deleteShoppingListItem(id: number): Promise<void>;
  
  // Expenses
  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  getExpensesByCategory(): Promise<Record<string, number>>;
  
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]>;
  
  // AI Insights
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  resolveAiInsight(id: number): Promise<AiInsight>;
  
  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  
  // Staff Shifts
  getStaffShifts(): Promise<StaffShift[]>;
  createStaffShift(shift: InsertStaffShift): Promise<StaffShift>;
  
  // Daily Stock and Sales
  getDailyStockSales(): Promise<DailyStockSales[]>;
  createDailyStockSales(data: InsertDailyStockSales): Promise<DailyStockSales>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private menuItems: Map<number, MenuItem> = new Map();
  private inventory: Map<number, Inventory> = new Map();
  private shoppingList: Map<number, ShoppingList> = new Map();
  private expenses: Map<number, Expense> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  private aiInsights: Map<number, AiInsight> = new Map();
  private suppliers: Map<number, Supplier> = new Map();
  private staffShifts: Map<number, StaffShift> = new Map();
  private dailySales: Map<number, DailySales> = new Map();
  private dailyStockSales: Map<number, DailyStockSales> = new Map();
  private currentId: number = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed menu items
    const menuData: InsertMenuItem[] = [
      { name: "Margherita Pizza", category: "Pizza", price: "18.99", cost: "6.50", ingredients: ["dough", "tomato sauce", "mozzarella", "basil"] },
      { name: "Caesar Salad", category: "Salads", price: "12.99", cost: "4.20", ingredients: ["lettuce", "croutons", "parmesan", "caesar dressing"] },
      { name: "Grilled Salmon", category: "Main Course", price: "24.99", cost: "8.50", ingredients: ["salmon fillet", "lemon", "herbs", "vegetables"] },
      { name: "Chicken Burger", category: "Burgers", price: "16.99", cost: "5.80", ingredients: ["chicken breast", "burger bun", "lettuce", "tomato"] }
    ];
    menuData.forEach(item => this.createMenuItem(item));

    // Seed inventory
    const inventoryData: InsertInventory[] = [
      { name: "Fresh Tomatoes", category: "Produce", quantity: "23", unit: "lbs", minStock: "50", supplier: "FreshCorp Supplies", pricePerUnit: "2.40" },
      { name: "Mozzarella Cheese", category: "Dairy", quantity: "45", unit: "lbs", minStock: "20", supplier: "DairyBest Inc.", pricePerUnit: "5.80" },
      { name: "Pizza Dough", category: "Bakery", quantity: "120", unit: "pieces", minStock: "50", supplier: "BakingPro Supplies", pricePerUnit: "1.20" }
    ];
    inventoryData.forEach(item => this.createInventoryItem(item));

    // Seed suppliers
    const supplierData: InsertSupplier[] = [
      { name: "FreshCorp Supplies", category: "Produce & Dairy", contactInfo: { email: "orders@freshcorp.com", phone: "555-0123", address: "123 Fresh St" }, deliveryTime: "Next day", status: "available" },
      { name: "BakingPro Supplies", category: "Baking & Dry Goods", contactInfo: { email: "sales@bakingpro.com", phone: "555-0456", address: "456 Baker Ave" }, deliveryTime: "2-3 days", status: "available" }
    ];
    supplierData.forEach(supplier => this.createSupplier(supplier));

    // Seed transactions to make the data more realistic
    const transactionData: InsertTransaction[] = [
      {
        orderId: "ORD-2024-001",
        tableNumber: 7,
        amount: "43.90",
        paymentMethod: "Credit Card",
        timestamp: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago
        items: [{ itemId: 1, quantity: 1, price: 18.99 }, { itemId: 2, quantity: 2, price: 12.99 }],
        staffMember: "Sarah Johnson"
      },
      {
        orderId: "ORD-2024-002", 
        tableNumber: 3,
        amount: "67.25",
        paymentMethod: "Cash",
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        items: [{ itemId: 3, quantity: 1, price: 24.99 }, { itemId: 1, quantity: 2, price: 18.99 }],
        staffMember: "Mike Davis"
      },
      {
        orderId: "ORD-2024-003",
        tableNumber: 12,
        amount: "28.50", 
        paymentMethod: "Credit Card",
        timestamp: new Date(Date.now() - 1000 * 60 * 8), // 8 minutes ago
        items: [{ itemId: 2, quantity: 1, price: 12.99 }, { itemId: 4, quantity: 1, price: 16.99 }],
        staffMember: "John Smith"
      }
    ];
    transactionData.forEach(transaction => this.createTransaction(transaction));

    // Seed AI insights
    const insightData: InsertAiInsight[] = [
      { type: "alert", severity: "medium", title: "Stock Alert", description: "Tomatoes inventory is running low. Suggest reordering 50 lbs by tomorrow.", data: { item: "tomatoes", currentStock: 23, recommendedOrder: 50 } },
      { type: "suggestion", severity: "low", title: "Sales Peak Detected", description: "Friday evening shows 30% higher sales. Consider increasing staff schedule.", data: { day: "friday", timeSlot: "evening", increase: 30 } },
      { type: "suggestion", severity: "low", title: "Menu Optimization", description: "Caesar Salad has high margins. Consider promoting it more actively.", data: { item: "Caesar Salad", margin: 68 } }
    ];
    insightData.forEach(insight => this.createAiInsight(insight));
  }

  private createInventoryItem(item: InsertInventory): Inventory {
    const id = this.currentId++;
    const inventoryItem: Inventory = { ...item, id };
    this.inventory.set(id, inventoryItem);
    return inventoryItem;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDashboardKPIs() {
    const todaySales = 2478.36;
    const ordersCount = 127;
    const inventoryValue = Array.from(this.inventory.values())
      .reduce((total, item) => total + (parseFloat(item.quantity) * parseFloat(item.pricePerUnit)), 0);
    const anomaliesCount = Array.from(this.aiInsights.values())
      .filter(insight => insight.type === 'anomaly' && !insight.resolved).length;

    return { todaySales, ordersCount, inventoryValue, anomaliesCount };
  }

  async getTopMenuItems() {
    // Connect to Loyverse API for real sales data
    try {
      const { loyverseService } = await import('./services/loyverse.js');
      const loyverseData = await loyverseService.getSalesByItem();
      
      // Transform Loyverse data to our interface format
      return loyverseData.map((item: any) => ({
        name: item.item_name,
        sales: item.net_sales,
        orders: item.orders_count,
        monthlyGrowth: loyverseService.calculateMonthlyGrowth(item.net_sales, item.net_sales * 0.9),
        category: item.category_name
      }));
    } catch (error) {
      console.error('Loyverse API connection failed:', error);
      // For production use, display error state rather than fallback data
      throw new Error('Unable to connect to Loyverse POS system. Please check your connection and API credentials.');
    }
  }

  async getRecentTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  async getAiInsights(): Promise<AiInsight[]> {
    return Array.from(this.aiInsights.values())
      .filter(insight => !insight.resolved)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getDailySales(date?: Date): Promise<DailySales[]> {
    return Array.from(this.dailySales.values());
  }

  async createDailySales(sales: InsertDailySales): Promise<DailySales> {
    const id = this.currentId++;
    const dailySalesRecord: DailySales = { ...sales, id };
    this.dailySales.set(id, dailySalesRecord);
    return dailySalesRecord;
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return Array.from(this.menuItems.values());
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const id = this.currentId++;
    const menuItem: MenuItem = { ...item, id };
    this.menuItems.set(id, menuItem);
    return menuItem;
  }

  async getInventory(): Promise<Inventory[]> {
    return Array.from(this.inventory.values());
  }

  async updateInventoryQuantity(id: number, quantity: number): Promise<Inventory> {
    const item = this.inventory.get(id);
    if (!item) throw new Error("Inventory item not found");
    
    const updated = { ...item, quantity: quantity.toString() };
    this.inventory.set(id, updated);
    return updated;
  }

  async getLowStockItems(): Promise<Inventory[]> {
    return Array.from(this.inventory.values())
      .filter(item => parseFloat(item.quantity) <= parseFloat(item.minStock));
  }

  async getShoppingList(): Promise<ShoppingList[]> {
    return Array.from(this.shoppingList.values());
  }

  async createShoppingListItem(item: InsertShoppingList): Promise<ShoppingList> {
    const id = this.currentId++;
    const shoppingListItem: ShoppingList = { ...item, id };
    this.shoppingList.set(id, shoppingListItem);
    return shoppingListItem;
  }

  async updateShoppingListItem(id: number, updates: Partial<ShoppingList>): Promise<ShoppingList> {
    const item = this.shoppingList.get(id);
    if (!item) throw new Error("Shopping list item not found");
    
    const updated = { ...item, ...updates };
    this.shoppingList.set(id, updated);
    return updated;
  }

  async deleteShoppingListItem(id: number): Promise<void> {
    this.shoppingList.delete(id);
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const id = this.currentId++;
    const expenseRecord: Expense = { ...expense, id };
    this.expenses.set(id, expenseRecord);
    return expenseRecord;
  }

  async getExpensesByCategory(): Promise<Record<string, number>> {
    const expenses = Array.from(this.expenses.values());
    const categories: Record<string, number> = {};
    
    expenses.forEach(expense => {
      const category = expense.category;
      categories[category] = (categories[category] || 0) + parseFloat(expense.amount);
    });
    
    return categories;
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentId++;
    const transactionRecord: Transaction = { ...transaction, id };
    this.transactions.set(id, transactionRecord);
    return transactionRecord;
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.timestamp >= startDate && t.timestamp <= endDate);
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    const id = this.currentId++;
    const aiInsight: AiInsight = { 
      ...insight, 
      id, 
      createdAt: new Date(),
      resolved: false 
    };
    this.aiInsights.set(id, aiInsight);
    return aiInsight;
  }

  async resolveAiInsight(id: number): Promise<AiInsight> {
    const insight = this.aiInsights.get(id);
    if (!insight) throw new Error("AI insight not found");
    
    const updated = { ...insight, resolved: true };
    this.aiInsights.set(id, updated);
    return updated;
  }

  async getSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const id = this.currentId++;
    const supplierRecord: Supplier = { ...supplier, id };
    this.suppliers.set(id, supplierRecord);
    return supplierRecord;
  }

  async getStaffShifts(): Promise<StaffShift[]> {
    return Array.from(this.staffShifts.values());
  }

  async createStaffShift(shift: InsertStaffShift): Promise<StaffShift> {
    const id = this.currentId++;
    const staffShift: StaffShift = { ...shift, id };
    this.staffShifts.set(id, staffShift);
    return staffShift;
  }

  async getDailyStockSales(): Promise<DailyStockSales[]> {
    return Array.from(this.dailyStockSales.values()).sort((a, b) => 
      new Date(b.shiftDate).getTime() - new Date(a.shiftDate).getTime()
    );
  }

  async createDailyStockSales(data: InsertDailyStockSales): Promise<DailyStockSales> {
    const id = this.currentId++;
    const dailyStockSalesRecord: DailyStockSales = { 
      ...data, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.dailyStockSales.set(id, dailyStockSalesRecord);
    return dailyStockSalesRecord;
  }
}

export const storage = new MemStorage();
