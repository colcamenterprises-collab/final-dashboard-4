// Enhanced Recipes routes with comprehensive functionality
// ARCHITECTURE CONTRACT (LOCKED): Recipes/Costing are standalone. Do not import/query purchasing.

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { pool } from "../db";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import sharp from 'sharp';
import { loadCatalogFromCSV } from "../lib/stockCatalog";

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Helper functions
function cleanMoney(v: any) {
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

const LOCKED_RECIPE_TEMPLATES = [
  { name: "Cheesy Bacon Fries", sku: "10010", category: "Side Orders", salePrice: 119 },
  { name: "Coleslaw with Bacon", sku: "10025", category: "Side Orders", salePrice: 99 },
  { name: "Crispy Chicken Fillet Burger", sku: "10066", category: "Smash Burgers", salePrice: 169 },
  { name: "Dirty Fries", sku: "10045", category: "Side Orders", salePrice: 249 },
  { name: "Karaage Chicken Burger", sku: "10070", category: "Smash Burgers", salePrice: 249 },
  { name: "Kids Double Cheeseburger", sku: "10017", category: "Kids Will Love This", salePrice: 189 },
  { name: "Kids Single Cheeseburger", sku: "10015", category: "Kids Will Love This", salePrice: 149 },
  { name: "Loaded Fries (Original)", sku: "10035", category: "Side Orders", salePrice: 170 },
  { name: "Single Smash Burger", sku: "10004", category: "Smash Burgers", salePrice: 170 },
  { name: "Super Double Bacon and Cheese", sku: "10019", category: "Smash Burgers", salePrice: 240 },
  { name: "Triple Smash Burger", sku: "10009", category: "Smash Burgers", salePrice: 320 },
  { name: "Ultimate Double", sku: "10006", category: "Smash Burgers", salePrice: 220 },
] as const;

const META_PREFIX = "RECIPE_CALC_V2:";

function parseRecipeMeta(notes: string | null | undefined) {
  if (!notes || !notes.startsWith(META_PREFIX)) return {} as any;
  try {
    return JSON.parse(notes.slice(META_PREFIX.length));
  } catch {
    return {} as any;
  }
}

function buildRecipeMeta(meta: any) {
  return `${META_PREFIX}${JSON.stringify(meta ?? {})}`;
}

type LockedTemplate = (typeof LOCKED_RECIPE_TEMPLATES)[number];

function buildTemplateNotesPayload(template: LockedTemplate) {
  return buildRecipeMeta({
    sku: template.sku,
    servingsThisRecipeMakes: 0,
    servingsPerProduct: 0,
    productsMade: 1,
    ingredients: [],
    packaging: [],
    labour: [],
    other: [],
    imageUrl: "",
  });
}

async function upsertLockedRecipeTemplate(template: LockedTemplate) {
  const notesPayload = buildTemplateNotesPayload(template);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`recipe_template_sku:${template.sku}`]);

    const existing = await client.query(`
      SELECT id, notes FROM recipes
      WHERE notes LIKE $1
      ORDER BY id ASC
      LIMIT 1
    `, [`${META_PREFIX}%\"sku\":\"${template.sku}\"%`]);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE recipes
         SET name = $2, category = $3, suggested_price = $4,
             notes = CASE WHEN notes LIKE $5 THEN notes ELSE $6 END,
             updated_at = now(), is_active = true
         WHERE id = $1`,
        [existing.rows[0].id, template.name, template.category, template.salePrice, `${META_PREFIX}%`, notesPayload],
      );
      await client.query('COMMIT');
      return 'updated' as const;
    }

    await client.query(
      `INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, suggested_price, notes, image_url, is_active, created_at, updated_at
      ) VALUES ($1, '', $2, 1, 'servings', '[]'::jsonb, 0, 0, $3, $4, '', true, now(), now())`,
      [template.name, template.category, template.salePrice, notesPayload],
    );

    await client.query('COMMIT');
    return 'created' as const;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedLockedRecipeTemplates() {
  await initTables();
  for (const template of LOCKED_RECIPE_TEMPLATES) {
    await upsertLockedRecipeTemplate(template);
  }
}

async function ensureLockedRecipeTemplates() {
  await initTables();
  let created = 0;
  let updated = 0;

  for (const template of LOCKED_RECIPE_TEMPLATES) {
    const operation = await upsertLockedRecipeTemplate(template);
    if (operation === 'created') created += 1;
    if (operation === 'updated') updated += 1;
  }

  return {
    ok: true,
    ensured: LOCKED_RECIPE_TEMPLATES.length,
    created,
    updated,
  };
}

// Initialize enhanced recipes table
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Burgers',
      yield_quantity NUMERIC DEFAULT 1,
      yield_unit TEXT DEFAULT 'servings',
      ingredients JSONB DEFAULT '[]',
      total_cost NUMERIC DEFAULT 0,
      cost_per_serving NUMERIC DEFAULT 0,
      cogs_percent NUMERIC DEFAULT 0,
      suggested_price NUMERIC DEFAULT 0,
      waste_factor NUMERIC DEFAULT 0.05,
      yield_efficiency NUMERIC DEFAULT 0.90,
      image_url TEXT,
      instructions TEXT,
      notes TEXT,
      allergens JSONB DEFAULT '[]',
      nutritional JSONB DEFAULT '{}',
      version INTEGER DEFAULT 1,
      parent_id BIGINT REFERENCES recipes(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipe_lines (
      id BIGSERIAL PRIMARY KEY,
      recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id TEXT,
      ingredient_name TEXT NOT NULL,
      qty NUMERIC NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      unit_cost_thb NUMERIC NOT NULL DEFAULT 0,
      cost_thb NUMERIC NOT NULL DEFAULT 0,
      waste_percentage NUMERIC NOT NULL DEFAULT 5,
      supplier TEXT
    )
  `);
}

// PATCH D: CSV Export endpoint
// GET /api/recipes/export/csv - Export all recipes as CSV
router.get('/export/csv', async (req, res) => {
  try {
    await initTables();
    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        category,
        menu_price_thb as price,
        description,
        is_active as verified,
        yield_unit,
        created_at
      FROM recipes 
      ORDER BY name ASC
    `);

    // Build CSV
    const headers = ['id', 'name', 'category', 'price', 'sku', 'verified', 'bom_status', 'source', 'created_at'];
    const csvLines = [headers.join(',')];
    
    for (const row of rows) {
      const csvRow = [
        row.id,
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${(row.category || '').replace(/"/g, '""')}"`,
        row.price || 0,
        '', // sku - not available in current schema
        'false', // verified - not available in current schema, default false per PATCH D spec
        'INCOMPLETE', // bom_status - not available in current schema
        'loyverse', // source - default
        row.created_at ? new Date(row.created_at).toISOString() : ''
      ];
      csvLines.push(csvRow.join(','));
    }
    
    const csvContent = csvLines.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="recipes-export.csv"');
    console.log(`[/api/recipes/export/csv] Exported ${rows.length} recipes`);
    res.send(csvContent);
  } catch (error) {
    console.error('[/api/recipes/export/csv] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to export recipes' });
  }
});

// Recipe Cards API endpoints (moved to top for proper routing)
// GET /api/recipes/cards - Get all recipes for cards library  
router.get('/cards', async (req, res) => {
  try {
    const mockRecipeData = process.env.MOCK_RECIPE_DATA === "true";
    if (process.env.NODE_ENV === "development" && mockRecipeData) {
      return res.json([
        {
          id: 101,
          name: "Single Smash Burger",
          description: "Mock recipe for UI validation.",
          category: "Burgers",
          version: 1,
          parent_id: null,
          image_url: null,
          total_cost: 69.5,
          cost_per_serving: 69.5,
          suggested_price: 0,
          instructions: null,
          notes: null,
          ingredients: [
            { ingredientId: "1", name: "Beef Patty", portionQty: 120, portionUnit: "g", conversionFactor: null },
            { ingredientId: "2", name: "Cheddar Slice", portionQty: 1, portionUnit: "slice", conversionFactor: 12 },
            { ingredientId: "3", name: "Burger Bun", portionQty: 1, portionUnit: "each", conversionFactor: null },
            { ingredientId: "4", name: "Mayo", portionQty: 20, portionUnit: "ml", conversionFactor: null },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 102,
          name: "Tomato Burger (Incomplete)",
          description: "Mock incomplete recipe for UI validation.",
          category: "Burgers",
          version: 1,
          parent_id: null,
          image_url: null,
          total_cost: 0,
          cost_per_serving: 0,
          suggested_price: 0,
          instructions: null,
          notes: null,
          ingredients: [
            { ingredientId: "5", name: "Tomato", portionQty: 30, portionUnit: "slice", conversionFactor: null },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }

    await initTables();
    const { rows } = await pool.query(`
      SELECT id, name, description, category, version, parent_id, image_url, 
             COALESCE(total_cost, 0)::float8 AS total_cost,
             COALESCE(cost_per_serving, 0)::float8 AS cost_per_serving,
             COALESCE(suggested_price, 0)::float8 AS suggested_price,
             instructions, notes, ingredients, created_at, updated_at
      FROM recipes 
      WHERE is_active = true 
      ORDER BY updated_at DESC
    `);
    
    // Ensure ingredients is always parsed as an array for consistency
    const parsedRecipes = rows.map(recipe => ({
      ...recipe,
      ingredients: typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : recipe.ingredients
    }));
    
    console.log(`[/api/recipes/cards] Returning ${rows.length} recipe cards`);
    res.json(parsedRecipes); // Return array directly, not wrapped in object
  } catch (error) {
    console.error('[/api/recipes/cards] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch recipe cards' });
  }
});

// GET /api/recipes/card-generate/:id - Generate A4 PDF card for recipe
router.get('/card-generate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await initTables();
    
    const { rows } = await pool.query(`
      SELECT id, name, description, category, version, image_url,
             ingredients, instructions, notes, 
             COALESCE(total_cost, 0)::float8 AS total_cost,
             COALESCE(cost_per_serving, 0)::float8 AS cost_per_serving
      FROM recipes 
      WHERE id = $1 AND is_active = true
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Recipe not found' });
    }
    
    const recipe = rows[0];
    console.log(`[/api/recipes/card-generate] Generating card for recipe: ${recipe.name}`);
    
    // Return recipe data for frontend PDF generation
    res.json({ 
      ok: true, 
      recipe: {
        ...recipe,
        ingredients: typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : recipe.ingredients
      }
    });
  } catch (error) {
    console.error('[/api/recipes/card-generate] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to generate recipe card' });
  }
});

router.post('/init-templates', async (_req, res) => {
  try {
    await seedLockedRecipeTemplates();
    res.json({ ok: true, count: LOCKED_RECIPE_TEMPLATES.length });
  } catch (error) {
    console.error('[recipes/init-templates] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to initialize templates' });
  }
});

router.post('/templates/ensure', async (_req, res) => {
  try {
    const ensuredResult = await ensureLockedRecipeTemplates();
    res.json(ensuredResult);
  } catch (error) {
    console.error('[recipes/templates/ensure] Error:', error);
    res.status(500).json({ ok: false, message: 'Failed to ensure recipe templates' });
  }
});

router.get('/v2', async (_req, res) => {
  try {
    await seedLockedRecipeTemplates();

    const rowsResult = await pool.query(`
      SELECT id, name, description, category, suggested_price, notes, image_url, updated_at
      FROM recipes
      WHERE notes LIKE $1
      ORDER BY name ASC
    `, [`${META_PREFIX}%`]);

    const allowedSkus = new Set(LOCKED_RECIPE_TEMPLATES.map((template) => template.sku));
    const recipesBySku = new Map<string, any>();

    for (const row of rowsResult.rows) {
      const meta = parseRecipeMeta(row.notes);
      const sku = String(meta?.sku ?? '');
      if (!allowedSkus.has(sku) || recipesBySku.has(sku)) continue;
      recipesBySku.set(sku, {
        id: row.id,
        name: row.name,
        sku,
        category: row.category,
        salePrice: Number(row.suggested_price ?? 0),
        description: row.description ?? '',
        imageUrl: meta?.imageUrl || row.image_url || '',
        published: Boolean(meta?.onlinePublishing?.published),
        publishedAt: meta?.onlinePublishing?.publishedAt || null,
        updatedAt: row.updated_at,
      });
    }

    const recipes = LOCKED_RECIPE_TEMPLATES
      .map((template) => recipesBySku.get(template.sku))
      .filter(Boolean);

    res.json(recipes);
  } catch (error) {
    console.error('[recipes/v2] Error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: 'recipes_init_failed', detail });
  }
});

router.get('/v2/:id', async (req, res) => {
  try {
    await seedLockedRecipeTemplates();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await pool.query(`
      SELECT id, name, description, category, suggested_price, notes, image_url
      FROM recipes
      WHERE id = $1
      LIMIT 1
    `, [id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const meta = parseRecipeMeta(row.notes);
    if (!meta?.sku || !LOCKED_RECIPE_TEMPLATES.some((t) => t.sku === meta.sku)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      id: row.id,
      name: row.name,
      sku: meta.sku,
      category: row.category,
      salePrice: Number(row.suggested_price ?? 0),
      description: row.description ?? '',
      imageUrl: meta.imageUrl || row.image_url || '',
      published: Boolean(meta?.onlinePublishing?.published),
      publishedAt: meta?.onlinePublishing?.publishedAt || null,
      servingsThisRecipeMakes: Number(meta.servingsThisRecipeMakes ?? 0),
      servingsPerProduct: Number(meta.servingsPerProduct ?? 0),
      productsMade: Number(meta.productsMade ?? 1) || 1,
      slippagePercent: Number(meta.slippagePercent ?? 0) || 0,
      ingredients: Array.isArray(meta.ingredients) ? meta.ingredients : [],
      packaging: Array.isArray(meta.packaging) ? meta.packaging : [],
      labour: Array.isArray(meta.labour) ? meta.labour : [],
      other: Array.isArray(meta.other) ? meta.other : [],
    });
  } catch (error) {
    console.error('[recipes/v2/:id] Error:', error);
    res.status(500).json({ error: 'Failed to fetch recipe v2' });
  }
});

router.put('/v2/:id', async (req, res) => {
  try {
    await seedLockedRecipeTemplates();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const source = await pool.query('SELECT name, category, notes FROM recipes WHERE id = $1 LIMIT 1', [id]);
    const current = source.rows[0];
    if (!current) return res.status(404).json({ error: 'Not found' });
    const currentMeta = parseRecipeMeta(current.notes);
    if (!currentMeta?.sku || !LOCKED_RECIPE_TEMPLATES.some((t) => t.sku === currentMeta.sku)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const payload = req.body ?? {};
    const nextMeta = {
      ...currentMeta,
      sku: currentMeta.sku,
      imageUrl: String(payload.imageUrl ?? currentMeta.imageUrl ?? ''),
      servingsThisRecipeMakes: Number(payload.servingsThisRecipeMakes ?? currentMeta.servingsThisRecipeMakes ?? 0),
      servingsPerProduct: Number(payload.servingsPerProduct ?? currentMeta.servingsPerProduct ?? 0),
      productsMade: Number(payload.productsMade ?? currentMeta.productsMade ?? 1) || 1,
      slippagePercent: Number(payload.slippagePercent ?? currentMeta.slippagePercent ?? 0) || 0,
      ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : (currentMeta.ingredients ?? []),
      packaging: Array.isArray(payload.packaging) ? payload.packaging : (currentMeta.packaging ?? []),
      labour: Array.isArray(payload.labour) ? payload.labour : (currentMeta.labour ?? []),
      other: Array.isArray(payload.other) ? payload.other : (currentMeta.other ?? []),
    };

    await pool.query(
      `UPDATE recipes
       SET name = $2, category = $3, description = $4, suggested_price = $5,
           image_url = $6, notes = $7, updated_at = now()
       WHERE id = $1`,
      [
        id,
        String(current.name ?? ''),
        String(current.category ?? ''),
        String(payload.description ?? ''),
        cleanMoney(payload.salePrice ?? 0),
        String(payload.imageUrl ?? ''),
        buildRecipeMeta(nextMeta),
      ],
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[recipes/v2/:id] Save error:', error);
    res.status(500).json({ error: 'Failed to save recipe v2' });
  }
});

// GET /api/recipes - List all recipes with enhanced data
router.get('/', async (req, res) => {
  try {
    await initTables();
    const { rows } = await pool.query(`
      SELECT 
        r.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'ingredientId', rl.ingredient_id,
              'name', rl.ingredient_name,
              'qty', rl.qty::numeric,
              'unit', rl.unit,
              'unitCostTHB', rl.unit_cost_thb::numeric,
              'costTHB', rl.cost_thb::numeric,
              'supplier', rl.supplier
            ) ORDER BY rl.id
          ) FILTER (WHERE rl.id IS NOT NULL), 
          '[]'::json
        ) AS ingredients
      FROM recipes r
      LEFT JOIN recipe_lines rl ON r.id = rl.recipe_id
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.description, r.category, r.yield_quantity, r.yield_unit, 
               r.total_cost, r.cost_per_serving, r.cogs_percent, r.suggested_price, 
               r.waste_factor, r.yield_efficiency, r.image_url, r.instructions, 
               r.notes, r.is_active, r.created_at, r.updated_at
      ORDER BY r.created_at DESC
    `);
    console.log(`[recipes] Returning ${rows.length} recipes with ingredients`);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Check for missing base cost data in recipe ingredients
router.get('/:id/cost-validation', async (req, res) => {
  let recipeId: number;
  try {
    recipeId = Number(req.params.id);
    if (!Number.isFinite(recipeId)) throw new Error('Invalid id');
  } catch (error) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  try {
    const { getRecipeMissingCostData } = await import('../services/recipeCost.service.js');
    const issues = await getRecipeMissingCostData(recipeId);
    
    // Also check if recipe is final
    const recipeResult = await pool.query('SELECT is_final FROM recipe WHERE id = $1', [recipeId]);
    const isFinal = recipeResult.rows[0]?.is_final ?? false;

    res.json({
      recipeId,
      isFinal,
      issues,
      canBeCost: issues.length === 0,
    });
  } catch (error: any) {
    console.error('[recipes] Cost validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate recipe cost' });
  }
});

router.get('/:id/ingredients', async (req, res) => {
  let recipeId: bigint;
  try {
    recipeId = BigInt(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  const rows = await prisma.recipe_lines.findMany({
    where: { recipe_id: recipeId },
  });

  let total_cost = 0;

  const ingredients = rows.map((ri) => {
    const portionQuantity = Number(ri.qty ?? 0);
    const wastePercentage = Number(ri.waste_percentage ?? 5);
    const costPerPortion = Number(ri.unit_cost_thb ?? 0);
    const adjustedLineCost =
      portionQuantity > 0
        ? costPerPortion * portionQuantity * (1 + wastePercentage / 100)
        : 0;
    const lineCost = Number(adjustedLineCost.toFixed(2));
    total_cost += lineCost;

    return {
      id: typeof ri.id === "bigint" ? Number(ri.id) : ri.id,
      ingredient_id: ri.ingredient_id,
      name: ri.ingredient_name,
      portion_quantity: portionQuantity,
      portion_unit: ri.unit,
      cost_per_portion: Number(costPerPortion.toFixed(2)),
      pack_cost: null,
      yield_per_pack: null,
      waste_percentage: wastePercentage,
      line_cost: lineCost,
      is_valid:
        Boolean(ri.ingredient_name) &&
        portionQuantity > 0 &&
        Number.isFinite(costPerPortion) &&
        costPerPortion >= 0,
    };
  });

  const status =
    ingredients.length > 0 && ingredients.every((i) => i.is_valid)
      ? 'VALID'
      : 'INVALID';

  res.json({ ingredients, total_cost, status });
});

router.patch('/:id/ingredient/:rowId', async (req, res) => {
  let recipeId: bigint;
  let rowId: bigint;
  try {
    recipeId = BigInt(req.params.id);
    rowId = BigInt(req.params.rowId);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid recipe or ingredient id' });
  }

  const portionQty = Number(req.body?.portionQty);
  const portionUnit = req.body?.portionUnit ? String(req.body.portionUnit) : null;
  const wastePercentage = Number(req.body?.wastePercentage);

  if (!Number.isFinite(portionQty) || portionQty <= 0) {
    return res.status(400).json({ error: 'Invalid portion quantity' });
  }

  if (!portionUnit) {
    return res.status(400).json({ error: 'Portion unit required' });
  }

  const line = await prisma.recipe_lines.findFirst({
    where: { id: rowId, recipe_id: recipeId },
  });

  if (!line) {
    return res.status(404).json({ error: 'Ingredient line not found' });
  }

  const resolvedWaste = Number.isFinite(wastePercentage) ? wastePercentage : 5;
  const resolvedCostPerPortion = Number(line.unit_cost_thb ?? 0);
  const lineCost =
    resolvedCostPerPortion * portionQty * (1 + resolvedWaste / 100);

  const updated = await prisma.recipe_lines.update({
    where: { id: rowId },
    data: {
      qty: portionQty,
      unit: portionUnit,
      waste_percentage: Number(resolvedWaste.toFixed(2)),
      unit_cost_thb: Number(resolvedCostPerPortion.toFixed(2)),
      cost_thb: Number(lineCost.toFixed(2)),
    },
  });

  return res.json({
    id: typeof updated.id === "bigint" ? Number(updated.id) : updated.id,
    ingredient_id: updated.ingredient_id,
    name: updated.ingredient_name,
    portion_quantity: Number(updated.qty),
    portion_unit: updated.unit,
    cost_per_portion: Number(updated.unit_cost_thb ?? 0),
    pack_cost: null,
    yield_per_pack: null,
    waste_percentage: Number(updated.waste_percentage ?? resolvedWaste),
    line_cost: Number(updated.cost_thb ?? 0),
  });
});

router.get('/:id', async (req, res) => {
  let recipeId: bigint;
  try {
    recipeId = BigInt(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  const recipe = await prisma.recipes.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  res.json({
    ...recipe,
    id: recipe.id.toString(),
    parent_id: recipe.parent_id ? recipe.parent_id.toString() : null,
  });
});

// POST /api/recipes - Create recipe
router.post('/', async (req, res) => {
  try {
    await initTables();
    const {
      name, description, category = 'Burgers', yieldQuantity = 1, yieldUnit = 'servings',
      ingredients = [], totalCost = 0, costPerServing = 0,
      wasteFactor = 0.05, yieldEfficiency = 0.90, imageUrl, instructions, notes,
      allergens = [], nutritional = {}, isActive = true
    } = req.body;

    // FORT KNOX FIX: Calculate ingredient costs with fallback pricing
    const ingredientPricing = {
      'beef': { pricePerKg: 319, unit: 'kg' }, // 319 THB per kg → 95g = 30.305 THB exactly
      'topside-beef': { pricePerKg: 319, unit: 'kg' },
      'brisket': { pricePerKg: 350, unit: 'kg' },
      'chuck': { pricePerKg: 300, unit: 'kg' },
      'cheese': { pricePerKg: 280, unit: 'kg' },
      'burger-bun': { pricePerUnit: 8, unit: 'each' },
      'bacon': { pricePerKg: 450, unit: 'kg' },
      'lettuce': { pricePerKg: 50, unit: 'kg' },
      'tomato': { pricePerKg: 60, unit: 'kg' },
      'onion': { pricePerKg: 35, unit: 'kg' }
    };

    let calculatedTotalCost = 0;
    const enhancedIngredients = ingredients.map((ingredient: any) => {
      const pricing = ingredientPricing[ingredient.id as keyof typeof ingredientPricing];
      let cost = 0;
      
      if (pricing) {
        const portionGrams = parseFloat(ingredient.portion) || 0;
        if (pricing.unit === 'kg' && 'pricePerKg' in pricing) {
          cost = (portionGrams / 1000) * pricing.pricePerKg;
        } else if (pricing.unit === 'each' && 'pricePerUnit' in pricing) {
          cost = portionGrams * pricing.pricePerUnit;
        }
      }
      
      calculatedTotalCost += cost;
      
      return {
        ...ingredient,
        cost: parseFloat(cost.toFixed(2)),
        unitPrice: pricing ? (pricing.unit === 'kg' ? (pricing as any).pricePerKg : (pricing as any).pricePerUnit) : 0
      };
    });

    let finalTotalCost = calculatedTotalCost > 0 ? calculatedTotalCost : cleanMoney(totalCost);
    
    // ENHANCEMENT: Apply waste factor and yield efficiency adjustments
    const wasteFactorAdjusted = req.body.wasteFactor || 1.05; // Default 5% waste
    const yieldEfficiencyAdjusted = req.body.yieldEfficiency || 0.95; // 95% yield
    finalTotalCost *= wasteFactorAdjusted / yieldEfficiencyAdjusted; // Adjust
    
    const finalCostPerServing = finalTotalCost / Math.max(1, yieldQuantity);
    const finalSuggestedPrice = 0;
    const cogsPercent = 0;

    console.log(`[POST /recipes] Cost calculation: ${name} - Total: ฿${finalTotalCost.toFixed(2)}, Per Serving: ฿${finalCostPerServing.toFixed(2)}`);

    const { rows } = await pool.query(`
      INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, cogs_percent, suggested_price,
        waste_factor, yield_efficiency, image_url, instructions, notes,
        is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
      RETURNING *
    `, [
      name, description, category, yieldQuantity, yieldUnit, JSON.stringify(enhancedIngredients),
      finalTotalCost, finalCostPerServing, cogsPercent, finalSuggestedPrice,
      wasteFactor, yieldEfficiency, imageUrl, instructions, notes,
      isActive
    ]);

    console.log(`[recipes] Created recipe: ${rows[0].name}`);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

router.post('/:id/ingredients', async (req, res) => {
  const { ingredient_name, portion_quantity, portion_unit, waste_percentage, unit_cost_thb } = req.body;

  if (!ingredient_name || !portion_quantity || !portion_unit) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let recipeId: bigint;
  try {
    recipeId = BigInt(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  const recipe = await prisma.recipes.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  const portionQuantity = Number(portion_quantity);
  if (!Number.isFinite(portionQuantity) || portionQuantity <= 0) {
    return res.status(400).json({ error: 'Invalid portion quantity' });
  }

  const costPerPortion = Number.isFinite(Number(unit_cost_thb)) ? Number(unit_cost_thb) : 0;
  const wastePercentage = Number.isFinite(Number(waste_percentage))
    ? Number(waste_percentage)
    : 5;
  const lineCost = costPerPortion * portionQuantity * (1 + wastePercentage / 100);

  const row = await prisma.recipe_lines.create({
    data: {
      recipe_id: recipe.id,
      ingredient_id: req.body.ingredient_id ? String(req.body.ingredient_id) : null,
      ingredient_name: String(ingredient_name),
      qty: portionQuantity,
      unit: String(portion_unit),
      unit_cost_thb: Number(costPerPortion.toFixed(2)),
      cost_thb: Number(lineCost.toFixed(2)),
      waste_percentage: Number(wastePercentage.toFixed(2)),
      supplier: req.body.supplier ? String(req.body.supplier) : null,
    },
  });

  res.status(201).json(row);
});

// PUT /api/recipes/:id - Update recipe
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateFields = Object.keys(req.body)
      .filter(key => key !== 'id')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(req.body)];
    values.push(new Date()); // updated_at

    const { rows } = await pool.query(`
      UPDATE recipes SET ${updateFields}, updated_at = $${values.length}
      WHERE id = $1 RETURNING *
    `, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    console.log(`[recipes] Updated recipe: ${rows[0].name}`);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// POST /api/recipes/:id/approve - Mark recipe approved
router.post('/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    const { rows } = await pool.query(
      `UPDATE recipes SET is_active = true, updated_at = now()
       WHERE id = $1 RETURNING id, name, updated_at`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({ ok: true, recipe: rows[0] });
  } catch (error) {
    console.error('Error approving recipe:', error);
    res.status(500).json({ error: 'Failed to approve recipe' });
  }
});

// DELETE /api/recipes/:id - Delete recipe
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query('SELECT name FROM recipes WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    await pool.query('DELETE FROM recipes WHERE id = $1', [id]);
    console.log(`[recipes] Deleted recipe: ${rows[0].name}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// POST /api/recipes/import - Bulk import recipes from CSV/JSON
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    await initTables();
    let recipes_data = [];
    const fileContent = req.file.buffer.toString();
    
    if (req.file.mimetype === 'application/json') {
      recipes_data = JSON.parse(fileContent);
    } else if (req.file.mimetype === 'text/csv') {
      // Parse CSV into recipe objects
      const lines = fileContent.split('\n');
      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= headers.length) {
          const recipe = {};
          headers.forEach((header, index) => {
            recipe[header.trim()] = values[index]?.trim();
          });
          if (recipe.name) recipes_data.push(recipe);
        }
      }
    }
    
    let imported = 0;
    for (const recipeData of recipes_data) {
      if (recipeData.name) {
        await pool.query(`
          INSERT INTO recipes (
            name, description, category, yield_quantity, yield_unit,
            ingredients, total_cost, cost_per_serving, suggested_price, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          recipeData.name,
          recipeData.description || '',
          recipeData.category || 'Other',
          parseFloat(recipeData.yieldQuantity || '1'),
          recipeData.yieldUnit || 'servings',
          JSON.stringify(recipeData.ingredients ? JSON.parse(recipeData.ingredients) : []),
          cleanMoney(recipeData.totalCost || 0),
          cleanMoney(recipeData.costPerServing || 0),
          0,
          true
        ]);
        imported++;
      }
    }
    
    console.log(`[recipes/import] Imported ${imported} recipes`);
    res.json({ ok: true, imported });
  } catch (error) {
    console.error('Error importing recipes:', error);
    res.status(500).json({ error: 'Failed to import recipes' });
  }
});

// POST /api/recipes/upload-image - Image upload with resize
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    // Validate file size (2MB limit)
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 2MB.' });
    }
    
    // Validate file is actually an image using sharp
    try {
      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.format || !['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format)) {
        return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, or WebP.' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid image file.' });
    }
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Resize image to 800x800 for Recipe Cards compatibility
    const filename = `recipe-${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(filepath);
    
    const imageUrl = `/uploads/${filename}`;
    console.log(`[recipes/upload-image] Saved: ${imageUrl}`);
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// POST /api/recipes/ramsay - AI Ramsay Gordon analysis and suggestions
router.post('/ramsay', async (req, res) => {
  try {
    const { recipe, targetPrice } = req.body;
    
    const prompt = `You are Gordon Ramsay, the world's most demanding chef. Analyze this recipe and provide:

Recipe: ${recipe.name}
Ingredients: ${JSON.stringify(recipe.ingredients)}
Current Cost: ฿${recipe.totalCost}
Target Price: ฿${targetPrice || 200}

Provide:
1. A 100-word Grab food delivery description (include ingredients, allergens if any, what makes it unique)
2. Price optimization suggestions to get under ฿${targetPrice || 200}
3. Cost reduction improvements (ingredient substitutions, portion adjustments)
4. Quality improvements that justify the price

Respond in your signature direct, passionate style but keep it professional for a restaurant business context.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Gordon Ramsay providing professional culinary business advice.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.8
    });
    
    const analysis = response.choices[0].message.content;
    console.log(`[recipes/ramsay] Generated analysis for: ${recipe.name}`);
    res.json({ analysis });
  } catch (error) {
    console.error('Error generating Ramsay analysis:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

// POST /api/recipes/:id/optimize - AI optimization suggestions (read-only)
router.post('/:id/optimize', async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    if (!Number.isFinite(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    await initTables();
    const recipeResult = await pool.query(
      `SELECT id, name, description, category, total_cost, cost_per_serving
       FROM recipes WHERE id = $1`,
      [recipeId]
    );
    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const linesResult = await pool.query(
      `SELECT ingredient_id, ingredient_name, qty, unit, unit_cost_thb, cost_thb
       FROM recipe_lines WHERE recipe_id = $1`,
      [recipeId]
    );

    const recipe = recipeResult.rows[0];
    const prompt = `You are a restaurant operations AI optimizing recipe profitability without harming quality.
Return a compact JSON object with keys: substitutions, marginTweaks, wasteReductions, supplierNotes.
If data is insufficient, respond with "INSUFFICIENT_DATA" for that list.

Recipe: ${recipe.name}
Description: ${recipe.description || 'None'}
Category: ${recipe.category}
Total Cost: ${recipe.total_cost}
Cost Per Serving: ${recipe.cost_per_serving}
Ingredients: ${JSON.stringify(linesResult.rows)}
Target: Improve margin by 10% with explicit, auditable suggestions.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Return only JSON. Avoid guessing prices. Use INSUFFICIENT_DATA if missing.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.2
    });

    const content = response.choices[0].message.content || '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = null;
    }

    res.json({ recipeId, suggestions: parsed || undefined, raw: parsed ? undefined : content });
  } catch (error) {
    console.error('Error generating optimization:', error);
    res.status(500).json({ error: 'Failed to generate optimization' });
  }
});

// GET /api/recipes/:id/forecast - Forecast cost using analysis variance reports (read-only)
router.get('/:id/forecast', async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    if (!Number.isFinite(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    await initTables();
    const linesResult = await pool.query(
      `SELECT ingredient_id, ingredient_name, cost_thb
       FROM recipe_lines WHERE recipe_id = $1`,
      [recipeId]
    );

    const recipeLines = linesResult.rows || [];
    if (recipeLines.length === 0) {
      return res.json({
        recipeId,
        coveragePct: 0,
        totalCurrentCost: 0,
        totalForecastCost: null,
        lineForecasts: [],
      });
    }

    const reportResult = await pool.query(
      `SELECT report_date, data
       FROM analysis_reports
       WHERE report_type = $1
       ORDER BY report_date DESC
       LIMIT 14`,
      ['ingredient_variance_daily']
    );

    const varianceByIngredient = new Map<number, number[]>();
    for (const row of reportResult.rows) {
      const varianceRows = row?.data?.varianceRows || [];
      if (!Array.isArray(varianceRows)) continue;
      varianceRows.forEach((entry: any) => {
        const ingredientId = Number(entry.ingredientId);
        const variancePct = Number(entry.variancePct);
        if (!Number.isFinite(ingredientId) || !Number.isFinite(variancePct)) return;
        const list = varianceByIngredient.get(ingredientId) ?? [];
        list.push(variancePct);
        varianceByIngredient.set(ingredientId, list);
      });
    }

    let coverageCount = 0;
    const lineForecasts = recipeLines.map((line: any) => {
      const ingredientId = Number(line.ingredient_id);
      const currentCost = Number(line.cost_thb) || 0;
      const varianceList = Number.isFinite(ingredientId) ? varianceByIngredient.get(ingredientId) : undefined;
      if (!varianceList || varianceList.length === 0) {
        return {
          ingredientId: String(line.ingredient_id),
          ingredientName: line.ingredient_name,
          currentCost,
          forecastCost: null,
          variancePctAvg: null,
        };
      }
      coverageCount += 1;
      const avgVariance = varianceList.reduce((sum, val) => sum + val, 0) / varianceList.length;
      const forecastCost = currentCost * (1 + avgVariance / 100);
      return {
        ingredientId: String(line.ingredient_id),
        ingredientName: line.ingredient_name,
        currentCost,
        forecastCost: Number(forecastCost.toFixed(2)),
        variancePctAvg: Number(avgVariance.toFixed(2)),
      };
    });

    const totalCurrentCost = lineForecasts.reduce((sum, line) => sum + line.currentCost, 0);
    const allCovered = coverageCount === lineForecasts.length;
    const totalForecastCost = allCovered
      ? Number(lineForecasts.reduce((sum, line) => sum + (line.forecastCost || 0), 0).toFixed(2))
      : null;

    res.json({
      recipeId,
      coveragePct: lineForecasts.length ? (coverageCount / lineForecasts.length) * 100 : 0,
      totalCurrentCost: Number(totalCurrentCost.toFixed(2)),
      totalForecastCost,
      lineForecasts,
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// GET /api/recipes/cross-ref-shift - Cross-reference used ingredients vs stock
router.get('/cross-ref-shift', async (req, res) => {
  try {
    const { shiftId } = req.query;
    
    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId required' });
    }
    
    // Get shift sales data and calculate theoretical ingredient usage
    // This would integrate with your daily sales and POS data
    
    // Mock implementation for demonstration
    const variance = {
      shiftId,
      calculations: {
        'Burger Bun': { theoretical: 120, actual: 115, variance: -5, unit: 'each' },
        'Topside Beef': { theoretical: 2400, actual: 2450, variance: 50, unit: 'g' }
      },
      summary: {
        totalItems: 2,
        varianceCount: 1,
        alertItems: ['Topside Beef'],
        accuracy: 95.8
      }
    };
    
    console.log(`[recipes/cross-ref-shift] Variance analysis for shift: ${shiftId}`);
    res.json(variance);
  } catch (error) {
    console.error('Error in cross-reference analysis:', error);
    res.status(500).json({ error: 'Failed to perform cross-reference analysis' });
  }
});

// Enhanced recipe saving with comprehensive error handling per Cam's specifications
router.post('/save', async (req, res) => {
  try {
    console.log('[recipes/save] Received save request:', JSON.stringify(req.body, null, 2));
    
    const { recipeName, lines, totals, note, wastePct, portions, description, instructions, sellingPrice } = req.body;
    
    // Enhanced validation with detailed logging
    if (!recipeName || recipeName.trim() === '') {
      console.error('[recipes/save] Validation failed: Recipe name missing');
      return res.status(400).json({ error: "Recipe name is required", details: "recipeName field is empty or missing" });
    }
    
    if (!Array.isArray(lines) || lines.length === 0) {
      console.error('[recipes/save] Validation failed: No ingredients provided');
      return res.status(400).json({ error: "At least one ingredient is required", details: "lines array is empty or missing" });
    }

    await initTables();
    
    // Enhanced calculations with defaults and error handling
    const totalCost = totals?.recipeCostTHB || lines.reduce((sum, ing) => sum + (ing.costTHB || 0), 0);
    const costPerServing = totals?.costPerPortionTHB || totalCost / Math.max(1, portions || 1);
    const suggestedPrice = Number(sellingPrice) || 0;
    const cogsPercent = 0;
    
    console.log(`[recipes/save] Calculations - Total: ฿${totalCost}, Per Serving: ฿${costPerServing}`);
    
    // Insert main recipe with all defaults
    const { rows } = await pool.query(`
      INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, cogs_percent, suggested_price,
        waste_factor, yield_efficiency, notes, instructions, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      RETURNING id, name
    `, [
      recipeName.trim(), 
      description || '', 
      'Burgers', 
      portions || 1, 
      'servings',
      JSON.stringify(lines || []), 
      cleanMoney(totalCost), 
      cleanMoney(costPerServing), 
      cogsPercent, 
      cleanMoney(suggestedPrice),
      Math.max(0, Math.min(1, (wastePct || 0) / 100)), // Ensure 0-1 range
      0.90, 
      note || '', 
      instructions || '',
      true
    ]);
    
    const recipeId = rows[0].id;
    console.log(`[recipes/save] Successfully inserted recipe ID: ${recipeId}`);

    // Insert recipe lines for detailed tracking (optional, won't fail if it errors)
    try {
      if (lines && lines.length > 0) {
        const values = [];
        const placeholders = lines.map((l, i) => {
          const offset = i * 9;
          values.push(
            recipeId, 
            l.ingredientId || `ingredient-${i}`, 
            l.name || 'Unknown Ingredient', 
            l.portionQty ?? l.qty ?? 0, 
            l.portionUnit ?? l.unit ?? 'g', 
            l.unitCostTHB || 0, 
            l.costTHB || 0, 
            Number(l.wastePercentage ?? l.wastePct ?? 5),
            l.supplier || ""
          );
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
        }).join(",");

        await pool.query(`
          INSERT INTO recipe_lines (recipe_id, ingredient_id, ingredient_name, qty, unit, unit_cost_thb, cost_thb, waste_percentage, supplier) 
          VALUES ${placeholders}
        `, values);
        console.log(`[recipes/save] Successfully inserted ${lines.length} recipe lines`);
      }
    } catch (lineError) {
      console.warn('[recipes/save] Recipe lines insert failed (non-critical):', lineError.message);
      // Continue - recipe was saved, lines are optional
    }
    
    // COGS Alert per specifications
    console.log(`[recipes/save] ✅ Successfully saved recipe: ${rows[0].name}, Cost: ฿${totalCost}`);
    res.json({ ok: true, id: recipeId, recipe: rows[0], cogsAlert: cogsPercent > 35 });
    
  } catch (error) {
    console.error('[recipes/save] ❌ Recipe Save Error:', error.message);
    console.error('[recipes/save] Stack trace:', error.stack);
    console.error('[recipes/save] Request body was:', JSON.stringify(req.body, null, 2));
    
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to save recipe', 
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Enhanced recipe saving with photo
router.post('/save-with-photo', async (req, res) => {
  try {
    const { recipeName, components, totals, description, imageUrl, notes } = req.body;
    
    if (!recipeName) {
      return res.status(400).json({ ok: false, error: "Recipe name required" });
    }

    await initTables();
    
    const totalCost = totals?.recipeCostTHB || 0;
    const costPerServing = totals?.costPerPortionTHB || 0;
    const suggestedPrice = 0;
    const cogsPercent = 0;
    
    const { rows } = await pool.query(`
      INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, cogs_percent, suggested_price,
        waste_factor, yield_efficiency, image_url, notes, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      RETURNING *
    `, [
      recipeName, description || '', 'Burgers', 1, 'servings',
      JSON.stringify(components || []), totalCost, costPerServing, cogsPercent, suggestedPrice,
      0.05, 0.90, imageUrl || null, notes || '', true
    ]);
    
    console.log(`[recipes/save-with-photo] Saved recipe with photo: ${rows[0].name}`);
    res.json({ ok: true, recipe: rows[0] });
  } catch (error) {
    console.error('Error saving recipe with photo:', error);
    res.status(500).json({ ok: false, error: 'Failed to save recipe with photo' });
  }
});

export default router;
