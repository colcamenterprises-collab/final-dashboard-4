import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { db } from './db';
import { ingredients } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface IngredientCostData {
  name: string;
  supplier: string;
  unitPrice: number;
  packageSize: string;
  unit: string;
  category: string;
}

export async function importIngredientCosts(): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const csvPath = path.resolve(process.cwd(), 'attached_assets/Food and Ingredient Costing - Sheet1_1751622976338.csv');
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const errors: string[] = [];
    let imported = 0;
    
    // Parse CSV manually since this is a complex format
    const lines = fileContent.split('\n');
    
    // Extract data from the CSV structure
    const itemNames = lines[0] ? lines[0].split(',').map(item => item.replace(/"/g, '').trim()) : [];
    const suppliers = lines[9] ? lines[9].split(',').map(item => item.trim()) : [];
    const prices = lines[10] ? lines[10].split(',').map(item => item.replace(/฿/g, '').trim()) : [];
    const sizes = lines[11] ? lines[11].split(',').map(item => item.trim()) : [];
    
    console.log(`Processing ${itemNames.length} ingredients from CSV...`);
    
    for (let i = 0; i < itemNames.length; i++) {
      const rawName = itemNames[i];
      const supplier = suppliers[i] || 'Unknown';
      const priceStr = prices[i];
      const sizeStr = sizes[i];
      
      if (!rawName || !priceStr || !sizeStr) {
        continue; // Skip empty entries
      }
      
      try {
        // Clean and extract ingredient name
        let ingredientName = rawName.split(',')[0].trim();
        if (!ingredientName) continue;
        
        // Parse price
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
          errors.push(`Invalid price for ${ingredientName}: ${priceStr}`);
          continue;
        }
        
        // Determine category based on ingredient name
        let category = 'Ingredients';
        if (ingredientName.toLowerCase().includes('drink') || 
            ingredientName.toLowerCase().includes('coke') || 
            ingredientName.toLowerCase().includes('water') ||
            ingredientName.toLowerCase().includes('juice')) {
          category = 'Beverages';
        } else if (ingredientName.toLowerCase().includes('bag') || 
                   ingredientName.toLowerCase().includes('container') ||
                   ingredientName.toLowerCase().includes('paper') ||
                   ingredientName.toLowerCase().includes('gloves') ||
                   ingredientName.toLowerCase().includes('wrap')) {
          category = 'Packaging';
        } else if (ingredientName.toLowerCase().includes('bacon') || 
                   ingredientName.toLowerCase().includes('chicken') ||
                   ingredientName.toLowerCase().includes('meat')) {
          category = 'Meat';
        } else if (ingredientName.toLowerCase().includes('lettuce') || 
                   ingredientName.toLowerCase().includes('tomato') ||
                   ingredientName.toLowerCase().includes('cabbage') ||
                   ingredientName.toLowerCase().includes('onion')) {
          category = 'Vegetables';
        } else if (ingredientName.toLowerCase().includes('cheese') || 
                   ingredientName.toLowerCase().includes('sauce') ||
                   ingredientName.toLowerCase().includes('mayo') ||
                   ingredientName.toLowerCase().includes('mustard')) {
          category = 'Condiments';
        } else if (ingredientName.toLowerCase().includes('fries') || 
                   ingredientName.toLowerCase().includes('nugget') ||
                   ingredientName.toLowerCase().includes('onion ring')) {
          category = 'Frozen';
        }
        
        // Extract unit from size
        let unit = 'unit';
        if (sizeStr.toLowerCase().includes('kg')) {
          unit = 'kg';
        } else if (sizeStr.toLowerCase().includes('pack')) {
          unit = 'pack';
        } else if (sizeStr.toLowerCase().includes('litre') || sizeStr.toLowerCase().includes('liter')) {
          unit = 'L';
        } else if (sizeStr.toLowerCase().includes('ml')) {
          unit = 'ml';
        } else if (sizeStr.toLowerCase().includes('gm') || sizeStr.toLowerCase().includes('g')) {
          unit = 'g';
        } else if (sizeStr.toLowerCase().includes('slice')) {
          unit = 'slice';
        } else if (sizeStr.toLowerCase().includes('roll')) {
          unit = 'roll';
        }
        
        const ingredientData: IngredientCostData = {
          name: ingredientName,
          supplier: supplier || 'Makro',
          unitPrice: price,
          packageSize: sizeStr,
          unit: unit,
          category: category
        };
        
        // Check if ingredient already exists
        const existingIngredients = await db.select().from(ingredients)
          .where(eq(ingredients.name, ingredientData.name))
          .limit(1);
        
        if (existingIngredients.length === 0) {
          // Insert new ingredient
          await db.insert(ingredients).values({
            name: ingredientData.name,
            category: ingredientData.category,
            unitPrice: ingredientData.unitPrice.toString(),
            packageSize: ingredientData.packageSize,
            unit: ingredientData.unit,
            supplier: ingredientData.supplier,
            notes: `Imported from cost sheet`
          });
          
          imported++;
          console.log(`✅ Imported: ${ingredientData.name} - ฿${ingredientData.unitPrice} per ${ingredientData.packageSize}`);
        } else {
          console.log(`⏭️ Skipped existing: ${ingredientData.name}`);
        }
        
      } catch (error) {
        errors.push(`Error processing ${ingredientName}: ${error}`);
        console.error(`❌ Error processing ${ingredientName}:`, error);
      }
    }
    
    console.log(`🎉 Import completed: ${imported} ingredients imported, ${errors.length} errors`);
    return { success: true, imported, errors };
    
  } catch (error) {
    console.error('❌ Failed to import ingredient costs:', error);
    return { success: false, imported: 0, errors: [String(error)] };
  }
}