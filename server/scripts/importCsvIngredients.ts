import { db } from "../db";
import { ingredients } from "../../shared/schema";
import fs from 'fs';
import path from 'path';

async function importIngredientsFromCsv() {
  try {
    // Read the CSV file (it's in the root directory)
    const csvPath = path.resolve(process.cwd(), '..', 'ingredient_master.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV (simple parser for our format)
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    console.log('CSV Headers:', headers);
    
    const ingredientData = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const ingredient = {
        name: values[0]?.trim(),
        category: values[1]?.trim(),
        supplier: values[2]?.trim(),
        brand: values[3]?.trim(),
        purchaseQty: values[4]?.trim(),
        purchaseUnit: values[5]?.trim(),
        purchaseCost: values[6]?.trim(),
        portionUnit: values[7]?.trim() || null,
        portionsPerPurchase: values[8]?.trim() || null,
        portionCost: values[9]?.trim() || null,
        lastReview: values[10]?.trim() || null
      };
      
      if (ingredient.name) {
        ingredientData.push(ingredient);
      }
    }
    
    console.log(`Found ${ingredientData.length} ingredients to import`);
    console.log('First ingredient:', ingredientData[0]);
    
    // Clear existing data and import new data
    console.log('Clearing existing ingredients...');
    await db.delete(ingredients);
    
    // Insert new data
    for (const ingredient of ingredientData) {
      const portionCostCalc = ingredient.portionCost 
        ? Number(ingredient.portionCost)
        : (ingredient.portionsPerPurchase && Number(ingredient.portionsPerPurchase) > 0)
          ? Number(ingredient.purchaseCost) / Number(ingredient.portionsPerPurchase)
          : null;
          
      await db.insert(ingredients).values({
        name: ingredient.name,
        category: ingredient.category,
        supplier: ingredient.supplier,
        brand: ingredient.brand,
        purchaseQty: Number(ingredient.purchaseQty || 1),
        purchaseUnit: ingredient.purchaseUnit || 'unit',
        purchaseCost: Number(ingredient.purchaseCost || 0),
        portionUnit: ingredient.portionUnit,
        portionsPerPurchase: ingredient.portionsPerPurchase ? Number(ingredient.portionsPerPurchase) : null,
        portionCost: portionCostCalc,
        lastReview: ingredient.lastReview ? new Date(ingredient.lastReview) : null,
      });
    }
    
    console.log(`✅ Successfully imported ${ingredientData.length} ingredients`);
    
  } catch (error) {
    console.error('Error importing ingredients:', error);
    throw error;
  }
}

// Run the import
importIngredientsFromCsv()
  .then(() => {
    console.log('Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });