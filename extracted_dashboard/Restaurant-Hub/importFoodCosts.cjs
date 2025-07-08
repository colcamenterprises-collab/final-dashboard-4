const fs = require('fs');
const path = require('path');

// Simple CSV parsing for the food costs data
const csvPath = path.resolve(__dirname, 'attached_assets/Food and Ingredient Costing - Sheet1_1751622976338.csv');
const fileContent = fs.readFileSync(csvPath, 'utf-8');
const lines = fileContent.split('\n');

// Extract data from the CSV structure
const itemNames = lines[0] ? lines[0].split(',').map(item => item.replace(/"/g, '').replace(/\n/g, ' ').trim()) : [];
const suppliers = lines[9] ? lines[9].split(',').map(item => item.trim()) : [];
const prices = lines[10] ? lines[10].split(',').map(item => item.replace(/฿/g, '').trim()) : [];
const sizes = lines[11] ? lines[11].split(',').map(item => item.trim()) : [];

console.log('=== FOOD COST DATA EXTRACTED ===');
console.log(`Found ${itemNames.length} items`);

// Create structured ingredient data
const ingredients = [];

for (let i = 0; i < itemNames.length; i++) {
  const rawName = itemNames[i];
  const supplier = suppliers[i] || 'Unknown';
  const priceStr = prices[i];
  const sizeStr = sizes[i];
  
  if (!rawName || !priceStr || !sizeStr || priceStr === '' || sizeStr === '') {
    continue;
  }
  
  // Clean and extract ingredient name
  let ingredientName = rawName.split(',')[0].trim();
  if (!ingredientName || ingredientName.length < 2) continue;
  
  // Parse price
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    console.log(`❌ Invalid price for ${ingredientName}: ${priceStr}`);
    continue;
  }
  
  // Determine category based on ingredient name
  let category = 'Ingredients';
  const nameLower = ingredientName.toLowerCase();
  if (nameLower.includes('drink') || nameLower.includes('coke') || nameLower.includes('water') || nameLower.includes('juice') || nameLower.includes('sprite') || nameLower.includes('fanta')) {
    category = 'Beverages';
  } else if (nameLower.includes('bag') || nameLower.includes('container') || nameLower.includes('paper') || nameLower.includes('gloves') || nameLower.includes('wrap') || nameLower.includes('foil')) {
    category = 'Packaging';
  } else if (nameLower.includes('bacon') || nameLower.includes('chicken') || nameLower.includes('meat')) {
    category = 'Meat';
  } else if (nameLower.includes('lettuce') || nameLower.includes('tomato') || nameLower.includes('cabbage') || nameLower.includes('onion')) {
    category = 'Vegetables';
  } else if (nameLower.includes('cheese') || nameLower.includes('sauce') || nameLower.includes('mayo') || nameLower.includes('mustard') || nameLower.includes('pickle')) {
    category = 'Condiments';
  } else if (nameLower.includes('fries') || nameLower.includes('nugget') || nameLower.includes('onion ring')) {
    category = 'Frozen';
  }
  
  // Extract unit from size
  let unit = 'unit';
  const sizeLower = sizeStr.toLowerCase();
  if (sizeLower.includes('kg')) {
    unit = 'kg';
  } else if (sizeLower.includes('pack')) {
    unit = 'pack';
  } else if (sizeLower.includes('litre') || sizeLower.includes('liter')) {
    unit = 'L';
  } else if (sizeLower.includes('ml')) {
    unit = 'ml';
  } else if (sizeLower.includes('gm') || sizeLower.includes('g ')) {
    unit = 'g';
  } else if (sizeLower.includes('slice')) {
    unit = 'slice';
  } else if (sizeLower.includes('roll')) {
    unit = 'roll';
  }
  
  const ingredient = {
    name: ingredientName,
    supplier: supplier || 'Makro',
    unitPrice: price,
    packageSize: sizeStr,
    unit: unit,
    category: category
  };
  
  ingredients.push(ingredient);
  console.log(`✅ ${ingredient.name} - ฿${ingredient.unitPrice} per ${ingredient.packageSize} (${ingredient.category})`);
}

console.log('\n=== SUMMARY ===');
console.log(`Successfully parsed ${ingredients.length} ingredients`);

// Group by category for summary
const categoryGroups = ingredients.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {});

console.log('\nCategory breakdown:');
Object.keys(categoryGroups).forEach(category => {
  console.log(`- ${category}: ${categoryGroups[category].length} items`);
});

// Generate SQL INSERT statements
console.log('\n=== SQL INSERT STATEMENTS ===');
ingredients.forEach(ingredient => {
  const sql = `INSERT INTO ingredients (name, category, unit_price, package_size, unit, supplier, notes) VALUES ('${ingredient.name.replace(/'/g, "''")}', '${ingredient.category}', '${ingredient.unitPrice}', '${ingredient.packageSize.replace(/'/g, "''")}', '${ingredient.unit}', '${ingredient.supplier}', 'Imported from cost sheet');`;
  console.log(sql);
});

console.log('\n=== DONE ===');