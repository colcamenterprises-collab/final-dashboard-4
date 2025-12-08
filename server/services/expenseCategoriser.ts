// PATCH — EXPENSES V2 CATEGORISER
export function categoriseExpense(input: string) {
  if (!input) return { category: "Uncategorised", subcategory: null };

  const text = input.toLowerCase();

  if (text.includes("bun") || text.includes("bread") || text.includes("roll"))
    return { category: "Food & Beverage", subcategory: "Buns" };

  if (text.includes("meat") || text.includes("beef"))
    return { category: "Food & Beverage", subcategory: "Meat" };

  if (text.includes("cheese") || text.includes("butter"))
    return { category: "Food & Beverage", subcategory: "Dairy" };

  if (text.includes("coke") || text.includes("water") || text.includes("pepsi"))
    return { category: "Drinks", subcategory: "Soft Drinks" };

  if (text.includes("gas") || text.includes("lpg"))
    return { category: "Utilities", subcategory: "Gas" };

  if (text.includes("clean") || text.includes("soap"))
    return { category: "Cleaning", subcategory: "Supplies" };

  if (text.includes("salary") || text.includes("wage"))
    return { category: "Labour", subcategory: "Wages" };

  return { category: "Uncategorised", subcategory: null };
}
