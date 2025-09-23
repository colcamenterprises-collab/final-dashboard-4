import { db } from "../db";
import fs from 'fs';
import path from 'path';

async function updateIngredientsFromCsv() {
  try {
    // Read the CSV file 
    const csvPath = path.resolve(process.cwd(), '..', 'ingredient_master.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV 
    const lines = csvContent.trim().split('\n');
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
      };
      
      if (ingredient.name) {
        ingredientData.push(ingredient);
      }
    }
    
    console.log(`Found ${ingredientData.length} ingredients to update`);
    
    // Update existing ingredients with real data 
    const updatePromises = ingredientData.map(async (ingredient) => {
      try {
        await db.execute({
          sql: `
            UPDATE ingredients 
            SET 
              supplier = $1,
              brand = $2,
              price = $3,
              unit = $4,
              packaging_qty = $5,
              updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(name) = LOWER($6)
          `,
          args: [
            ingredient.supplier,
            ingredient.brand, 
            Number(ingredient.purchaseCost || 0),
            ingredient.purchaseUnit || 'unit',
            `${ingredient.purchaseQty} ${ingredient.purchaseUnit}`,
            ingredient.name
          ]
        });
        console.log(`✅ Updated: ${ingredient.name}`);
      } catch (error) {
        console.error(`❌ Failed to update ${ingredient.name}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`✅ Successfully processed ${ingredientData.length} ingredients`);
    
  } catch (error) {
    console.error('Error updating ingredients:', error);
    throw error;
  }
}

// Run the update
updateIngredientsFromCsv()
  .then(() => {
    console.log('Update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  });