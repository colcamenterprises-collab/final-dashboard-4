import { randomUUID } from 'crypto';
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const VALID_STATUS = new Set(['Draft', 'Active', 'Archived']);
const VALID_DIFFICULTY = new Set(['Easy', 'Medium', 'Advanced']);

type Ingredient = {
  id?: string;
  name: string;
  brand?: string;
  packDescription?: string;
  packQuantity: number;
  packUnit: string;
  packPrice: number;
  quantityUsed: number;
  usageUnit: string;
  notes?: string;
};

type Step = { id?: string; instruction: string; minutes?: number; imageData?: string };

type RecipePayload = {
  name: string;
  category: string;
  description?: string;
  imageData?: string;
  yieldQuantity: number;
  yieldUnit: string;
  prepMinutes?: number;
  cookMinutes?: number;
  difficulty?: string;
  status?: string;
  directPrice?: number;
  grabPrice?: number;
  targetFoodCostPercent?: number;
  packagingCost?: number;
  labourCost?: number;
  ingredients?: Ingredient[];
  steps?: Step[];
  chefNotes?: string;
  qualityChecks?: string[];
  servingNotes?: string;
};

async function ensureStandaloneRecipeTable() {
  if (!pool) throw new Error('Database unavailable');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS standalone_restaurant_recipes (
      id varchar PRIMARY KEY,
      name text NOT NULL,
      category text NOT NULL,
      description text,
      image_data text,
      yield_quantity numeric(12,3) NOT NULL DEFAULT 1,
      yield_unit text NOT NULL DEFAULT 'servings',
      prep_minutes integer NOT NULL DEFAULT 0,
      cook_minutes integer NOT NULL DEFAULT 0,
      difficulty text NOT NULL DEFAULT 'Easy',
      status text NOT NULL DEFAULT 'Draft',
      direct_price numeric(12,2),
      grab_price numeric(12,2),
      target_food_cost_percent numeric(6,2) NOT NULL DEFAULT 30,
      packaging_cost numeric(12,2) NOT NULL DEFAULT 0,
      labour_cost numeric(12,2) NOT NULL DEFAULT 0,
      ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
      steps jsonb NOT NULL DEFAULT '[]'::jsonb,
      chef_notes text,
      quality_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
      serving_notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS standalone_restaurant_recipes_status_idx
      ON standalone_restaurant_recipes(status);
    CREATE INDEX IF NOT EXISTS standalone_restaurant_recipes_category_idx
      ON standalone_restaurant_recipes(category);
  `);
}

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeUnit(unit: string) {
  const value = String(unit || '').trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(value)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(value)) return 'kg';
  if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(value)) return 'ml';
  if (['l', 'litre', 'liter', 'litres', 'liters'].includes(value)) return 'l';
  if (['each', 'ea', 'piece', 'pieces', 'pc', 'pcs'].includes(value)) return 'each';
  if (['slice', 'slices'].includes(value)) return 'slice';
  if (['can', 'cans'].includes(value)) return 'can';
  if (['bottle', 'bottles'].includes(value)) return 'bottle';
  if (['packet', 'packets', 'pack'].includes(value)) return 'packet';
  return value;
}

function toBaseQuantity(quantity: number, unit: string) {
  const normalized = normalizeUnit(unit);
  if (normalized === 'kg' || normalized === 'l') return quantity * 1000;
  return quantity;
}

function ingredientCost(ingredient: Ingredient) {
  const packQty = numberOrZero(ingredient.packQuantity);
  const packPrice = numberOrZero(ingredient.packPrice);
  const usedQty = numberOrZero(ingredient.quantityUsed);
  if (packQty <= 0 || packPrice < 0 || usedQty < 0) return 0;
  const packUnit = normalizeUnit(ingredient.packUnit);
  const usageUnit = normalizeUnit(ingredient.usageUnit);
  const compatible =
    packUnit === usageUnit ||
    (['g', 'kg'].includes(packUnit) && ['g', 'kg'].includes(usageUnit)) ||
    (['ml', 'l'].includes(packUnit) && ['ml', 'l'].includes(usageUnit));
  if (!compatible) return 0;
  const basePackQty = toBaseQuantity(packQty, packUnit);
  const baseUsedQty = toBaseQuantity(usedQty, usageUnit);
  return basePackQty > 0 ? (packPrice / basePackQty) * baseUsedQty : 0;
}

function calculate(recipe: any) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const totalIngredients = ingredients.reduce((sum: number, ingredient: Ingredient) => sum + ingredientCost(ingredient), 0);
  const packaging = numberOrZero(recipe.packagingCost ?? recipe.packaging_cost);
  const labour = numberOrZero(recipe.labourCost ?? recipe.labour_cost);
  const totalBatchCost = totalIngredients + packaging + labour;
  const yieldQuantity = Math.max(numberOrZero(recipe.yieldQuantity ?? recipe.yield_quantity), 1);
  const costPerServing = totalBatchCost / yieldQuantity;
  const directPrice = numberOrZero(recipe.directPrice ?? recipe.direct_price);
  const grabPrice = numberOrZero(recipe.grabPrice ?? recipe.grab_price);
  const targetFoodCost = Math.max(numberOrZero(recipe.targetFoodCostPercent ?? recipe.target_food_cost_percent) || 30, 1);
  const suggestedDirectPrice = costPerServing / (targetFoodCost / 100);
  const suggestedGrabPrice = suggestedDirectPrice;
  const foodCostPercentDirect = directPrice > 0 ? (costPerServing / directPrice) * 100 : null;
  const foodCostPercentGrab = grabPrice > 0 ? (costPerServing / grabPrice) * 100 : null;
  const directProfit = directPrice > 0 ? directPrice - costPerServing : null;
  const grabProfit = grabPrice > 0 ? grabPrice - costPerServing : null;
  return {
    totalIngredients,
    totalBatchCost,
    costPerServing,
    suggestedDirectPrice,
    suggestedGrabPrice,
    foodCostPercentDirect,
    foodCostPercentGrab,
    directProfit,
    grabProfit,
    directMarginPercent: directPrice > 0 ? ((directPrice - costPerServing) / directPrice) * 100 : null,
    grabMarginPercent: grabPrice > 0 ? ((grabPrice - costPerServing) / grabPrice) * 100 : null,
  };
}

function rowToRecipe(row: any) {
  const recipe = {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    imageData: row.image_data || '',
    yieldQuantity: Number(row.yield_quantity || 1),
    yieldUnit: row.yield_unit || 'servings',
    prepMinutes: Number(row.prep_minutes || 0),
    cookMinutes: Number(row.cook_minutes || 0),
    totalMinutes: Number(row.prep_minutes || 0) + Number(row.cook_minutes || 0),
    difficulty: row.difficulty || 'Easy',
    status: row.status || 'Draft',
    directPrice: row.direct_price == null ? null : Number(row.direct_price),
    grabPrice: row.grab_price == null ? null : Number(row.grab_price),
    targetFoodCostPercent: Number(row.target_food_cost_percent || 30),
    packagingCost: Number(row.packaging_cost || 0),
    labourCost: Number(row.labour_cost || 0),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    chefNotes: row.chef_notes || '',
    qualityChecks: Array.isArray(row.quality_checks) ? row.quality_checks : [],
    servingNotes: row.serving_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return { ...recipe, metrics: calculate(recipe) };
}

function validatePayload(body: any): RecipePayload {
  const name = String(body?.name || '').trim();
  const category = String(body?.category || '').trim();
  if (!name) throw new Error('Recipe name is required');
  if (!category) throw new Error('Category is required');
  const status = VALID_STATUS.has(body?.status) ? body.status : 'Draft';
  const difficulty = VALID_DIFFICULTY.has(body?.difficulty) ? body.difficulty : 'Easy';
  const ingredients = Array.isArray(body?.ingredients)
    ? body.ingredients.map((ingredient: any) => ({
        id: ingredient.id || randomUUID(),
        name: String(ingredient.name || '').trim(),
        brand: String(ingredient.brand || '').trim(),
        packDescription: String(ingredient.packDescription || '').trim(),
        packQuantity: numberOrZero(ingredient.packQuantity),
        packUnit: String(ingredient.packUnit || '').trim(),
        packPrice: numberOrZero(ingredient.packPrice),
        quantityUsed: numberOrZero(ingredient.quantityUsed),
        usageUnit: String(ingredient.usageUnit || '').trim(),
        notes: String(ingredient.notes || '').trim(),
      })).filter((ingredient: Ingredient) => ingredient.name)
    : [];
  const steps = Array.isArray(body?.steps)
    ? body.steps.map((step: any) => ({
        id: step.id || randomUUID(),
        instruction: String(step.instruction || '').trim(),
        minutes: numberOrZero(step.minutes),
        imageData: String(step.imageData || ''),
      })).filter((step: Step) => step.instruction)
    : [];
  const qualityChecks = Array.isArray(body?.qualityChecks)
    ? body.qualityChecks.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : [];
  return {
    name,
    category,
    description: String(body?.description || '').trim(),
    imageData: String(body?.imageData || ''),
    yieldQuantity: Math.max(numberOrZero(body?.yieldQuantity) || 1, 0.001),
    yieldUnit: String(body?.yieldUnit || 'servings').trim(),
    prepMinutes: Math.max(Math.round(numberOrZero(body?.prepMinutes)), 0),
    cookMinutes: Math.max(Math.round(numberOrZero(body?.cookMinutes)), 0),
    difficulty,
    status,
    directPrice: body?.directPrice === '' || body?.directPrice == null ? undefined : numberOrZero(body.directPrice),
    grabPrice: body?.grabPrice === '' || body?.grabPrice == null ? undefined : numberOrZero(body.grabPrice),
    targetFoodCostPercent: Math.max(numberOrZero(body?.targetFoodCostPercent) || 30, 1),
    packagingCost: Math.max(numberOrZero(body?.packagingCost), 0),
    labourCost: Math.max(numberOrZero(body?.labourCost), 0),
    ingredients,
    steps,
    chefNotes: String(body?.chefNotes || '').trim(),
    qualityChecks,
    servingNotes: String(body?.servingNotes || '').trim(),
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureStandaloneRecipeTable();
    const result = await pool!.query('SELECT * FROM standalone_restaurant_recipes ORDER BY updated_at DESC, name ASC');
    res.json({ ok: true, rows: result.rows.map(rowToRecipe), source: 'standalone_restaurant_recipes' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureStandaloneRecipeTable();
    const result = await pool!.query('SELECT * FROM standalone_restaurant_recipes WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Recipe not found' });
    res.json({ ok: true, recipe: rowToRecipe(result.rows[0]) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureStandaloneRecipeTable();
    const body = validatePayload(req.body);
    const id = randomUUID();
    const result = await pool!.query(
      `INSERT INTO standalone_restaurant_recipes (
        id, name, category, description, image_data, yield_quantity, yield_unit,
        prep_minutes, cook_minutes, difficulty, status, direct_price, grab_price,
        target_food_cost_percent, packaging_cost, labour_cost, ingredients, steps,
        chef_notes, quality_checks, serving_notes, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21,now())
      RETURNING *`,
      [id, body.name, body.category, body.description || null, body.imageData || null, body.yieldQuantity,
       body.yieldUnit, body.prepMinutes || 0, body.cookMinutes || 0, body.difficulty, body.status,
       body.directPrice ?? null, body.grabPrice ?? null, body.targetFoodCostPercent || 30,
       body.packagingCost || 0, body.labourCost || 0, JSON.stringify(body.ingredients || []),
       JSON.stringify(body.steps || []), body.chefNotes || null, JSON.stringify(body.qualityChecks || []),
       body.servingNotes || null]
    );
    res.status(201).json({ ok: true, recipe: rowToRecipe(result.rows[0]) });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureStandaloneRecipeTable();
    const body = validatePayload(req.body);
    const result = await pool!.query(
      `UPDATE standalone_restaurant_recipes SET
        name=$2, category=$3, description=$4, image_data=$5, yield_quantity=$6, yield_unit=$7,
        prep_minutes=$8, cook_minutes=$9, difficulty=$10, status=$11, direct_price=$12,
        grab_price=$13, target_food_cost_percent=$14, packaging_cost=$15, labour_cost=$16,
        ingredients=$17::jsonb, steps=$18::jsonb, chef_notes=$19, quality_checks=$20::jsonb,
        serving_notes=$21, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [req.params.id, body.name, body.category, body.description || null, body.imageData || null,
       body.yieldQuantity, body.yieldUnit, body.prepMinutes || 0, body.cookMinutes || 0,
       body.difficulty, body.status, body.directPrice ?? null, body.grabPrice ?? null,
       body.targetFoodCostPercent || 30, body.packagingCost || 0, body.labourCost || 0,
       JSON.stringify(body.ingredients || []), JSON.stringify(body.steps || []), body.chefNotes || null,
       JSON.stringify(body.qualityChecks || []), body.servingNotes || null]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Recipe not found' });
    res.json({ ok: true, recipe: rowToRecipe(result.rows[0]) });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureStandaloneRecipeTable();
    const result = await pool!.query(
      `UPDATE standalone_restaurant_recipes SET status='Archived', updated_at=now() WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Recipe not found' });
    res.json({ ok: true, id: result.rows[0].id, status: 'Archived' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
