// Stock analysis functions for comparing Loyverse receipts with staff forms

interface ReceiptItem {
  itemName: string;
  quantity: number;
  price: number;
  totalMoney: number;
}

interface StockExpectation {
  item: string;
  expected: number;
  category: string;
}

interface StockDiscrepancy {
  item: string;
  expected: number;
  actual: number;
  difference: number;
  threshold: number;
  isOutOfBounds: boolean;
  alert: string | null;
}

// Map Loyverse menu items to stock ingredients
const MENU_TO_STOCK_MAPPING: Record<string, Array<{ item: string; quantity: number; category: string }>> = {
  // Burgers
  "Smash Burger": [
    { item: "Burger Buns", quantity: 1, category: "packaging" },
    { item: "Beef Patty", quantity: 1, category: "meat" },
    { item: "Cheese", quantity: 1, category: "dairy" },
    { item: "Pickles", quantity: 2, category: "condiments" }
  ],
  "Bacon Burger": [
    { item: "Burger Buns", quantity: 1, category: "packaging" },
    { item: "Beef Patty", quantity: 1, category: "meat" },
    { item: "Bacon", quantity: 2, category: "meat" },
    { item: "Cheese", quantity: 1, category: "dairy" }
  ],
  "Chicken Burger": [
    { item: "Burger Buns", quantity: 1, category: "packaging" },
    { item: "Chicken Fillet", quantity: 1, category: "meat" },
    { item: "Lettuce", quantity: 1, category: "vegetables" }
  ],
  
  // Chicken items
  "Chicken Nuggets": [
    { item: "Chicken Nuggets", quantity: 1, category: "frozen" }
  ],
  "Chicken Wings": [
    { item: "Chicken Wings", quantity: 1, category: "meat" }
  ],
  
  // Sides
  "French Fries": [
    { item: "French Fries", quantity: 1, category: "frozen" }
  ],
  "Sweet Potato Fries": [
    { item: "Sweet Potato Fries", quantity: 1, category: "frozen" }
  ],
  "Onion Rings": [
    { item: "Onion Rings", quantity: 1, category: "frozen" }
  ],
  
  // Drinks
  "Coke": [
    { item: "Coke", quantity: 1, category: "beverages" }
  ],
  "Fanta": [
    { item: "Fanta", quantity: 1, category: "beverages" }
  ],
  "Water": [
    { item: "Water", quantity: 1, category: "beverages" }
  ]
};

export function getExpectedStockFromReceipts(receipts: any[]): StockExpectation[] {
  const stockUsage: Record<string, { quantity: number; category: string }> = {};
  
  for (const receipt of receipts) {
    const lineItems = receipt.lineItems || [];
    
    for (const item of lineItems) {
      const itemName = item.itemName;
      const quantity = item.quantity || 1;
      
      // Map menu item to stock ingredients
      const stockItems = MENU_TO_STOCK_MAPPING[itemName] || [];
      
      for (const stockItem of stockItems) {
        const key = stockItem.item;
        if (!stockUsage[key]) {
          stockUsage[key] = { quantity: 0, category: stockItem.category };
        }
        stockUsage[key].quantity += stockItem.quantity * quantity;
      }
    }
  }
  
  return Object.entries(stockUsage).map(([item, data]) => ({
    item,
    expected: data.quantity,
    category: data.category
  }));
}

export function analyzeStockDiscrepancies(
  expectedStock: StockExpectation[],
  actualStock: Record<string, number> = {}
): StockDiscrepancy[] {
  const discrepancies: StockDiscrepancy[] = [];
  
  for (const expected of expectedStock) {
    const actual = actualStock[expected.item] || 0;
    const difference = actual - expected.expected;
    const threshold = Math.max(5, Math.floor(expected.expected * 0.2)); // 20% or minimum 5
    const isOutOfBounds = Math.abs(difference) > threshold;
    
    let alert: string | null = null;
    if (isOutOfBounds) {
      if (difference > 0) {
        alert = `${difference} units over expected usage`;
      } else {
        alert = `${Math.abs(difference)} units under expected usage`;
      }
    }
    
    discrepancies.push({
      item: expected.item,
      expected: expected.expected,
      actual,
      difference,
      threshold,
      isOutOfBounds,
      alert
    });
  }
  
  return discrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}