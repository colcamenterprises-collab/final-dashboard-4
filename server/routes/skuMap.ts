import { Router, Request, Response } from "express";
import { db } from "../db";
import { externalSkuMapV2, menuItems, ingredients } from "../../shared/schema";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";

const router = Router();

/**
 * Create or update an SKU mapping
 * POST /api/sku-map
 * 
 * Body: {
 *   channel: 'pos'|'grab'|'foodpanda'|'house'|'other',
 *   targetType: 'item'|'modifier'|'ingredient',
 *   targetId: number,
 *   sku?: string,
 *   externalId?: string,
 *   barcode?: string,
 *   variant?: string,
 *   effectiveFrom?: string,
 *   effectiveTo?: string,
 *   notes?: string
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      channel,
      targetType,
      targetId,
      sku,
      externalId,
      barcode,
      variant,
      effectiveFrom,
      effectiveTo,
      notes
    } = req.body;

    // Validate required fields
    if (!channel || !targetType || !targetId) {
      return res.status(400).json({
        error: "Missing required fields: channel, targetType, targetId"
      });
    }

    // Validate at least one identifier is provided
    if (!sku && !externalId && !barcode) {
      return res.status(400).json({
        error: "At least one identifier (sku, externalId, or barcode) is required"
      });
    }

    // Build the mapping object
    const mapping: any = {
      channel,
      sku: sku || null,
      externalId: externalId || null,
      barcode: barcode || null,
      variant: variant || null,
      notes: notes || null,
    };

    // Set the target ID based on type
    if (targetType === "item") {
      mapping.itemId = targetId;
    } else if (targetType === "modifier") {
      mapping.modifierId = targetId;
    } else if (targetType === "ingredient") {
      mapping.ingredientId = targetId;
    } else {
      return res.status(400).json({
        error: "Invalid targetType. Must be 'item', 'modifier', or 'ingredient'"
      });
    }

    // Set effective dates
    if (effectiveFrom) {
      mapping.effectiveFrom = new Date(effectiveFrom);
    }
    if (effectiveTo) {
      mapping.effectiveTo = new Date(effectiveTo);
    }

    // Insert the mapping
    const [result] = await db
      .insert(externalSkuMapV2)
      .values(mapping)
      .returning();

    res.json({
      success: true,
      mapping: result
    });
  } catch (error: any) {
    console.error("Error creating SKU mapping:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resolve a POS line to menu item/modifier/ingredient
 * POST /api/sku-map/resolve
 * 
 * Body: {
 *   channel: 'pos'|'grab'|'foodpanda'|'house'|'other',
 *   sku?: string,
 *   externalId?: string,
 *   barcode?: string,
 *   name?: string,
 *   modifierName?: string,
 *   asOfDate?: string  // Optional: resolve using mappings as of this date
 * }
 * 
 * Response: {
 *   itemId?: number,
 *   modifierId?: number,
 *   ingredientId?: number,
 *   mappingConfidence: 'exact' | 'name_fallback' | 'not_found',
 *   mapping?: object
 * }
 */
router.post("/resolve", async (req: Request, res: Response) => {
  try {
    const {
      channel,
      sku,
      externalId,
      barcode,
      name,
      modifierName,
      asOfDate
    } = req.body;

    if (!channel) {
      return res.status(400).json({ error: "channel is required" });
    }

    // Build conditions for exact match
    const conditions = [
      eq(externalSkuMapV2.channel, channel),
      eq(externalSkuMapV2.active, true),
    ];

    // Add identifier conditions (sku, externalId, or barcode)
    const identifierConditions = [];
    if (sku) identifierConditions.push(eq(externalSkuMapV2.sku, sku));
    if (externalId) identifierConditions.push(eq(externalSkuMapV2.externalId, externalId));
    if (barcode) identifierConditions.push(eq(externalSkuMapV2.barcode, barcode));

    if (identifierConditions.length === 0 && !name && !modifierName) {
      return res.status(400).json({
        error: "At least one identifier (sku, externalId, barcode) or name is required"
      });
    }

    // Add effective date conditions
    const effectiveDate = asOfDate ? new Date(asOfDate) : new Date();
    conditions.push(lte(externalSkuMapV2.effectiveFrom, effectiveDate));
    conditions.push(
      or(
        isNull(externalSkuMapV2.effectiveTo),
        gte(externalSkuMapV2.effectiveTo, effectiveDate)
      )!
    );

    // Try exact match first (if we have identifiers)
    if (identifierConditions.length > 0) {
      conditions.push(or(...identifierConditions)!);

      const mappings = await db
        .select()
        .from(externalSkuMapV2)
        .where(and(...conditions));

      if (mappings.length > 0) {
        // Return the first matching mapping
        const mapping = mappings[0];
        return res.json({
          itemId: mapping.itemId || undefined,
          modifierId: mapping.modifierId || undefined,
          ingredientId: mapping.ingredientId || undefined,
          mappingConfidence: "exact",
          mapping
        });
      }
    }

    // Fallback: try normalized name matching (optional)
    // This is a basic implementation - you can enhance with fuzzy matching
    if (name || modifierName) {
      // TODO: Implement normalized name fallback
      // For now, return not_found
      return res.json({
        mappingConfidence: "not_found",
        message: "No SKU mapping found for the provided identifiers"
      });
    }

    res.json({
      mappingConfidence: "not_found",
      message: "No SKU mapping found"
    });
  } catch (error: any) {
    console.error("Error resolving SKU mapping:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all SKU mappings for a specific item/modifier/ingredient
 * GET /api/sku-map/:targetType/:targetId
 */
router.get("/:targetType/:targetId", async (req: Request, res: Response) => {
  try {
    const { targetType, targetId } = req.params;

    let condition;
    if (targetType === "item") {
      condition = eq(externalSkuMapV2.itemId, parseInt(targetId));
    } else if (targetType === "modifier") {
      condition = eq(externalSkuMapV2.modifierId, parseInt(targetId));
    } else if (targetType === "ingredient") {
      condition = eq(externalSkuMapV2.ingredientId, parseInt(targetId));
    } else {
      return res.status(400).json({
        error: "Invalid targetType. Must be 'item', 'modifier', or 'ingredient'"
      });
    }

    const mappings = await db
      .select()
      .from(externalSkuMapV2)
      .where(condition)
      .orderBy(externalSkuMapV2.createdAt);

    res.json(mappings);
  } catch (error: any) {
    console.error("Error fetching SKU mappings:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete an SKU mapping
 * DELETE /api/sku-map/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db
      .delete(externalSkuMapV2)
      .where(eq(externalSkuMapV2.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting SKU mapping:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all unmapped POS items (items from recent receipts with no SKU mapping)
 * GET /api/sku-map/unmapped
 * 
 * This would require integration with your POS receipt system
 * TODO: Implement unmapped items inbox
 */
router.get("/unmapped", async (req: Request, res: Response) => {
  try {
    // This is a placeholder - would need to query recent POS receipts
    // and find items that don't have SKU mappings
    res.json({
      message: "Unmapped items inbox not yet implemented",
      items: []
    });
  } catch (error: any) {
    console.error("Error fetching unmapped items:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
