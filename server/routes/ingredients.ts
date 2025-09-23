import { Router } from "express";
import {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  updateIngredientPortion,
  deleteIngredient
} from "../services/ingredientService";
import { createInsertSchema } from "drizzle-zod";
import { ingredients } from "../../shared/schema";
import { z } from "zod";

const router = Router();

// Create insert schema for validation
const insertIngredientSchema = createInsertSchema(ingredients, {
  purchaseQty: z.coerce.number().positive(),
  purchaseCost: z.coerce.number().positive(),
  portionsPerPurchase: z.coerce.number().positive().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, lastReview: true });

// GET /api/ingredients - Get all ingredients
router.get("/", async (req, res) => {
  try {
    const ingredients = await getAllIngredients();
    res.json(ingredients);
  } catch (error) {
    console.error("Error fetching ingredients:", error);
    res.status(500).json({ error: "Failed to fetch ingredients" });
  }
});

// GET /api/ingredients/:id - Get ingredient by ID
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ingredient ID" });
    }

    const ingredient = await getIngredientById(id);
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    res.json(ingredient);
  } catch (error) {
    console.error("Error fetching ingredient:", error);
    res.status(500).json({ error: "Failed to fetch ingredient" });
  }
});

// POST /api/ingredients - Create new ingredient
router.post("/", async (req, res) => {
  try {
    const validatedData = insertIngredientSchema.parse(req.body);
    const ingredient = await createIngredient(validatedData);
    res.status(201).json(ingredient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    console.error("Error creating ingredient:", error);
    res.status(500).json({ error: "Failed to create ingredient" });
  }
});

// PUT /api/ingredients/:id - Update ingredient
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ingredient ID" });
    }

    const validatedData = insertIngredientSchema.partial().parse(req.body);
    const ingredient = await updateIngredient(id, validatedData);
    
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    res.json(ingredient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    console.error("Error updating ingredient:", error);
    res.status(500).json({ error: "Failed to update ingredient" });
  }
});

// PUT /api/ingredients/:id/portion - Update ingredient portion info
router.put("/:id/portion", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ingredient ID" });
    }

    const { portionUnit, portionsPerPurchase } = req.body;
    
    if (!portionUnit || !portionsPerPurchase) {
      return res.status(400).json({ 
        error: "portionUnit and portionsPerPurchase are required" 
      });
    }

    const ingredient = await updateIngredientPortion(id, portionUnit, Number(portionsPerPurchase));
    
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    res.json(ingredient);
  } catch (error) {
    console.error("Error updating ingredient portion:", error);
    res.status(500).json({ error: "Failed to update ingredient portion" });
  }
});

// DELETE /api/ingredients/:id - Delete ingredient
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ingredient ID" });
    }

    const deletedIngredient = await deleteIngredient(id);
    
    if (!deletedIngredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    res.json({ message: "Ingredient deleted successfully", ingredient: deletedIngredient });
  } catch (error) {
    console.error("Error deleting ingredient:", error);
    res.status(500).json({ error: "Failed to delete ingredient" });
  }
});

export default router;