import fs from "fs";
import csv from "csv-parser";
import { db } from "../db";
import { ingredients } from "../../shared/schema";

async function seedIngredients() {
  const rows: any[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream("ingredient_master.csv")
      .pipe(csv())
      .on("data", (row) => {
        rows.push({
          name: row.Ingredient,
          category: row.Category,
          supplier: row.Supplier,
          brand: row.Brand,
          purchaseQty: parseFloat(row.Purchase_Qty) || 0,
          purchaseUnit: row.Purchase_Unit,
          purchaseCost: parseFloat(row.Purchase_Cost) || 0,
          portionUnit: row.Portion_Unit || null,
          portionsPerPurchase: row.Portions_Per_Purchase
            ? parseInt(row.Portions_Per_Purchase)
            : null,
          portionCost: row.Portion_Cost
            ? parseFloat(row.Portion_Cost)
            : row.Portions_Per_Purchase
              ? parseFloat(row.Purchase_Cost) / parseInt(row.Portions_Per_Purchase)
              : null,
        });
      })
      .on("end", async () => {
        try {
          await db.insert(ingredients).values(rows).onConflictDoNothing();
          console.log(`✅ Seeded ${rows.length} ingredients`);
          resolve();
        } catch (err) {
          console.error("❌ Error seeding ingredients", err);
          reject(err);
        }
      });
  });
}

if (require.main === module) {
  seedIngredients().then(() => {
    console.log("Ingredient seeding completed");
    process.exit(0);
  }).catch((err) => {
    console.error("Ingredient seeding failed:", err);
    process.exit(1);
  });
}

export { seedIngredients };