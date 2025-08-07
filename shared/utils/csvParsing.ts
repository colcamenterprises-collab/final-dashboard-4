import Papa from 'papaparse';

export interface ParsedIngredientRow {
  label: string;
  name: string;
  unit: string;
  cost: string;
  supplier: string;
  category: string;
  packageSize: string;
  portionSize: string;
}

export const parseCSVtoFormFields = (csvData: string): ParsedIngredientRow[] => {
  const parsed = Papa.parse(csvData.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row: any) => {
    const name = (row['Item'] || '').trim();
    const unit = (row['Portion Unit'] || '').trim();
    const cost = (row['Price (THB)'] || '').trim();
    const supplier = (row['Supplier'] || '').trim();
    const category = (row['Category'] || 'Uncategorized').trim();
    const packageSize = (row['Package Size'] || '').trim();
    const portionSize = (row['Portion Size'] || '').trim();

    return {
      label: `${name} (${unit})`,
      name: name.toLowerCase().replace(/[^a-z0-9]/gi, '_'),
      unit,
      cost,
      supplier,
      category,
      packageSize,
      portionSize,
    };
  }).filter(item => item.name); // Filter out empty rows
};

export const validateIngredientData = (data: ParsedIngredientRow[]): { valid: ParsedIngredientRow[], invalid: any[] } => {
  const valid: ParsedIngredientRow[] = [];
  const invalid: any[] = [];

  data.forEach(item => {
    if (item.name && item.category) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  });

  return { valid, invalid };
};