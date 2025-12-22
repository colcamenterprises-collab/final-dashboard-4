import { Router } from 'express';
import { db } from '../db';
import { recipeSkuMap } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

export const recipeMappingRouter = Router();

// GET /api/recipe-mapping - List all mappings with recipe names
recipeMappingRouter.get('/api/recipe-mapping', async (req, res) => {
  try {
    // Get all SKUs from sold_items with their mapped recipes
    const allSkus = await db.execute<{ externalSku: string; channel: string; count: number }>(`
      SELECT "externalSku", channel, COUNT(*)::int as count 
      FROM sold_items 
      GROUP BY "externalSku", channel 
      ORDER BY count DESC
    `);
    
    // Get all existing mappings with recipe names
    const mappings = await db.execute<{ 
      id: number; 
      channel: string; 
      channelSku: string; 
      recipeId: number; 
      recipeName: string;
      active: boolean;
    }>(`
      SELECT 
        m.id, 
        m.channel, 
        m.channel_sku as "channelSku", 
        m.recipe_id as "recipeId",
        r.name as "recipeName",
        m.active
      FROM recipe_sku_map m
      LEFT JOIN recipes r ON m.recipe_id = r.id
      ORDER BY m.channel, m.channel_sku
    `);
    
    // Get all recipes for dropdown
    const recipes = await db.execute<{ id: number; name: string }>(`
      SELECT id, name FROM recipes ORDER BY name
    `);
    
    // Build combined result: all SKUs with mapping status
    const mappingsMap = new Map(mappings.rows.map(m => [`${m.channel}:${m.channelSku}`, m]));
    
    const result = allSkus.rows.map(sku => {
      const mapping = mappingsMap.get(`${sku.channel}:${sku.externalSku}`);
      return {
        channel: sku.channel,
        channelSku: sku.externalSku,
        recipeId: mapping?.recipeId ?? null,
        recipeName: mapping?.recipeName ?? null,
        mapped: !!mapping,
        salesCount: sku.count,
      };
    });
    
    res.json({
      mappings: result,
      recipes: recipes.rows,
      stats: {
        totalSkus: allSkus.rows.length,
        mappedSkus: result.filter(r => r.mapped).length,
        unmappedSkus: result.filter(r => !r.mapped).length,
      },
    });
  } catch (error: any) {
    console.error('Recipe mapping fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recipe-mapping - Create/update a mapping
const mappingSchema = z.object({
  channel: z.string(),
  channelSku: z.string(),
  recipeId: z.number(),
});

recipeMappingRouter.post('/api/recipe-mapping', async (req, res) => {
  try {
    const body = mappingSchema.parse(req.body);
    
    // Check if recipe exists
    const recipeCheck = await db.execute<{ id: number }>(`SELECT id FROM recipes WHERE id = $1`, [body.recipeId]);
    if (recipeCheck.rows.length === 0) {
      return res.status(400).json({ error: `Recipe ID ${body.recipeId} not found` });
    }
    
    // Check if mapping exists
    const existing = await db.select()
      .from(recipeSkuMap)
      .where(and(
        eq(recipeSkuMap.channel, body.channel),
        eq(recipeSkuMap.channelSku, body.channelSku)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing
      await db.update(recipeSkuMap)
        .set({ 
          recipeId: body.recipeId,
          updatedAt: new Date(),
          active: true,
        })
        .where(eq(recipeSkuMap.id, existing[0].id));
      
      res.json({ success: true, action: 'updated', id: existing[0].id });
    } else {
      // Insert new
      const result = await db.insert(recipeSkuMap).values({
        channel: body.channel,
        channelSku: body.channelSku,
        recipeId: body.recipeId,
        active: true,
      }).returning({ id: recipeSkuMap.id });
      
      res.json({ success: true, action: 'created', id: result[0].id });
    }
  } catch (error: any) {
    console.error('Recipe mapping save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/recipe-mapping/:id - Delete a mapping
recipeMappingRouter.delete('/api/recipe-mapping/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(recipeSkuMap).where(eq(recipeSkuMap.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Recipe mapping delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/rebuild-usage - Trigger rebuild of usage data
recipeMappingRouter.post('/api/admin/rebuild-usage', async (req, res) => {
  try {
    const startTime = Date.now();
    const logs: string[] = [];
    
    logs.push('🔄 Starting rebuild sequence...');
    
    // 1. Rebuild sold items with recipe mappings
    logs.push('📦 Rebuilding sold items...');
    const { deriveAllSoldItems } = await import('../services/soldItemDeriver');
    await deriveAllSoldItems();
    logs.push('✅ Sold items rebuilt');
    
    // 2. Rebuild ingredient usage
    logs.push('🧂 Rebuilding ingredient usage...');
    try {
      const { rebuildIngredientUsage } = await import('../services/ingredientUsageDeriver');
      await rebuildIngredientUsage();
      logs.push('✅ Ingredient usage rebuilt');
    } catch (e: any) {
      logs.push(`⚠️ Ingredient usage: ${e.message}`);
    }
    
    // 3. Rebuild reconciliation
    logs.push('📊 Rebuilding reconciliation...');
    try {
      const { rebuildReconciliation } = await import('../services/reconciliationDeriver');
      await rebuildReconciliation();
      logs.push('✅ Reconciliation rebuilt');
    } catch (e: any) {
      logs.push(`⚠️ Reconciliation: ${e.message}`);
    }
    
    // 4. Rebuild recipe coverage
    logs.push('📈 Rebuilding recipe coverage...');
    try {
      const { rebuildRecipeCoverage } = await import('../services/recipeCoverageDeriver');
      await rebuildRecipeCoverage();
      logs.push('✅ Recipe coverage rebuilt');
    } catch (e: any) {
      logs.push(`⚠️ Recipe coverage: ${e.message}`);
    }
    
    // 5. Rebuild alerts
    logs.push('🚨 Rebuilding alerts...');
    try {
      const { rebuildAlerts } = await import('../services/alertDeriver');
      await rebuildAlerts();
      logs.push('✅ Alerts rebuilt');
    } catch (e: any) {
      logs.push(`⚠️ Alerts: ${e.message}`);
    }
    
    const duration = Date.now() - startTime;
    logs.push(`\n⏱️ Total execution time: ${duration}ms`);
    
    res.json({ 
      success: true, 
      durationMs: duration,
      logs,
    });
  } catch (error: any) {
    console.error('Rebuild usage error:', error);
    res.status(500).json({ error: error.message });
  }
});
