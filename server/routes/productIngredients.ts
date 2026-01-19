import { Router } from "express";
import { pool } from "../db";
import { recalcProductCosts } from "../services/productCost.service";

const router = Router();

/**
 * Add a product ingredient line.
 */
router.post("/:productId/ingredients", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const { ingredientId, quantityUsed, prepNote } = req.body;

    if (!Number.isInteger(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const quantity = Number(quantityUsed);
    if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Invalid ingredient payload" });
    }

    await pool.query(
      `
      INSERT INTO product_ingredient
        (product_id, ingredient_id, quantity_used, prep_note,
         unit_cost_derived, line_cost_derived)
      VALUES ($1, $2, $3, $4, NULL, NULL)
      `,
      [productId, ingredientId, quantity, prepNote || null]
    );

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update a product ingredient line.
 */
router.patch("/:productId/ingredients/:lineId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const lineId = Number(req.params.lineId);
    const { ingredientId, quantityUsed, prepNote } = req.body;

    if (!Number.isInteger(productId) || !Number.isInteger(lineId)) {
      return res.status(400).json({ error: "Invalid product or line ID" });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (ingredientId !== undefined) {
      updates.push(`ingredient_id = $${index++}`);
      values.push(ingredientId);
    }

    if (quantityUsed !== undefined) {
      const quantity = Number(quantityUsed);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than zero" });
      }
      updates.push(`quantity_used = $${index++}`);
      values.push(quantity);
    }

    if (prepNote !== undefined) {
      updates.push(`prep_note = $${index++}`);
      values.push(prepNote || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    values.push(lineId, productId);

    const result = await pool.query(
      `
      UPDATE product_ingredient
      SET ${updates.join(", ")}
      WHERE id = $${index++} AND product_id = $${index}
      RETURNING id
      `,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ingredient line not found" });
    }

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a product ingredient line.
 */
router.delete("/:productId/ingredients/:lineId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const lineId = Number(req.params.lineId);

    if (!Number.isInteger(productId) || !Number.isInteger(lineId)) {
      return res.status(400).json({ error: "Invalid product or line ID" });
    }

    const result = await pool.query(
      `
      DELETE FROM product_ingredient
      WHERE id = $1 AND product_id = $2
      `,
      [lineId, productId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ingredient line not found" });
    }

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
