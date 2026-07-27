#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import pg from 'pg';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = execFileSync('systemctl', ['show', 'sbb-production.service', '-p', 'Environment', '--value'], { encoding: 'utf8' });
  const match = raw.match(/(?:^|\s)DATABASE_URL=("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/);
  if (!match) throw new Error('DATABASE_URL was not found in sbb-production.service');
  let value = match[1];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  return value.replace(/\\x20/g, ' ');
}

const ingredient = (name, quantityUsed, unitUsed, notes = null) => ({
  name,
  sourceType: 'manual',
  purchasingItemId: null,
  purchasingItemKey: null,
  quantityUsed,
  unitUsed,
  autoUnitCost: null,
  manualOverrideUnitCost: null,
  costingStatus: 'cost_required',
  notes,
});

const recipes = [
  {
    name: 'Loaded Fries', category: 'Review Required', description: 'Recipe card titled Loaded Fries, but the supplied build is a cheeseburger. Imported exactly as a draft for correction.', yieldQuantity: 1, yieldUnit: 'serving',
    ingredients: [ingredient('Toasted bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Pickles',5,'pieces'),ingredient('Raw onion rings',3,'pieces'),ingredient('Meat patty',95,'g','Card weight; current production standard may be 90 g'),ingredient('Cheese slice',1,'slice')],
    instructions: 'Build in card order: toasted bun, burger sauce, pickles, raw onion rings, meat patty, cheese, burger sauce.',
    notes: 'Recipe status: Draft\nREVIEW REQUIRED: The card title says Loaded Fries but the recipe is a burger. For a double cheeseburger add another meat patty with cheese; all other items remain the same.'
  },
  {
    name: 'Karaage Chicken Burger', category: 'Burgers', description: 'Karaage chicken burger with dill pickles, Japanese chilli seasoning and dry coleslaw.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted burger bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Dill pickles',1,'portion','Exact quantity required'),ingredient('Karaage chicken',5,'pieces'),ingredient('Japanese chilli powder',1,'light dusting'),ingredient('Dry coleslaw',1,'portion','No added mayonnaise')],
    instructions: 'Fry 5 pieces of karaage chicken for 4–6 minutes. Lightly dust with Japanese chilli powder immediately after the fryer. Build with bun, burger sauce, dill pickles, chicken, seasoning, dry coleslaw and burger sauce.',
    notes: 'Recipe status: Draft\nConfirm fryer temperature, pickle quantity and standard portion weights.'
  },
  {
    name: 'Chipotle Mayonnaise', category: 'Sauces', description: 'Smoky, mildly spicy chipotle mayonnaise batch.', yieldQuantity: 1, yieldUnit: 'batch',
    ingredients: [ingredient('Mayonnaise',1,'cup'),ingredient('Chipotle hot sauce',2,'tbsp')],
    instructions: 'Mix well and taste. The finished mayonnaise should be darker than plain mayonnaise with a smoky, slightly spicy flavour.',
    notes: 'Recipe status: Draft\nAdd batch yield, serving size, storage container, refrigerated shelf life and date-labelling requirement.'
  },
  {
    name: 'American Cheese Sauce', category: 'Sauces', description: 'Hot American cheese sauce made with milk, paprika and salt.', yieldQuantity: 1, yieldUnit: 'batch',
    ingredients: [ingredient('Milk',0.5,'cup'),ingredient('American cheese',16,'slices'),ingredient('Paprika seasoning',1,'tsp'),ingredient('Salt',0.25,'tsp')],
    instructions: 'Add milk, cheese, paprika and salt to a pot. Stir until the cheese has melted, taking care not to burn it. Keep hot and serve.',
    notes: 'Recipe status: Draft\nAdd heating temperature, hot-holding temperature, batch yield, serving quantity, storage/discard time and reheating rule.'
  },
  {
    name: 'Chicken Fillet Burger', category: 'Burgers', description: 'Chicken fillet burger with salad, tomato, cheese and mayonnaise.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted burger bun',1,'each'),ingredient('Burger sauce',1,'application'),ingredient('Salad',1,'portion','Replace with exact ingredient'),ingredient('Tomato',2,'slices'),ingredient('Chicken fillets',3,'pieces'),ingredient('Cheese',1,'slice'),ingredient('Mayonnaise',1,'application')],
    instructions: 'Cook chicken strips for 4½–5 minutes at 180°C. Add cheese immediately after removing chicken from the fryer. Build in card order and finish with mayonnaise and top bun.',
    notes: 'Recipe status: Draft\nCard alternates between chicken fillets and chicken strips. Confirm exact chicken product, salad ingredient and sauce quantities.'
  },
  {
    name: 'Cheeseburger', category: 'Burgers', description: 'Classic cheeseburger with pickles, burger sauce and melted cheese.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted burger bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Pickles',5,'pieces','Spread evenly'),ingredient('Meat patty',95,'g','Card weight; current production standard may be 90 g'),ingredient('Cheese',1,'slice')],
    instructions: 'Build with toasted bottom bun, burger sauce, 5 pickles spread evenly, meat patty, melted cheese, burger sauce and top bun.',
    notes: 'Recipe status: Draft\nCustomers may add more meat. Confirm final patty standard before approval.'
  },
  {
    name: 'Dirty Fries', category: 'Sides', description: 'Cajun fries loaded with chopped smash patty, cheese sauce, crunchy onions, burger sauce, jalapeños and pickles.', yieldQuantity: 1, yieldUnit: 'serving',
    ingredients: [ingredient('Cajun fries',200,'g','Confirm frozen or cooked weight'),ingredient('Smash burger patty',90,'g','Chopped'),ingredient('Cheese sauce',1,'scoop','Define scoop weight or volume'),ingredient('Crunchy fried onions',1,'scoop','Define scoop weight'),ingredient('Burger sauce',1,'application','Define quantity'),ingredient('Jalapeños',6,'pieces'),ingredient('Pickles',6,'pieces')],
    instructions: 'Prepare fries, top with chopped patty, cheese sauce, crunchy fried onions and burger sauce. Place pickles and jalapeños on top.',
    notes: 'Recipe status: Draft\nConfirm 200 g fries portion and define all scoop/application quantities.'
  },
  {
    name: 'Single Smash Burger', category: 'Burgers', description: 'Single smash burger with salad, tomato, onion, pickles, cheese and burger sauce.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Pickles',5,'pieces'),ingredient('Salad',1,'portion','Replace with exact ingredient'),ingredient('Tomato',2,'slices'),ingredient('Raw onion rings',3,'pieces'),ingredient('Meat patty',95,'g','Card weight; current production standard may be 90 g'),ingredient('Cheese',1,'slice')],
    instructions: 'Build in card order from toasted bottom bun through top bun.',
    notes: 'Recipe status: Draft\nConfirm patty weight, exact salad ingredient and sauce portions.'
  },
  {
    name: 'Double Smash Burger', category: 'Burgers', description: 'Double smash burger with salad, tomato, onion, pickles, two cheese slices and burger sauce.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Pickles',5,'pieces'),ingredient('Salad',1,'portion','Replace with exact ingredient'),ingredient('Tomato',2,'slices'),ingredient('Raw onion rings',3,'pieces'),ingredient('Meat patties',2,'pieces','95 g each on card; current production standard may be 90 g each'),ingredient('Cheese',2,'slices')],
    instructions: 'Build in card order from toasted bottom bun through top bun.',
    notes: 'Recipe status: Draft\nConfirm patty weight, exact salad ingredient and sauce portions.'
  },
  {
    name: 'Triple Smash Burger', category: 'Burgers', description: 'Triple Smash card imported for review; the supplied card incorrectly lists only two patties and two cheese slices.', yieldQuantity: 1, yieldUnit: 'burger',
    ingredients: [ingredient('Toasted bun',1,'each'),ingredient('Burger sauce',2,'applications'),ingredient('Pickles',5,'pieces'),ingredient('Salad',1,'portion','Replace with exact ingredient'),ingredient('Tomato',2,'slices'),ingredient('Raw onion rings',3,'pieces'),ingredient('Meat patties',2,'pieces','Card says 2 x 95 g despite Triple title'),ingredient('Cheese',2,'slices','Card says 2 slices despite Triple title')],
    instructions: 'Build in card order. Do not approve until patty and cheese quantities are corrected.',
    notes: 'Recipe status: Draft\nREVIEW REQUIRED: Triple card lists only 2 patties and 2 cheese slices. Expected final build likely requires 3 patties and 3 cheese slices.'
  },
  {
    name: 'Cheesy Bacon Fries', category: 'Sides', description: 'French fries topped with American cheese sauce, smoked bacon and crunchy fried onions.', yieldQuantity: 1, yieldUnit: 'serving',
    ingredients: [ingredient('French fries',150,'g','Confirm frozen or cooked weight'),ingredient('American cheese sauce',1,'serving spoon','Card notes separately specify 2 serving spoons'),ingredient('Smoked bacon',1,'serving spoon'),ingredient('Crunchy fried onions',1,'portion','Define quantity')],
    instructions: 'Prepare fries, drizzle cheese sauce across the top, then add smoked bacon pieces and crunchy fried onions.',
    notes: 'Recipe status: Draft\nREVIEW REQUIRED: Ingredients list says 1 serving spoon of cheese sauce; notes say 2 serving spoons. Define serving-spoon capacity and confirm final quantity.'
  }
];

const pool = new pg.Pool({ connectionString: loadDatabaseUrl() });
try {
  const columnsResult = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes'");
  const columns = new Set(columnsResult.rows.map(r => r.column_name));
  if (!columns.has('name')) throw new Error('recipes table is unavailable or incompatible');

  await pool.query('BEGIN');
  let created = 0;
  let updated = 0;
  for (const recipe of recipes) {
    const payload = {
      category: recipe.category,
      description: recipe.description,
      yield_quantity: String(recipe.yieldQuantity),
      yield_unit: recipe.yieldUnit,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: recipe.instructions,
      notes: recipe.notes,
      is_active: false,
      total_cost: null,
      cost_per_serving: null,
      selling_price: null,
      suggested_price: null,
      updated_at: new Date(),
    };
    const existing = await pool.query('SELECT id FROM recipes WHERE lower(name)=lower($1) ORDER BY id LIMIT 1', [recipe.name]);
    if (existing.rows[0]) {
      const sets = [];
      const values = [];
      for (const [column, value] of Object.entries(payload)) {
        if (!columns.has(column)) continue;
        values.push(value);
        sets.push(`${column}=$${values.length}`);
      }
      values.push(existing.rows[0].id);
      await pool.query(`UPDATE recipes SET ${sets.join(', ')} WHERE id=$${values.length}`, values);
      updated++;
    } else {
      const entries = [['name', recipe.name], ...Object.entries(payload)].filter(([column]) => columns.has(column));
      const names = entries.map(([column]) => column);
      const values = entries.map(([, value]) => value);
      const placeholders = values.map((_, i) => `$${i + 1}`);
      await pool.query(`INSERT INTO recipes (${names.join(',')}) VALUES (${placeholders.join(',')})`, values);
      created++;
    }
  }
  await pool.query('COMMIT');
  console.log(`PASS recipe cards imported: ${created} created, ${updated} updated, ${recipes.length} total`);
} catch (error) {
  await pool.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await pool.end();
}
