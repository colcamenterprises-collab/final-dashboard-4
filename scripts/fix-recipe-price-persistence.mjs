import fs from 'node:fs';

const path = 'server/routes/recipes.ts';
let source = fs.readFileSync(path, 'utf8');

const postOld = `    add('selling_price', decimalOrNull(sellingPrice));\n    add('suggested_price', decimalOrNull(suggestedPrice));`;
const postNew = `    if (columns.has('selling_price')) add('selling_price', decimalOrNull(sellingPrice));\n    else add('menu_price_thb', decimalOrNull(sellingPrice));\n    if (columns.has('suggested_price')) add('suggested_price', decimalOrNull(suggestedPrice));\n    else if (!columns.has('selling_price')) add('menu_price_thb', decimalOrNull(suggestedPrice));`;

const putOld = `    set('selling_price', decimalOrNull(b.sellingPrice));\n    set('suggested_price', decimalOrNull(b.suggestedPrice));`;
const putNew = `    if (columns.has('selling_price')) set('selling_price', decimalOrNull(b.sellingPrice));\n    else set('menu_price_thb', decimalOrNull(b.sellingPrice));\n    if (columns.has('suggested_price')) set('suggested_price', decimalOrNull(b.suggestedPrice));\n    else if (!columns.has('selling_price')) set('menu_price_thb', decimalOrNull(b.suggestedPrice));`;

if (!source.includes(postOld) && !source.includes(postNew)) {
  throw new Error('POST price persistence block not found');
}
if (!source.includes(putOld) && !source.includes(putNew)) {
  throw new Error('PUT price persistence block not found');
}

source = source.replace(postOld, postNew).replace(putOld, putNew);
fs.writeFileSync(path, source);
console.log('Recipe price persistence patch applied');
