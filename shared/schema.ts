import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Daily Sales table
export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull(),
  ordersCount: integer("orders_count").notNull(),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).notNull(),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }).notNull(),
  staffMember: text("staff_member").notNull(),
});

// Menu Items table
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }).notNull(),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
});

// Inventory table
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
});

// Shopping List table
export const shoppingList = pgTable("shopping_list", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  supplier: text("supplier").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
  priority: text("priority").notNull(), // 'high', 'medium', 'low'
  selected: boolean("selected").default(false),
  aiGenerated: boolean("ai_generated").default(false),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").notNull(),
  paymentMethod: text("payment_method").notNull(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  tableNumber: integer("table_number"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  items: jsonb("items").$type<Array<{itemId: number, quantity: number, price: number}>>().notNull(),
  staffMember: text("staff_member").notNull(),
});

// AI Insights table
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'anomaly', 'suggestion', 'alert'
  severity: text("severity").notNull(), // 'low', 'medium', 'high'
  title: text("title").notNull(),
  description: text("description").notNull(),
  data: jsonb("data").$type<Record<string, any>>(),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contactInfo: jsonb("contact_info").$type<{email: string, phone: string, address: string}>().notNull(),
  deliveryTime: text("delivery_time").notNull(),
  status: text("status").notNull(), // 'available', 'unavailable'
});

// Staff Shifts table
export const staffShifts = pgTable("staff_shifts", {
  id: serial("id").primaryKey(),
  staffMember: text("staff_member").notNull(),
  date: timestamp("date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  openingStock: integer("opening_stock").notNull(),
  closingStock: integer("closing_stock").notNull(),
  reportedSales: decimal("reported_sales", { precision: 10, scale: 2 }).notNull(),
});

// Loyverse Receipts table
export const loyverseReceipts = pgTable("loyverse_receipts", {
  id: serial("id").primaryKey(),
  receiptId: text("receipt_id").notNull().unique(),
  receiptNumber: text("receipt_number").notNull(),
  receiptDate: timestamp("receipt_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  customerInfo: jsonb("customer_info"),
  items: jsonb("items").notNull(), // Array of receipt items
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  staffMember: text("staff_member"),
  tableNumber: integer("table_number"),
  shiftDate: timestamp("shift_date").notNull(), // Date of the shift (6pm-3am cycle)
  rawData: jsonb("raw_data"), // Full Loyverse API response
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Loyverse Shift Reports table
export const loyverseShiftReports = pgTable("loyverse_shift_reports", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().unique(),
  shiftDate: timestamp("shift_date").notNull(),
  shiftStart: timestamp("shift_start").notNull(),
  shiftEnd: timestamp("shift_end").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull(),
  totalTransactions: integer("total_transactions").notNull(),
  totalCustomers: integer("total_customers"),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }),
  discounts: decimal("discounts", { precision: 10, scale: 2 }),
  taxes: decimal("taxes", { precision: 10, scale: 2 }),
  staffMembers: jsonb("staff_members"), // Array of staff who worked the shift
  topItems: jsonb("top_items"), // Best selling items for the shift
  reportData: jsonb("report_data").notNull(), // Full shift report data
  completedBy: text("completed_by"), // Staff member who completed the report
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Daily Stock and Sales Form table
export const dailyStockSales = pgTable("daily_stock_sales", {
  id: serial("id").primaryKey(),
  completedBy: text("completed_by").notNull(),
  shiftType: text("shift_type").notNull(), // Night Shift, Day Shift
  shiftDate: timestamp("shift_date").notNull(),
  
  // Cash Management
  startingCash: decimal("starting_cash", { precision: 10, scale: 2 }).notNull(),
  endingCash: decimal("ending_cash", { precision: 10, scale: 2 }).notNull(),
  
  // Sales Data
  grabSales: decimal("grab_sales", { precision: 10, scale: 2 }).notNull(),
  foodPandaSales: decimal("food_panda_sales", { precision: 10, scale: 2 }).notNull(),
  aroiDeeSales: decimal("aroi_dee_sales", { precision: 10, scale: 2 }).notNull(),
  qrScanSales: decimal("qr_scan_sales", { precision: 10, scale: 2 }).notNull(),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).notNull(),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull(),
  
  // Expenses
  salaryWages: decimal("salary_wages", { precision: 10, scale: 2 }).notNull(),
  shopping: decimal("shopping", { precision: 10, scale: 2 }).notNull(),
  gasExpense: decimal("gas_expense", { precision: 10, scale: 2 }).notNull(),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }).notNull(),
  wageEntries: jsonb("wage_entries").notNull().default('[]'), // Array of {name, amount, notes}
  shoppingEntries: jsonb("shopping_entries").notNull().default('[]'), // Array of {item, amount, notes}
  expenseDescription: text("expense_description"),
  
  // Stock Counts
  burgerBunsStock: integer("burger_buns_stock").notNull(),
  rollsOrderedCount: integer("rolls_ordered_count").notNull(),
  meatWeight: decimal("meat_weight", { precision: 10, scale: 2 }).notNull(), // in kg
  
  // Food Items (quantities needed)
  foodItems: jsonb("food_items").notNull(), // Contains all food item requirements
  
  // Drink Stock Counts
  drinkStock: jsonb("drink_stock").notNull(), // Current drink inventory
  
  // Kitchen & Packaging Requirements
  kitchenItems: jsonb("kitchen_items").notNull(),
  packagingItems: jsonb("packaging_items").notNull(),
  
  // Confirmation
  rollsOrderedConfirmed: boolean("rolls_ordered_confirmed").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertDailySalesSchema = createInsertSchema(dailySales).omit({ id: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertShoppingListSchema = createInsertSchema(shoppingList).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertStaffShiftSchema = createInsertSchema(staffShifts).omit({ id: true });
export const insertLoyverseReceiptSchema = createInsertSchema(loyverseReceipts).omit({ id: true });
export const insertLoyverseShiftReportSchema = createInsertSchema(loyverseShiftReports).omit({ id: true });
export const insertDailyStockSalesSchema = createInsertSchema(dailyStockSales).omit({ id: true, createdAt: true, updatedAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DailySales = typeof dailySales.$inferSelect;
export type InsertDailySales = z.infer<typeof insertDailySalesSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type ShoppingList = typeof shoppingList.$inferSelect;
export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type StaffShift = typeof staffShifts.$inferSelect;
export type InsertStaffShift = z.infer<typeof insertStaffShiftSchema>;
export type LoyverseReceipt = typeof loyverseReceipts.$inferSelect;
export type InsertLoyverseReceipt = z.infer<typeof insertLoyverseReceiptSchema>;
export type LoyverseShiftReport = typeof loyverseShiftReports.$inferSelect;
export type InsertLoyverseShiftReport = z.infer<typeof insertLoyverseShiftReportSchema>;
export type DailyStockSales = typeof dailyStockSales.$inferSelect;
export type InsertDailyStockSales = z.infer<typeof insertDailyStockSalesSchema>;
