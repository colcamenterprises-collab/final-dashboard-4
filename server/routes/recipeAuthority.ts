/**
 * 🔒 FOUNDATION-02: RECIPE AUTHORITY API ROUTES
 * 
 * Provides CRUD operations for recipes and cost calculation.
 * Ingredients must come from purchasing_items with is_ingredient = true.
 */

import { Router, Request, Response } from 'express';
import * as recipeService from '../services/recipeAuthority';
import { createProductFromRecipe, refreshProductBaseCost } from '../services/productCatalog';
import { insertRecipeV2Schema, insertRecipeIngredientV2Schema, insertPosItemRecipeMapSchema } from '@shared/schema';

const router = Router();

const parsePositiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value.trim() : String(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

function validateIngredients(ingredients: { ingredientId?: number; purchasingItemId?: number; quantityPerPortion?: string; portionQty?: string; quantity?: string; unit?: string }[]): string | null {
  for (const ing of ingredients) {
    if (!ing.ingredientId && !ing.purchasingItemId) {
      return `Ingredient missing: ingredientId or purchasingItemId required`;
    }
    const id = ing.ingredientId || ing.purchasingItemId;
    const qtyValue = ing.quantityPerPortion ?? ing.portionQty ?? ing.quantity;
    const qty = parsePositiveNumber(qtyValue);
    if (!qty) {
      return `Ingredient ${id}: quantity per portion must be greater than 0`;
    }
  }
  return null;
}

// ========================================
// STATIC ROUTES (must come before parameterized routes)
// ========================================

/**
 * GET /api/recipe-authority
 * Get all recipes with calculated costs
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const recipes = await recipeService.getAllRecipesWithCost();
    res.json({ ok: true, recipes });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching recipes:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch recipes' });
  }
});

/**
 * GET /api/recipe-authority/available-ingredients
 * Get all purchasing items that can be used as ingredients (is_ingredient = true)
 */
router.get('/available-ingredients', async (_req: Request, res: Response) => {
  try {
    const ingredients = await recipeService.getAvailableIngredients();
    res.json({ ok: true, ingredients });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching available ingredients:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch available ingredients' });
  }
});

/**
 * GET /api/recipe-authority/cost-flags
 * PATCH R1.1: Returns empty flags (canonical ingredients don't have cost issues)
 */
router.get('/cost-flags', async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, flags: [] });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching cost flags:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch cost flags' });
  }
});

/**
 * GET /api/recipe-authority/pos-mappings
 * Get all POS item to recipe mappings
 */
router.get('/pos-mappings', async (_req: Request, res: Response) => {
  try {
    const mappings = await recipeService.getAllPosItemMappings();
    res.json({ ok: true, mappings });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching POS mappings:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch POS mappings' });
  }
});

/**
 * POST /api/recipe-authority/pos-mappings
 * Map a POS item to a recipe
 */
router.post('/pos-mappings', async (req: Request, res: Response) => {
  try {
    const { posItemId, recipeId } = req.body;
    if (!posItemId || !recipeId) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: posItemId, recipeId' });
    }

    const mapping = await recipeService.mapPosItemToRecipe(posItemId, recipeId);
    res.status(201).json({ ok: true, mapping });
  } catch (error) {
    console.error('[RecipeAuthority] Error creating POS mapping:', error);
    res.status(500).json({ ok: false, error: 'Failed to create POS mapping' });
  }
});

/**
 * GET /api/recipe-authority/pos-item/:posItemId/recipe
 * Get recipe for a POS item
 */
router.get('/pos-item/:posItemId/recipe', async (req: Request, res: Response) => {
  try {
    const { posItemId } = req.params;
    const recipe = await recipeService.getRecipeForPosItem(posItemId);
    
    if (!recipe) {
      return res.json({ ok: true, recipe: null, message: 'No recipe mapped to this POS item' });
    }

    res.json({ ok: true, recipe });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching recipe for POS item:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch recipe' });
  }
});

// ========================================
// PARAMETERIZED ROUTES
// ========================================

/**
 * GET /api/recipe-authority/:id
 * Get single recipe with calculated cost
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const recipe = await recipeService.getRecipeWithCost(id);
    if (!recipe) {
      return res.status(404).json({ ok: false, error: 'Recipe not found' });
    }

    res.json({ ok: true, recipe });
  } catch (error) {
    console.error('[RecipeAuthority] Error fetching recipe:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch recipe' });
  }
});

/**
 * GET /api/recipe-authority/:id/cost
 * Get just the calculated cost for a recipe (read-only, always fresh)
 */
router.get('/:id/cost', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const cost = await recipeService.calculateRecipeCost(id);
    res.json({ ok: true, recipeId: id, cost });
  } catch (error) {
    console.error('[RecipeAuthority] Error calculating cost:', error);
    res.status(500).json({ ok: false, error: 'Failed to calculate cost' });
  }
});

/**
 * POST /api/recipe-authority
 * Create a new recipe
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = insertRecipeV2Schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe data', details: parsed.error.errors });
    }
    const yieldUnits = parsePositiveNumber(parsed.data.yieldUnits);
    if (!yieldUnits) {
      return res.status(400).json({ ok: false, error: 'Serves must be a positive number' });
    }

    const recipe = await recipeService.createRecipe(parsed.data);
    res.status(201).json({ ok: true, recipe });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Recipe with this name already exists' });
    }
    console.error('[RecipeAuthority] Error creating recipe:', error);
    res.status(500).json({ ok: false, error: 'Failed to create recipe' });
  }
});

/**
 * POST /api/recipe-authority/:id/create-product
 * Create a product from a recipe (inactive, prices unset)
 */
router.post('/:id/create-product', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const result = await createProductFromRecipe(id);
    if (result.status === 'missing') {
      return res.status(404).json({ ok: false, error: 'Recipe not found' });
    }
    if (result.status === 'invalid') {
      return res.status(400).json({ ok: false, error: result.reason });
    }
    if (result.status === 'exists') {
      return res.status(409).json({ ok: false, error: 'Product already exists for this recipe' });
    }

    res.status(201).json({ ok: true, product: result.product });
  } catch (error) {
    console.error('[RecipeAuthority] Error creating product:', error);
    res.status(500).json({ ok: false, error: 'Failed to create product' });
  }
});

/**
 * PUT /api/recipe-authority/:id
 * PATCH 8: Full recipe update with atomic ingredient replacement
 * PATCH 1.1: Added portion unit validation (grams, ml, each, serving only)
 * Accepts { name, yieldUnits, active, ingredients: [...] }
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const yieldUnits = parsePositiveNumber(req.body?.yieldUnits);
    if (!yieldUnits) {
      return res.status(400).json({ ok: false, error: 'Serves must be a positive number' });
    }

    if (req.body.ingredients && Array.isArray(req.body.ingredients)) {
      const validationError = validateIngredients(req.body.ingredients);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }
    }

    const recipe = await recipeService.updateRecipeWithIngredients(id, req.body);
    if (!recipe) {
      return res.status(404).json({ ok: false, error: 'Recipe not found' });
    }

    await refreshProductBaseCost(id);
    res.json({ ok: true, recipe });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Recipe with this name already exists' });
    }
    if (error.message?.includes('not found or is not marked as ingredient')) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    console.error('[RecipeAuthority] Error updating recipe:', error);
    res.status(500).json({ ok: false, error: 'Failed to update recipe' });
  }
});

/**
 * DELETE /api/recipe-authority/:id
 * Delete a recipe and all its ingredients
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const deleted = await recipeService.deleteRecipe(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Recipe not found' });
    }

    res.json({ ok: true, message: 'Recipe deleted' });
  } catch (error) {
    console.error('[RecipeAuthority] Error deleting recipe:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete recipe' });
  }
});

/**
 * POST /api/recipe-authority/:id/ingredients
 * Add ingredient to recipe
 * PATCH 1.1: Added portion unit validation
 */
router.post('/:id/ingredients', async (req: Request, res: Response) => {
  try {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return res.status(400).json({ ok: false, error: 'Invalid recipe ID' });
    }

    const { purchasingItemId, quantityPerPortion, quantity, unit } = req.body;
    const qtyValue = quantityPerPortion || quantity;
    if (!purchasingItemId || !qtyValue || !unit) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: purchasingItemId, quantityPerPortion, unit' });
    }

    const qty = parsePositiveNumber(qtyValue);
    if (!qty) {
      return res.status(400).json({ ok: false, error: 'Quantity per portion must be greater than 0' });
    }

    const ingredient = await recipeService.addIngredientToRecipe(
      recipeId,
      purchasingItemId,
      qtyValue.toString(),
      unit
    );

    await refreshProductBaseCost(recipeId);
    res.status(201).json({ ok: true, ingredient });
  } catch (error: any) {
    if (error.message?.includes('not found or is not marked as ingredient')) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'This ingredient is already in the recipe' });
    }
    console.error('[RecipeAuthority] Error adding ingredient:', error);
    res.status(500).json({ ok: false, error: 'Failed to add ingredient' });
  }
});

/**
 * PUT /api/recipe-authority/:id/ingredients/:ingredientId
 * Update recipe ingredient
 */
router.put('/:id/ingredients/:ingredientId', async (req: Request, res: Response) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ ok: false, error: 'Invalid ingredient ID' });
    }

    const { quantityPerPortion, quantity } = req.body;
    const qtyValue = quantityPerPortion || quantity;
    if (!qtyValue) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: quantityPerPortion' });
    }

    const qty = parsePositiveNumber(qtyValue);
    if (!qty) {
      return res.status(400).json({ ok: false, error: 'Quantity per portion must be greater than 0' });
    }

    const ingredient = await recipeService.updateRecipeIngredient(ingredientId, qtyValue.toString());

    if (!ingredient) {
      return res.status(404).json({ ok: false, error: 'Ingredient not found' });
    }

    await refreshProductBaseCost(ingredient.recipeId);
    res.json({ ok: true, ingredient });
  } catch (error) {
    console.error('[RecipeAuthority] Error updating ingredient:', error);
    res.status(500).json({ ok: false, error: 'Failed to update ingredient' });
  }
});

/**
 * DELETE /api/recipe-authority/:id/ingredients/:ingredientId
 * Remove ingredient from recipe
 */
router.delete('/:id/ingredients/:ingredientId', async (req: Request, res: Response) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ ok: false, error: 'Invalid ingredient ID' });
    }

    const removed = await recipeService.removeIngredientFromRecipe(ingredientId);
    if (removed) {
      await refreshProductBaseCost(removed.recipeId);
    }
    res.json({ ok: true, message: 'Ingredient removed' });
  } catch (error) {
    console.error('[RecipeAuthority] Error removing ingredient:', error);
    res.status(500).json({ ok: false, error: 'Failed to remove ingredient' });
  }
});

export default router;
