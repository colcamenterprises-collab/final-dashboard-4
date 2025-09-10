// Enhanced Recipes routes with comprehensive functionality
import { Router } from "express";
import { pool } from "../db";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import sharp from 'sharp';
import { loadCatalogFromCSV } from "../lib/stockCatalog";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper functions
function cleanMoney(v: any) {
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function calculateCOGS(totalCost: number, suggestedPrice: number): number {
  return suggestedPrice > 0 ? (totalCost / suggestedPrice) * 100 : 0;
}

function suggestPrice(totalCost: number, targetMargin: number = 65): number {
  return totalCost / (1 - targetMargin / 100);
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
      supplier TEXT
    )
  `);
}

// GET /api/recipes - List all recipes with enhanced data
router.get('/', async (req, res) => {
  try {
    await initTables();
    const { rows } = await pool.query(`
      SELECT * FROM recipes WHERE is_active = true ORDER BY created_at DESC
    `);
    console.log(`[recipes] Returning ${rows.length} recipes`);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// POST /api/recipes - Create recipe
router.post('/', async (req, res) => {
  try {
    await initTables();
    const {
      name, description, category = 'Burgers', yieldQuantity = 1, yieldUnit = 'servings',
      ingredients = [], totalCost = 0, costPerServing = 0, suggestedPrice = 0,
      wasteFactor = 0.05, yieldEfficiency = 0.90, imageUrl, instructions, notes,
      allergens = [], nutritional = {}, isActive = true
    } = req.body;

    const cogsPercent = calculateCOGS(cleanMoney(totalCost), cleanMoney(suggestedPrice));

    const { rows } = await pool.query(`
      INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, cogs_percent, suggested_price,
        waste_factor, yield_efficiency, image_url, instructions, notes,
        allergens, nutritional, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now())
      RETURNING *
    `, [
      name, description, category, yieldQuantity, yieldUnit, JSON.stringify(ingredients),
      cleanMoney(totalCost), cleanMoney(costPerServing), cogsPercent, cleanMoney(suggestedPrice),
      wasteFactor, yieldEfficiency, imageUrl, instructions, notes,
      JSON.stringify(allergens), JSON.stringify(nutritional), isActive
    ]);

    console.log(`[recipes] Created recipe: ${rows[0].name}`);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
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
          cleanMoney(recipeData.suggestedPrice || 0),
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
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Resize image to 800x600 for Grab compatibility
    const filename = `recipe-${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    
    await sharp(req.file.buffer)
      .resize(800, 600, { fit: 'cover' })
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
    
    const { recipeName, lines, totals, note, wastePct, portions, menuPrice, description } = req.body;
    
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
    const suggestedPrice = menuPrice || suggestPrice(totalCost);
    const cogsPercent = calculateCOGS(totalCost, suggestedPrice);
    
    console.log(`[recipes/save] Calculations - Total: ฿${totalCost}, Per Serving: ฿${costPerServing}, COGS: ${cogsPercent.toFixed(1)}%`);
    
    // Insert main recipe with all defaults
    const { rows } = await pool.query(`
      INSERT INTO recipes (
        name, description, category, yield_quantity, yield_unit, ingredients,
        total_cost, cost_per_serving, cogs_percent, suggested_price,
        waste_factor, yield_efficiency, notes, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
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
      true
    ]);
    
    const recipeId = rows[0].id;
    console.log(`[recipes/save] Successfully inserted recipe ID: ${recipeId}`);

    // Insert recipe lines for detailed tracking (optional, won't fail if it errors)
    try {
      if (lines && lines.length > 0) {
        const values = [];
        const placeholders = lines.map((l, i) => {
          const offset = i * 8;
          values.push(
            recipeId, 
            l.ingredientId || `ingredient-${i}`, 
            l.name || 'Unknown Ingredient', 
            l.qty || 0, 
            l.unit || 'g', 
            l.unitCostTHB || 0, 
            l.costTHB || 0, 
            l.supplier || ""
          );
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
        }).join(",");

        await pool.query(`
          INSERT INTO recipe_lines (recipe_id, ingredient_id, ingredient_name, qty, unit, unit_cost_thb, cost_thb, supplier) 
          VALUES ${placeholders}
        `, values);
        console.log(`[recipes/save] Successfully inserted ${lines.length} recipe lines`);
      }
    } catch (lineError) {
      console.warn('[recipes/save] Recipe lines insert failed (non-critical):', lineError.message);
      // Continue - recipe was saved, lines are optional
    }
    
    // COGS Alert per specifications
    if (cogsPercent > 35) {
      console.log(`[recipes/save] COGS Alert: ${cogsPercent.toFixed(1)}% - optimize recommended`);
    }
    
    console.log(`[recipes/save] ✅ Successfully saved recipe: ${rows[0].name}, Cost: ฿${totalCost}, COGS: ${cogsPercent.toFixed(1)}%`);
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
    const suggestedPrice = suggestPrice(totalCost);
    const cogsPercent = calculateCOGS(totalCost, suggestedPrice);
    
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