import { Router } from "express";
import { db } from "../db";
import { modifierGroup, modifier, modifierIngredient } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET all modifier groups for a menu item
router.get("/menu-item/:menuItemId", async (req, res) => {
  try {
    const { menuItemId } = req.params;
    
    const groups = await db
      .select()
      .from(modifierGroup)
      .where(eq(modifierGroup.menuItemId, menuItemId));
    
    const groupsWithModifiers = await Promise.all(
      groups.map(async (group) => {
        const mods = await db
          .select()
          .from(modifier)
          .where(eq(modifier.modifierGroupId, group.id));
        
        const modsWithIngredients = await Promise.all(
          mods.map(async (mod) => {
            const ingredients = await db
              .select()
              .from(modifierIngredient)
              .where(eq(modifierIngredient.modifierId, mod.id));
            return { ...mod, ingredients };
          })
        );
        
        return { ...group, modifiers: modsWithIngredients };
      })
    );
    
    res.json({ ok: true, groups: groupsWithModifiers });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CREATE modifier group
router.post("/groups", async (req, res) => {
  try {
    const { menuItemId, name, isRequired = false, minSelect = 0, maxSelect = 1 } = req.body;
    
    if (!menuItemId || !name) {
      return res.status(400).json({ ok: false, error: "menuItemId and name are required" });
    }
    
    const [newGroup] = await db.insert(modifierGroup).values({
      menuItemId,
      name,
      isRequired,
      minSelect,
      maxSelect,
    }).returning();
    
    res.json({ ok: true, group: newGroup });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// UPDATE modifier group
router.patch("/groups/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isRequired, minSelect, maxSelect, displayOrder } = req.body;
    
    const [updated] = await db
      .update(modifierGroup)
      .set({ 
        ...(name !== undefined && { name }),
        ...(isRequired !== undefined && { isRequired }),
        ...(minSelect !== undefined && { minSelect }),
        ...(maxSelect !== undefined && { maxSelect }),
        ...(displayOrder !== undefined && { displayOrder }),
      })
      .where(eq(modifierGroup.id, id))
      .returning();
    
    res.json({ ok: true, group: updated });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE modifier group
router.delete("/groups/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(modifierGroup).where(eq(modifierGroup.id, id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CREATE modifier
router.post("/modifiers", async (req, res) => {
  try {
    const { modifierGroupId, name, priceDelta = 0 } = req.body;
    
    if (!modifierGroupId || !name) {
      return res.status(400).json({ ok: false, error: "modifierGroupId and name are required" });
    }
    
    const [newModifier] = await db.insert(modifier).values({
      modifierGroupId,
      name,
      priceDelta: String(priceDelta),
    }).returning();
    
    res.json({ ok: true, modifier: newModifier });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// UPDATE modifier
router.patch("/modifiers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, priceDelta, displayOrder } = req.body;
    
    const [updated] = await db
      .update(modifier)
      .set({
        ...(name !== undefined && { name }),
        ...(priceDelta !== undefined && { priceDelta: String(priceDelta) }),
        ...(displayOrder !== undefined && { displayOrder }),
      })
      .where(eq(modifier.id, id))
      .returning();
    
    res.json({ ok: true, modifier: updated });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE modifier
router.delete("/modifiers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(modifier).where(eq(modifier.id, id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ADD modifier ingredient delta
router.post("/ingredients", async (req, res) => {
  try {
    const { modifierId, purchasingItemId, deltaQty, deltaUnit } = req.body;
    
    if (!modifierId || !purchasingItemId || deltaQty === undefined || !deltaUnit) {
      return res.status(400).json({ 
        ok: false, 
        error: "modifierId, purchasingItemId, deltaQty, and deltaUnit are required" 
      });
    }
    
    if (Number(deltaQty) <= 0) {
      return res.status(400).json({ ok: false, error: "Delta quantity must be > 0" });
    }
    
    const validUnits = ["grams", "ml", "each"];
    if (!validUnits.includes(deltaUnit)) {
      return res.status(400).json({ ok: false, error: "deltaUnit must be grams, ml, or each" });
    }
    
    const [newIngredient] = await db.insert(modifierIngredient).values({
      modifierId,
      purchasingItemId,
      deltaQty: String(deltaQty),
      deltaUnit,
    }).returning();
    
    res.json({ ok: true, ingredient: newIngredient });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE modifier ingredient
router.delete("/ingredients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(modifierIngredient).where(eq(modifierIngredient.id, id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
