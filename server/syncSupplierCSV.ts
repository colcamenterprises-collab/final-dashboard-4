import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { db } from './db';
import { ingredients } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface SupplierCSVRow {
  'Item ': string;
  'Internal Category': string;
  'Supplier': string;
  'Brand': string;
  'SKU': string;
  'Cost ': string;
  'Packaging Qty': string;
  'Unit Measurement': string;
  'Portion Size': string;
  'Minimum Stock Amount': string;
  'Reviewed Date': string;
  'Notes': string;
}

export interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  totalProcessed: number;
}

export async function syncSupplierCSV(): Promise<SyncResult> {
  const csvPath = path.resolve(process.cwd(), 'attached_assets/Food Costings - Supplier List - Portions - 25.07.2025_1753469470717.csv');
  
  const result: SyncResult = {
    success: false,
    imported: 0,
    updated: 0,
    errors: [],
    totalProcessed: 0
  };

  try {
    if (!fs.existsSync(csvPath)) {
      result.errors.push(`CSV file not found: ${csvPath}`);
      return result;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    const parsed = Papa.parse<SupplierCSVRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      transformHeader: (header) => header.trim()
    });

    if (parsed.errors.length > 0) {
      result.errors.push(...parsed.errors.map(err => err.message));
    }

    console.log(`🔄 Processing ${parsed.data.length} rows from supplier CSV...`);

    for (const row of parsed.data) {
      result.totalProcessed++;

      const itemName = row['Item ']?.trim();
      const category = row['Internal Category']?.trim();
      const supplier = row['Supplier']?.trim();
      const brand = row['Brand']?.trim();
      const costString = row['Cost ']?.trim();
      const packagingQty = row['Packaging Qty']?.trim();
      const unit = row['Unit Measurement']?.trim();
      const portionSizeString = row['Portion Size']?.trim();
      const notes = row['Notes']?.trim();

      // Skip empty rows
      if (!itemName || !category || !costString) {
        continue;
      }

      try {
        // Parse cost (remove ฿ symbol and convert to number)
        const cost = parseFloat(costString.replace(/฿|,/g, ''));
        if (isNaN(cost) || cost <= 0) {
          result.errors.push(`Invalid cost for ${itemName}: ${costString}`);
          continue;
        }

        // Parse packaging quantity and convert to number for calculations
        let packageSizeValue = 1;
        let packageUnit = unit || 'each';
        
        if (packagingQty && packagingQty !== 'N/A') {
          const qtyMatch = packagingQty.match(/(\d+(?:\.\d+)?)\s*(\w+)?/);
          if (qtyMatch) {
            packageSizeValue = parseFloat(qtyMatch[1]);
            if (qtyMatch[2]) {
              packageUnit = qtyMatch[2];
            }
          }
        }

        // Parse portion size
        let portionValue = 0;
        let portionUnit = unit || 'g';
        
        if (portionSizeString && portionSizeString !== 'TBA' && portionSizeString !== 'N/A') {
          const portionMatch = portionSizeString.match(/(\d+(?:\.\d+)?)\s*(\w+)?/);
          if (portionMatch) {
            portionValue = parseFloat(portionMatch[1]);
            if (portionMatch[2]) {
              portionUnit = portionMatch[2];
            }
          }
        }

        // Calculate cost per portion
        let costPerPortion = 0;
        if (portionValue > 0 && packageSizeValue > 0) {
          // Convert units if needed for calculation
          let conversionFactor = 1;
          
          // Handle unit conversions (kg to g, litre to ml, etc.)
          if (packageUnit === 'kg' && portionUnit === 'g') {
            conversionFactor = 1000;
          } else if (packageUnit === 'litre' && portionUnit === 'ml') {
            conversionFactor = 1000;
          } else if (packageUnit === 'L' && portionUnit === 'ml') {
            conversionFactor = 1000;
          }
          
          const portionsPerPackage = (packageSizeValue * conversionFactor) / portionValue;
          costPerPortion = cost / portionsPerPackage;
        }

        // Check if ingredient already exists
        const existing = await db.select().from(ingredients).where(eq(ingredients.name, itemName)).limit(1);

        const ingredientData = {
          name: itemName,
          category: category,
          supplier: supplier || 'Unknown',
          unitPrice: cost, // Legacy field as decimal
          price: cost, // Package price as decimal
          packageSize: packageSizeValue,
          portionSize: portionValue,
          costPerPortion: costPerPortion,
          unit: unit || 'each',
          notes: notes || `${brand ? `Brand: ${brand}` : ''}${portionSizeString ? ` | Portion: ${portionSizeString}` : ''}`.trim(),
          lastUpdated: new Date()
        };

        if (existing.length > 0) {
          // Update existing ingredient
          await db.update(ingredients)
            .set({
              ...ingredientData,
              updatedAt: new Date()
            })
            .where(eq(ingredients.id, existing[0].id));
          result.updated++;
          console.log(`✅ Updated: ${itemName}`);
        } else {
          // Insert new ingredient - remove fields that have defaults
          const insertData = {
            ...ingredientData
            // createdAt and updatedAt will be set by defaults
          };
          
          await db.insert(ingredients).values(insertData);
          result.imported++;
          console.log(`🆕 Added: ${itemName}`);
        }

      } catch (error) {
        const errorMsg = `Error processing ${itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    result.success = true;
    console.log(`✅ CSV sync completed: ${result.imported} imported, ${result.updated} updated, ${result.errors.length} errors`);

  } catch (error) {
    const errorMsg = `Failed to sync CSV: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return result;
}