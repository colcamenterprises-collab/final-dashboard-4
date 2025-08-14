// ==============================
// ENUMS
// ==============================

export enum ExpenseType {
  FOOD = "Food",
  FB = "F&B",
  BEVERAGE = "Beverage",
  STAFF_BONUS = "Staff Expenses (Bonus Pay)",
  STAFF_ACCOUNT = "Staff Expenses (from Account)",
  RENT = "Rent",
  ADMINISTRATION = "Administration",
  ADVERTISING_GRAB = "Advertising - Grab",
  ADVERTISING_OTHER = "Advertising - Other",
  DELIVERY_FEE_DISCOUNT = "Delivery Fee Discount (Merchant-Funded)",
  DIRECTOR_PAYMENT = "Director Payment",
  DISCOUNT_MERCHANT_FUNDED = "Discount (Merchant-Funded)",
  FITTINGS = "Fittings",
  KITCHEN_SUPPLIES = "Kitchen Supplies or Packaging",
  MARKETING = "Marketing",
  MARKETING_SUCCESS_FEE = "Marketing success fee",
  MISC = "Misc",
  PRINTERS = "Printers",
  RENOVATIONS = "Renovations",
  SUBSCRIPTIONS = "Subscriptions",
  STATIONARY = "Stationary",
  TRAVEL = "Travel",
  UTILITIES = "Utilities",
  UNKNOWN = "Unknown"
}

export enum ShopName {
  MAKRO = "Makro",
  MR_DIY = "Mr DIY",
  BAKERY = "Bakery",
  BIG_C = "Big C",
  PRINTERS = "Printers",
  SUPERCHEAP = "Supercheap",
  BURGER_BOXES = "Burger Boxes",
  CAMERON = "Cameron",
  COLIN = "Colin",
  DTAC = "DTAC",
  COMPANY_EXPENSE = "Company Expense",
  GAS = "Gas",
  GO_WHOLESALE = "GO Wholesale",
  GRAB_MERCHANT = "Grab Merchant",
  HOMEPRO = "HomePro",
  LANDLORD = "Landlord",
  LAWYER = "Lawyer",
  LAZADA = "Lazada",
  LOTUS = "Lotus",
  LOYVERSE = "Loyverse",
  MEA = "MEA",
  AIS = "AIS",
  OTHER = "Other"
}

export enum PnLCategory {
  FOOD_BEVERAGE = "Food & Beverage",
  PAYROLL = "Payroll",
  OCCUPANCY = "Occupancy",
  OFFICE_EXPENSE = "Office Expense",
  MARKETING = "Marketing",
  OWNER_DRAWINGS = "Owner Drawings / Non-Op Expense",
  REPAIRS_MAINTENANCE = "Repairs & Maintenance",
  MISCELLANEOUS = "Miscellaneous",
  TRAVEL = "Travel",
  UTILITIES = "Utilities",
  UNKNOWN = "Unknown"
}

// ==============================
// SHOP NAME DEFAULT MAPPING
// ==============================

export const shopNameToExpenseType: Record<ShopName, ExpenseType> = {
  [ShopName.MAKRO]: ExpenseType.FOOD,
  [ShopName.MR_DIY]: ExpenseType.KITCHEN_SUPPLIES,
  [ShopName.BAKERY]: ExpenseType.FOOD,
  [ShopName.BIG_C]: ExpenseType.FOOD,
  [ShopName.PRINTERS]: ExpenseType.PRINTERS,
  [ShopName.SUPERCHEAP]: ExpenseType.FOOD,
  [ShopName.BURGER_BOXES]: ExpenseType.KITCHEN_SUPPLIES,
  [ShopName.CAMERON]: ExpenseType.DIRECTOR_PAYMENT,
  [ShopName.COLIN]: ExpenseType.DIRECTOR_PAYMENT,
  [ShopName.DTAC]: ExpenseType.UTILITIES,
  [ShopName.COMPANY_EXPENSE]: ExpenseType.MISC,
  [ShopName.GAS]: ExpenseType.UTILITIES,
  [ShopName.GO_WHOLESALE]: ExpenseType.FOOD,
  [ShopName.GRAB_MERCHANT]: ExpenseType.ADVERTISING_GRAB,
  [ShopName.HOMEPRO]: ExpenseType.KITCHEN_SUPPLIES,
  [ShopName.LANDLORD]: ExpenseType.RENT,
  [ShopName.LAWYER]: ExpenseType.ADMINISTRATION,
  [ShopName.LAZADA]: ExpenseType.KITCHEN_SUPPLIES,
  [ShopName.LOTUS]: ExpenseType.FOOD,
  [ShopName.LOYVERSE]: ExpenseType.SUBSCRIPTIONS,
  [ShopName.MEA]: ExpenseType.UTILITIES,
  [ShopName.AIS]: ExpenseType.UTILITIES,
  [ShopName.OTHER]: ExpenseType.MISC
};

// ==============================
// EXPENSE TYPE → P&L CATEGORY
// ==============================

export const expenseTypeToPnLCategory: Record<ExpenseType, PnLCategory> = {
  [ExpenseType.FOOD]: PnLCategory.FOOD_BEVERAGE,
  [ExpenseType.FB]: PnLCategory.FOOD_BEVERAGE,
  [ExpenseType.BEVERAGE]: PnLCategory.FOOD_BEVERAGE,
  [ExpenseType.KITCHEN_SUPPLIES]: PnLCategory.FOOD_BEVERAGE,
  [ExpenseType.STAFF_BONUS]: PnLCategory.PAYROLL,
  [ExpenseType.STAFF_ACCOUNT]: PnLCategory.PAYROLL,
  [ExpenseType.RENT]: PnLCategory.OCCUPANCY,
  [ExpenseType.ADMINISTRATION]: PnLCategory.OFFICE_EXPENSE,
  [ExpenseType.ADVERTISING_GRAB]: PnLCategory.MARKETING,
  [ExpenseType.ADVERTISING_OTHER]: PnLCategory.MARKETING,
  [ExpenseType.DELIVERY_FEE_DISCOUNT]: PnLCategory.MARKETING,
  [ExpenseType.DIRECTOR_PAYMENT]: PnLCategory.OWNER_DRAWINGS,
  [ExpenseType.DISCOUNT_MERCHANT_FUNDED]: PnLCategory.MARKETING,
  [ExpenseType.FITTINGS]: PnLCategory.REPAIRS_MAINTENANCE,
  [ExpenseType.MARKETING]: PnLCategory.MARKETING,
  [ExpenseType.MARKETING_SUCCESS_FEE]: PnLCategory.MARKETING,
  [ExpenseType.MISC]: PnLCategory.MISCELLANEOUS,
  [ExpenseType.PRINTERS]: PnLCategory.OFFICE_EXPENSE,
  [ExpenseType.RENOVATIONS]: PnLCategory.REPAIRS_MAINTENANCE,
  [ExpenseType.SUBSCRIPTIONS]: PnLCategory.OFFICE_EXPENSE,
  [ExpenseType.STATIONARY]: PnLCategory.OFFICE_EXPENSE,
  [ExpenseType.TRAVEL]: PnLCategory.TRAVEL,
  [ExpenseType.UTILITIES]: PnLCategory.UTILITIES,
  [ExpenseType.UNKNOWN]: PnLCategory.UNKNOWN
};

// ==============================
// HELPER FUNCTIONS
// ==============================

export function getExpenseMapping(shopName: string) {
  const shop = Object.values(ShopName).find(s => s === shopName) as ShopName;
  const expenseType = shop ? shopNameToExpenseType[shop] : ExpenseType.UNKNOWN;
  const pnlCategory = expenseTypeToPnLCategory[expenseType] || PnLCategory.UNKNOWN;
  return { expenseType, pnlCategory };
}

// Convert enum values to arrays for frontend dropdowns
export const EXPENSE_TYPE_OPTIONS = Object.values(ExpenseType).filter(type => type !== ExpenseType.UNKNOWN);
export const SHOP_NAME_OPTIONS = Object.values(ShopName);
export const PNL_CATEGORY_OPTIONS = Object.values(PnLCategory).filter(cat => cat !== PnLCategory.UNKNOWN);