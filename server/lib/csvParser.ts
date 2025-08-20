import Papa from 'papaparse';
import { InsertShoppingMaster } from '@shared/schema';

export interface CSVParseResult {
  success: boolean;
  data: InsertShoppingMaster[];
  errors: string[];
  imported: number;
  updated: number;
  deactivated: number;
}

// Normalized category mappings
const NORMALIZED_CATEGORIES = {
  'Drinks': 'Drinks',
  'Fresh Food': 'Fresh Food',
  'Frozen Food': 'Frozen Food',
  'Packaging': 'Packaging',
  'Sauces / Condiments': 'Sauces / Condiments',
  'Dry Goods': 'Dry Goods',
  'Cleaning': 'Cleaning',
  'Other': 'Other'
} as const;

function normalizeCategory(category: string): string {
  const trimmed = category?.trim() || '';
  
  // Direct match
  if (NORMALIZED_CATEGORIES[trimmed as keyof typeof NORMALIZED_CATEGORIES]) {
    return trimmed;
  }
  
  // Case insensitive fuzzy matching
  const lower = trimmed.toLowerCase();
  
  if (lower.includes('drink')) return 'Drinks';
  if (lower.includes('fresh') || lower.includes('food')) return 'Fresh Food';
  if (lower.includes('frozen')) return 'Frozen Food';
  if (lower.includes('packaging')) return 'Packaging';
  if (lower.includes('sauce') || lower.includes('condiment')) return 'Sauces / Condiments';
  if (lower.includes('dry') || lower.includes('good')) return 'Dry Goods';
  if (lower.includes('cleaning')) return 'Cleaning';
  
  return 'Other';
}

function parseCost(costStr: string): number {
  if (!costStr || typeof costStr !== 'string') return 0;
  
  // Remove ฿ symbol and trim
  const cleanCost = costStr.replace(/฿|,/g, '').trim();
  const parsed = parseFloat(cleanCost);
  
  if (isNaN(parsed)) return 0;
  
  // Convert THB to satang (*100)
  return Math.round(parsed * 100);
}

export function parseShoppingCSV(csvContent: string): CSVParseResult {
  const result: CSVParseResult = {
    success: false,
    data: [],
    errors: [],
    imported: 0,
    updated: 0,
    deactivated: 0
  };

  try {
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });

    if (parsed.errors.length > 0) {
      result.errors = parsed.errors.map(err => `Row ${err.row}: ${err.message}`);
      return result;
    }

    const validItems: InsertShoppingMaster[] = [];
    let rowIndex = 0;

    for (const row of parsed.data as any[]) {
      rowIndex++;
      
      // Skip header rows or empty rows
      if (!row.Item || row.Item.trim() === 'Item' || row.Item.trim() === '') {
        continue;
      }

      // Skip excluded items (first 4 beef items as per requirements)
      const internalCat = row['Internal Category']?.trim() || '';
      if (internalCat === 'Not Included Shopping') {
        continue;
      }

      const item = row.Item?.trim();
      const supplier = row.Supplier?.trim() || null;
      const brand = row.Brand?.trim() || null;
      const costStr = row.Cost?.trim() || '';
      const packagingQty = row['Packaging Qty']?.trim() || null;
      const unitMeasure = row['Unit Measurement']?.trim() || null;
      const portionSize = row['Portion Size']?.trim() || null;
      const minStockAmount = row['Minimum Stock Amount'] || row['Minimum Stock']?.trim() || null;

      if (!item) {
        result.errors.push(`Row ${rowIndex}: Missing item name`);
        continue;
      }

      if (!internalCat) {
        result.errors.push(`Row ${rowIndex}: Missing internal category`);
        continue;
      }

      validItems.push({
        item,
        internalCategory: normalizeCategory(internalCat),
        supplier,
        brand,
        costMinor: parseCost(costStr),
        packagingQty,
        unitMeasure,
        portionSize,
        minStockAmount,
        isActive: true
      });
    }

    result.data = validItems;
    result.success = true;
    result.imported = validItems.length;

    return result;

  } catch (error) {
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}