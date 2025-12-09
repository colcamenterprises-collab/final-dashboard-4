import express from "express";
import {
  getAllCategories, createCategory, updateCategory, reorderCategories
} from "../../services/menu/categoryService";
import {
  getAllItems, createItem, updateItem, toggleItem
} from "../../services/menu/itemService";
import {
  getModifierGroups, createModifierGroup, createModifier, applyGroupToItem
} from "../../services/menu/modifierService";
import {
  setRecipe, getRecipe
} from "../../services/menu/recipeService";

const router = express.Router();

// Categories
router.get("/categories", async (req, res) => {
  return res.json(await getAllCategories());
});

router.post("/categories/create", async (req, res) => {
  return res.json(await createCategory(req.body));
});

router.post("/categories/update", async (req, res) => {
  return res.json(await updateCategory(req.body.id, req.body));
});

router.post("/categories/reorder", async (req, res) => {
  await reorderCategories(req.body.order);
  return res.json({ success: true });
});

// Items
router.get("/items", async (req, res) => {
  return res.json(await getAllItems());
});

router.post("/items/create", async (req, res) => {
  return res.json(await createItem(req.body));
});

router.post("/items/update", async (req, res) => {
  return res.json(await updateItem(req.body.id, req.body));
});

router.post("/items/toggle", async (req, res) => {
  return res.json(await toggleItem(req.body.id, req.body.isActive));
});

// Modifiers
router.get("/modifiers/groups", async (req, res) => {
  return res.json(await getModifierGroups());
});

router.post("/modifiers/groups/create", async (req, res) => {
  return res.json(await createModifierGroup(req.body));
});

router.post("/modifiers/create", async (req, res) => {
  return res.json(await createModifier(req.body.groupId, req.body));
});

router.post("/modifiers/apply", async (req, res) => {
  return res.json(await applyGroupToItem(req.body.groupId, req.body.itemId));
});

// Recipes
router.get("/recipes/:itemId", async (req, res) => {
  return res.json(await getRecipe(req.params.itemId));
});

router.post("/recipes/set", async (req, res) => {
  await setRecipe(req.body.itemId, req.body.recipe);
  return res.json({ success: true });
});

export default router;
