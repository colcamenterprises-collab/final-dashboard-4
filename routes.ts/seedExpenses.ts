import { db } from "./db";
import { expenseTypeLkp, supplierLkp } from "../shared/schema";
import { eq } from "drizzle-orm";

const TYPES = [
  "Food","F&B","Beverage","Staff Expenses (Bonus Pay)","Staff Expenses (from Account)",
  "Rent","Administration","Advertising - Grab","Advertising - Other",
  "Delivery Fee Discount (Merchant-Funded)","Director Payment",
  "Discount (Merchant-Funded)","Fittings","Kitchen Supplies or Packaging",
  "Marketing","Marketing success fee","Misc","Printers","Renovations",
  "Subscriptions","Stationary","Travel","Utilities",
];

const SUPPLIERS = [
  "Makro","Mr DIY","Bakery","Big C","Printers","Supercheap","Burger Boxes",
  "Cameron","Colin","DTAC","Company Expense","Gas","GO Wholesale","Grab Merchant",
  "HomePro","Landlord","Lawyer","Lazada","Lotus","Loyverse","MEA","AIS","Other",
];

export async function seedExpenseData() {
  try {
    console.log("Seeding expense types and suppliers...");

    // Seed expense types
    for (const name of TYPES) {
      const existing = await db.select().from(expenseTypeLkp).where(eq(expenseTypeLkp.name, name)).limit(1);
      if (existing.length === 0) {
        await db.insert(expenseTypeLkp).values({ name, active: true });
        console.log(`Added expense type: ${name}`);
      } else {
        await db.update(expenseTypeLkp)
          .set({ active: true })
          .where(eq(expenseTypeLkp.name, name));
      }
    }

    // Seed suppliers
    for (const name of SUPPLIERS) {
      const existing = await db.select().from(supplierLkp).where(eq(supplierLkp.name, name)).limit(1);
      if (existing.length === 0) {
        await db.insert(supplierLkp).values({ name, active: true });
        console.log(`Added supplier: ${name}`);
      } else {
        await db.update(supplierLkp)
          .set({ active: true })
          .where(eq(supplierLkp.name, name));
      }
    }

    console.log("✅ Expense types and suppliers seeded successfully");
    return { success: true, typesCount: TYPES.length, suppliersCount: SUPPLIERS.length };
  } catch (error) {
    console.error("❌ Error seeding expense data:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedExpenseData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}