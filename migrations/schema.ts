import { pgTable, serial, text, jsonb, boolean, timestamp, numeric, integer, unique, foreignKey, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const aiInsights = pgTable("ai_insights", {
	id: serial().primaryKey().notNull(),
	type: text().notNull(),
	severity: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	data: jsonb(),
	resolved: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const dailySales = pgTable("daily_sales", {
	id: serial().primaryKey().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	totalSales: numeric("total_sales", { precision: 10, scale:  2 }).notNull(),
	ordersCount: integer("orders_count").notNull(),
	cashSales: numeric("cash_sales", { precision: 10, scale:  2 }).notNull(),
	cardSales: numeric("card_sales", { precision: 10, scale:  2 }).notNull(),
	staffMember: text("staff_member").notNull(),
});

export const inventory = pgTable("inventory", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	quantity: numeric({ precision: 10, scale:  2 }).notNull(),
	unit: text().notNull(),
	minStock: numeric("min_stock", { precision: 10, scale:  2 }).notNull(),
	supplier: text().notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 8, scale:  2 }).notNull(),
});

export const loyverseReceipts = pgTable("loyverse_receipts", {
	id: serial().primaryKey().notNull(),
	receiptId: text("receipt_id").notNull(),
	receiptNumber: text("receipt_number").notNull(),
	receiptDate: timestamp("receipt_date", { mode: 'string' }).notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	paymentMethod: text("payment_method").notNull(),
	customerInfo: jsonb("customer_info"),
	items: jsonb().notNull(),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }),
	staffMember: text("staff_member"),
	tableNumber: integer("table_number"),
	shiftDate: timestamp("shift_date", { mode: 'string' }).notNull(),
	rawData: jsonb("raw_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("loyverse_receipts_receipt_id_unique").on(table.receiptId),
]);

export const loyverseShiftReports = pgTable("loyverse_shift_reports", {
	id: serial().primaryKey().notNull(),
	reportId: text("report_id").notNull(),
	shiftDate: timestamp("shift_date", { mode: 'string' }).notNull(),
	shiftStart: timestamp("shift_start", { mode: 'string' }).notNull(),
	shiftEnd: timestamp("shift_end", { mode: 'string' }).notNull(),
	totalSales: numeric("total_sales", { precision: 12, scale:  2 }).notNull(),
	totalTransactions: integer("total_transactions").notNull(),
	totalCustomers: integer("total_customers"),
	cashSales: numeric("cash_sales", { precision: 10, scale:  2 }),
	cardSales: numeric("card_sales", { precision: 10, scale:  2 }),
	discounts: numeric({ precision: 10, scale:  2 }),
	taxes: numeric({ precision: 10, scale:  2 }),
	staffMembers: jsonb("staff_members"),
	topItems: jsonb("top_items"),
	reportData: jsonb("report_data").notNull(),
	completedBy: text("completed_by"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("loyverse_shift_reports_report_id_unique").on(table.reportId),
]);

export const menuItems = pgTable("menu_items", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	price: numeric({ precision: 8, scale:  2 }).notNull(),
	cost: numeric({ precision: 8, scale:  2 }).notNull(),
	ingredients: jsonb().notNull(),
});

export const staffShifts = pgTable("staff_shifts", {
	id: serial().primaryKey().notNull(),
	staffMember: text("staff_member").notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }).notNull(),
	openingStock: integer("opening_stock").notNull(),
	closingStock: integer("closing_stock").notNull(),
	reportedSales: numeric("reported_sales", { precision: 10, scale:  2 }).notNull(),
});

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	contactInfo: jsonb("contact_info").notNull(),
	deliveryTime: text("delivery_time").notNull(),
	status: text().notNull(),
});

export const transactions = pgTable("transactions", {
	id: serial().primaryKey().notNull(),
	orderId: text("order_id").notNull(),
	tableNumber: integer("table_number"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	paymentMethod: text("payment_method").notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	items: jsonb().notNull(),
	staffMember: text("staff_member").notNull(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const dailyStockSales = pgTable("daily_stock_sales", {
	id: serial().primaryKey().notNull(),
	completedBy: text("completed_by").notNull(),
	shiftType: text("shift_type").notNull(),
	shiftDate: timestamp("shift_date", { mode: 'string' }).notNull(),
	startingCash: numeric("starting_cash", { precision: 10, scale:  2 }).default('0'),
	endingCash: numeric("ending_cash", { precision: 10, scale:  2 }).default('0'),
	grabSales: numeric("grab_sales", { precision: 10, scale:  2 }).default('0'),
	foodPandaSales: numeric("food_panda_sales", { precision: 10, scale:  2 }).default('0'),
	aroiDeeSales: numeric("aroi_dee_sales", { precision: 10, scale:  2 }).default('0'),
	qrScanSales: numeric("qr_scan_sales", { precision: 10, scale:  2 }).default('0'),
	cashSales: numeric("cash_sales", { precision: 10, scale:  2 }).default('0'),
	totalSales: numeric("total_sales", { precision: 10, scale:  2 }).default('0'),
	salaryWages: numeric("salary_wages", { precision: 10, scale:  2 }).default('0'),
	shopping: numeric({ precision: 10, scale:  2 }).default('0'),
	gasExpense: numeric("gas_expense", { precision: 10, scale:  2 }).default('0'),
	totalExpenses: numeric("total_expenses", { precision: 10, scale:  2 }).default('0'),
	expenseDescription: text("expense_description"),
	burgerBunsStock: integer("burger_buns_stock").default(0),
	rollsOrderedCount: integer("rolls_ordered_count").default(0),
	meatWeight: numeric("meat_weight", { precision: 10, scale:  2 }).default('0'),
	foodItems: jsonb("food_items").default({}).notNull(),
	drinkStock: jsonb("drink_stock").default({}).notNull(),
	kitchenItems: jsonb("kitchen_items").default({}).notNull(),
	packagingItems: jsonb("packaging_items").default({}).notNull(),
	rollsOrderedConfirmed: boolean("rolls_ordered_confirmed").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	wageEntries: jsonb("wage_entries").default([]).notNull(),
	shoppingEntries: jsonb("shopping_entries").default([]).notNull(),
	drinkStockCount: integer("drink_stock_count").default(0),
	freshFood: jsonb("fresh_food").default({}).notNull(),
	frozenFood: jsonb("frozen_food").default({}).notNull(),
	shelfItems: jsonb("shelf_items").default({}).notNull(),
	isDraft: boolean("is_draft").default(false).notNull(),
});

export const bankStatements = pgTable("bank_statements", {
	id: serial().primaryKey().notNull(),
	filename: text().notNull(),
	uploadDate: timestamp("upload_date", { mode: 'string' }).defaultNow().notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	fileData: text("file_data").notNull(),
	analysisStatus: text("analysis_status").default('pending').notNull(),
	aiAnalysis: jsonb("ai_analysis"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const expenseCategories = pgTable("expense_categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("expense_categories_name_unique").on(table.name),
]);

export const expenseSuppliers = pgTable("expense_suppliers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("expense_suppliers_name_unique").on(table.name),
]);

export const recipeIngredients = pgTable("recipe_ingredients", {
	id: serial().primaryKey().notNull(),
	recipeId: integer("recipe_id").notNull(),
	ingredientId: integer("ingredient_id").notNull(),
	quantity: numeric({ precision: 10, scale:  3 }).notNull(),
	unit: text().notNull(),
	cost: numeric({ precision: 10, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: "recipe_ingredients_recipe_id_recipes_id_fk"
		}),
	foreignKey({
			columns: [table.ingredientId],
			foreignColumns: [ingredients.id],
			name: "recipe_ingredients_ingredient_id_ingredients_id_fk"
		}),
]);

export const shoppingList = pgTable("shopping_list", {
	id: serial().primaryKey().notNull(),
	itemName: text("item_name").notNull(),
	quantity: numeric({ precision: 10, scale:  2 }).notNull(),
	unit: text().notNull(),
	supplier: text().notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 8, scale:  2 }).notNull(),
	priority: text().notNull(),
	selected: boolean().default(false),
	aiGenerated: boolean("ai_generated").default(false),
	listDate: timestamp("list_date", { mode: 'string' }).defaultNow(),
	formId: integer("form_id"),
	listName: text("list_name"),
	isCompleted: boolean("is_completed").default(false),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	estimatedCost: numeric("estimated_cost", { precision: 10, scale:  2 }).default('0'),
	actualCost: numeric("actual_cost", { precision: 10, scale:  2 }).default('0'),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const expenses = pgTable("expenses", {
	id: serial().primaryKey().notNull(),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	category: text().notNull(),
	date: timestamp({ mode: 'string' }).defaultNow().notNull(),
	paymentMethod: text("payment_method").notNull(),
	supplier: text(),
	items: text(),
	notes: text(),
	month: integer().notNull(),
	year: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	quantity: numeric({ precision: 10, scale:  2 }).default('0'),
});

export const recipes = pgTable("recipes", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	category: text().notNull(),
	servingSize: integer("serving_size").notNull(),
	preparationTime: integer("preparation_time"),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	profitMargin: numeric("profit_margin", { precision: 5, scale:  2 }),
	sellingPrice: numeric("selling_price", { precision: 10, scale:  2 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	deliveryContent: text("delivery_content"),
	advertisingContent: text("advertising_content"),
	socialContent: text("social_content"),
	marketingNotes: text("marketing_notes"),
	ingredients: jsonb(),
	costPerServing: numeric("cost_per_serving", { precision: 10, scale:  2 }),
	breakDown: jsonb("break_down"),
});

export const marketingCalendar = pgTable("marketing_calendar", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	eventDate: timestamp("event_date", { mode: 'string' }).notNull(),
	eventType: text("event_type").notNull(),
	status: text().notNull(),
	googleCalendarId: text("google_calendar_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const quickNotes = pgTable("quick_notes", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	priority: text().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	isCompleted: boolean("is_completed").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const shiftItemSales = pgTable("shift_item_sales", {
	id: serial().primaryKey().notNull(),
	shiftDate: date("shift_date").notNull(),
	category: text().notNull(),
	itemName: text("item_name").notNull(),
	quantity: integer().notNull(),
	salesTotal: numeric("sales_total", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const shiftModifierSales = pgTable("shift_modifier_sales", {
	id: serial().primaryKey().notNull(),
	shiftDate: date("shift_date").notNull(),
	modifierName: text("modifier_name").notNull(),
	quantity: integer().notNull(),
	salesTotal: numeric("sales_total", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const dailyShiftReceiptSummary = pgTable("daily_shift_receipt_summary", {
	id: serial().primaryKey().notNull(),
	shiftDate: date("shift_date").notNull(),
	burgersSold: integer("burgers_sold").default(0).notNull(),
	drinksSold: integer("drinks_sold").default(0).notNull(),
	itemsBreakdown: jsonb("items_breakdown").notNull(),
	modifiersSummary: jsonb("modifiers_summary").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("daily_shift_receipt_summary_shift_date_key").on(table.shiftDate),
]);

export const dailyShiftSummary = pgTable("daily_shift_summary", {
	id: serial().primaryKey().notNull(),
	shiftDate: date("shift_date").notNull(),
	burgersSold: integer("burgers_sold").notNull(),
	pattiesUsed: integer("patties_used").notNull(),
	rollsStart: integer("rolls_start").notNull(),
	rollsPurchased: integer("rolls_purchased").notNull(),
	rollsExpected: integer("rolls_expected").notNull(),
	rollsActual: integer("rolls_actual").notNull(),
	rollsVariance: integer("rolls_variance").notNull(),
	varianceFlag: boolean("variance_flag").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("daily_shift_summary_shift_date_key").on(table.shiftDate),
]);

export const stockPurchaseRolls = pgTable("stock_purchase_rolls", {
	id: serial().primaryKey().notNull(),
	expenseId: integer("expense_id").notNull(),
	quantity: integer().notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 8, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const stockPurchaseDrinks = pgTable("stock_purchase_drinks", {
	id: serial().primaryKey().notNull(),
	expenseId: integer("expense_id").notNull(),
	drinkName: text("drink_name").notNull(),
	quantity: integer().notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 8, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const stockPurchaseMeat = pgTable("stock_purchase_meat", {
	id: serial().primaryKey().notNull(),
	expenseId: integer("expense_id").notNull(),
	meatType: text("meat_type").notNull(),
	weight: numeric({ precision: 8, scale:  2 }).notNull(),
	pricePerKg: numeric("price_per_kg", { precision: 8, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	otherDetails: text("other_details"),
	date: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const simpleStockForms = pgTable("simple_stock_forms", {
	id: serial().primaryKey().notNull(),
	completedBy: text("completed_by").notNull(),
	shiftType: text("shift_type").notNull(),
	shiftDate: date("shift_date").notNull(),
	startingCash: numeric("starting_cash", { precision: 10, scale:  2 }).default('0'),
	endingCash: numeric("ending_cash", { precision: 10, scale:  2 }).default('0'),
	totalSales: numeric("total_sales", { precision: 10, scale:  2 }).default('0'),
	notes: text(),
	isDraft: boolean("is_draft").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const shiftSummary = pgTable("shift_summary", {
	id: serial().primaryKey().notNull(),
	shiftDate: date("shift_date").notNull(),
	burgersSold: integer("burgers_sold").default(0).notNull(),
	drinksSold: integer("drinks_sold").default(0).notNull(),
	sidesSold: integer("sides_sold").default(0).notNull(),
	extrasSold: integer("extras_sold").default(0).notNull(),
	otherSold: integer("other_sold").default(0).notNull(),
	totalSales: numeric("total_sales", { precision: 10, scale:  2 }).default('0').notNull(),
	totalReceipts: integer("total_receipts").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("shift_summary_shift_date_key").on(table.shiftDate),
]);

export const ingredients = pgTable("ingredients", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	packageSize: numeric("package_size", { precision: 10, scale:  2 }).notNull(),
	unit: text().notNull(),
	supplier: text().notNull(),
	notes: text(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	price: numeric({ precision: 10, scale:  2 }),
	portionSize: numeric("portion_size", { precision: 10, scale:  2 }),
	costPerPortion: numeric("cost_per_portion", { precision: 10, scale:  2 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const uploadedReports = pgTable("uploaded_reports", {
	id: serial().primaryKey().notNull(),
	filename: text().notNull(),
	fileType: text("file_type").notNull(),
	fileData: text("file_data").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	shiftDate: timestamp("shift_date", { mode: 'string' }),
	analysisSummary: jsonb("analysis_summary"),
	userId: integer("user_id"),
	analyzedAt: timestamp("analyzed_at", { mode: 'string' }),
	isAnalyzed: boolean("is_analyzed").default(false),
	compilationSummary: jsonb("compilation_summary"),
});
