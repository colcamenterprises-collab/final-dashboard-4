import express from "express";
import {
  getAllCategories, createCategory, updateCategory, reorderCategories, deleteCategory
} from "../../services/menu/categoryService";
import {
  getAllItems, createItem, updateItem, toggleItem
} from "../../services/menu/itemService";
import {
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifier, updateModifier, deleteModifier, applyGroupToItem, setGroupAssignments, mergeModifierGroups,
  deleteItemChoiceGroup
} from "../../services/menu/modifierService";
import {
  listModifierChannelSettings,
  updateModifierChannelSettings,
} from "../../services/menu/modifierChannelService";
import {
  getModifierGroupsWithLegacyAssignments,
  saveItemChoiceGroupCompatible,
} from "../../services/menu/itemOptionCompatibilityService";
import {
  setRecipe, getRecipe
} from "../../services/menu/recipeService";

const router = express.Router();

router.get("/categories", async (_req, res) => {
  try { return res.json(await getAllCategories()); }
  catch (error: any) {
    console.error('[menu-v3] categories unavailable:', error);
    return res.status(200).json({ ok: false, categories: [], source: 'menu_categories_v3', blockers: [{ code: 'MENU_CATEGORIES_UNAVAILABLE', message: error?.message || 'Failed to load categories', where: '/api/menu-v3/categories', canonical_source: 'menu_categories_v3', auto_build_attempted: false }] });
  }
});
router.post("/categories/create", async (req, res) => res.json(await createCategory(req.body)));
router.post("/categories/update", async (req, res) => res.json(await updateCategory(req.body.id, req.body)));
router.post("/categories/reorder", async (req, res) => { await reorderCategories(req.body.order); return res.json({ success: true }); });
router.post("/categories/delete", async (req, res) => res.json(await deleteCategory(req.body.id)));

router.get("/items", async (_req, res) => {
  try { return res.json({ ok: true, items: await getAllItems(), source: 'menu_items_v3' }); }
  catch (error: any) {
    console.error('[menu-v3] items unavailable:', error);
    return res.status(200).json({ ok: false, items: [], source: 'menu_items_v3', blockers: [{ code: 'MENU_ITEMS_UNAVAILABLE', message: error?.message || 'Failed to load menu items', where: '/api/menu-v3/items', canonical_source: 'menu_items_v3', auto_build_attempted: false }] });
  }
});
router.post("/items/create", async (req, res) => res.json(await createItem(req.body)));
router.post("/items/update", async (req, res) => {
  try {
    return res.json(await updateItem(req.body.id, req.body));
  } catch (error: any) {
    console.error("[menu-v3] item update failed:", {
      itemId: req.body?.id,
      recipeId: req.body?.recipeId,
      error: error?.message || String(error),
    });
    return res.status(400).json({ error: error?.message || "Could not save menu item" });
  }
});
router.post("/items/toggle", async (req, res) => res.json(await toggleItem(req.body.id, req.body.isActive)));

router.get("/modifiers/groups", async (_req, res) => {
  try { return res.json(await getModifierGroupsWithLegacyAssignments()); }
  catch (error: any) {
    console.error('[menu-v3] modifiers unavailable:', error);
    return res.status(200).json({ ok: false, groups: [], source: 'modifier_groups_v3', blockers: [{ code: 'MODIFIERS_UNAVAILABLE', message: error?.message || 'Failed to load modifier groups', where: '/api/menu-v3/modifiers/groups', canonical_source: 'modifier_groups_v3', auto_build_attempted: false }] });
  }
});
router.get("/modifiers/channel-settings", async (_req, res) => {
  try { return res.json({ ok: true, settings: await listModifierChannelSettings() }); }
  catch (error: any) { return res.status(400).json({ ok: false, error: error?.message || "Could not load modifier channel settings" }); }
});
router.post("/modifiers/channel-settings/update", async (req, res) => {
  try { return res.json({ ok: true, setting: await updateModifierChannelSettings(String(req.body?.id || ""), req.body) }); }
  catch (error: any) { return res.status(400).json({ ok: false, error: error?.message || "Could not save modifier channel settings" }); }
});
router.post("/modifiers/groups/create", async (req, res) => res.json(await createModifierGroup(req.body)));
router.post("/modifiers/groups/update", async (req, res) => res.json(await updateModifierGroup(req.body.id, req.body)));
router.post("/modifiers/groups/delete", async (req, res) => res.json(await deleteModifierGroup(req.body.id)));
router.post("/modifiers/groups/merge", async (req, res) => {
  const sourceGroupIds = Array.isArray(req.body?.sourceGroupIds) ? req.body.sourceGroupIds.map(String) : [];
  return res.json(await mergeModifierGroups(String(req.body?.targetGroupId || ""), sourceGroupIds, req.body?.mergeUniqueOptions !== false));
});
router.post("/modifiers/groups/assign", async (req, res) => {
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : [];
  return res.json(await setGroupAssignments(String(req.body.groupId), itemIds));
});
router.post("/modifiers/create", async (req, res) => res.json(await createModifier(req.body.groupId, req.body)));
router.post("/modifiers/update", async (req, res) => res.json(await updateModifier(req.body.id, req.body)));
router.post("/modifiers/delete", async (req, res) => res.json(await deleteModifier(req.body.id)));
router.post("/modifiers/apply", async (req, res) => res.json(await applyGroupToItem(req.body.groupId, req.body.itemId)));
router.post("/items/options/save", async (req, res) => {
  try {
    return res.json(await saveItemChoiceGroupCompatible(String(req.body?.itemId || ""), req.body?.groupId ? String(req.body.groupId) : null, req.body));
  } catch (error: any) {
    console.error('[menu-v3] item options save failed:', {
      itemId: req.body?.itemId,
      groupId: req.body?.groupId,
      error: error?.message || String(error),
    });
    return res.status(400).json({ error: error?.message || "Could not save item options" });
  }
});
router.post("/items/options/delete", async (req, res) => {
  try {
    return res.json(await deleteItemChoiceGroup(String(req.body?.itemId || ""), String(req.body?.groupId || "")));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Could not delete item options" });
  }
});

router.get("/recipes/:itemId", async (req, res) => {
  try { return res.json(await getRecipe(req.params.itemId)); }
  catch (error: any) {
    console.error('[menu-v3] recipe unavailable:', error);
    return res.status(200).json({ ok: false, recipe: null, source: 'recipes_v3', blockers: [{ code: 'MENU_RECIPE_UNAVAILABLE', message: error?.message || 'Failed to load recipe', where: '/api/menu-v3/recipes/:itemId', canonical_source: 'recipes_v3', auto_build_attempted: false }] });
  }
});
router.post("/recipes/set", async (req, res) => { await setRecipe(req.body.itemId, req.body.recipe); return res.json({ success: true }); });

export default router;
