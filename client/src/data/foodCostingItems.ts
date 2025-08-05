// Food costing items loaded from CSV source of truth
// This will be populated from the server endpoint

export interface FoodCostingItem {
  name: string
  supplier: string
  cost: number
  unit: string
  portions: number
  key: string
}

// Default items - will be replaced by CSV data
export const foodCostingItems: FoodCostingItem[] = [
  {
    name: 'Burger Buns',
    supplier: 'Bakery Supply',
    cost: 2.50,
    unit: 'pack',
    portions: 8,
    key: 'burger_buns'
  },
  {
    name: 'Ground Beef',
    supplier: 'Meat Supplier',
    cost: 12.00,
    unit: 'kg',
    portions: 8,
    key: 'ground_beef'
  },
  {
    name: 'Lettuce',
    supplier: 'Fresh Produce',
    cost: 3.00,
    unit: 'head',
    portions: 10,
    key: 'lettuce'
  },
  {
    name: 'Tomatoes',
    supplier: 'Fresh Produce',
    cost: 4.00,
    unit: 'kg',
    portions: 12,
    key: 'tomatoes'
  },
  {
    name: 'Cheese Slices',
    supplier: 'Dairy Supply',
    cost: 8.00,
    unit: 'pack',
    portions: 20,
    key: 'cheese_slices'
  }
]