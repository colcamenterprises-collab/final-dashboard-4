import { Router } from "express";
import { pool } from "../db";
import { recalcProductCosts } from "../services/productCost.service";

const router = Router();

/**
 * Add or update an ingredient line.
 * Cost is ALWAYS recalculated.
 */
router.post("/:productId/ingredients", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const { ingredientId, quantityUsed, prepNote } = req.body;

    if (!Number.isInteger(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const parsedIngredientId = Number(ingredientId);
    const parsedQuantity = Number(quantityUsed);

    if (!Number.isFinite(parsedIngredientId) || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: "Invalid ingredient payload" });
    }

    await pool.query(
      `
      INSERT INTO product_ingredient
        (product_id, ingredient_id, quantity_used, prep_note,
         unit_cost_derived, line_cost_derived)
      VALUES ($1, $2, $3, $4, NULL, NULL)
      `,
      [productId, parsedIngredientId, parsedQuantity, prepNote || null],
    );

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:productId/ingredients/:lineId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const lineId = Number(req.params.lineId);
    const { ingredientId, quantityUsed, prepNote } = req.body;

    if (!Number.isInteger(productId) || !Number.isInteger(lineId)) {
      return res.status(400).json({ error: "Invalid product line" });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (ingredientId !== undefined) {
      const parsedIngredientId = Number(ingredientId);
      if (!Number.isFinite(parsedIngredientId)) {
        return res.status(400).json({ error: "Invalid ingredient" });
      }
      fields.push(`ingredient_id = $${idx++}`);
      values.push(parsedIngredientId);
    }

    if (quantityUsed !== undefined) {
      const parsedQuantity = Number(quantityUsed);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than zero" });
      }
      fields.push(`quantity_used = $${idx++}`);
      values.push(parsedQuantity);
    }

    if (prepNote !== undefined) {
      fields.push(`prep_note = $${idx++}`);
      values.push(prepNote || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    values.push(productId);
    values.push(lineId);

    await pool.query(
      `
      UPDATE product_ingredient
      SET ${fields.join(", ")}
      WHERE product_id = $${idx++} AND id = $${idx}
      `,
      values,
    );

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:productId/ingredients/:lineId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const lineId = Number(req.params.lineId);

    if (!Number.isInteger(productId) || !Number.isInteger(lineId)) {
      return res.status(400).json({ error: "Invalid product line" });
    }

    await pool.query(
      `
      DELETE FROM product_ingredient
      WHERE product_id = $1 AND id = $2
      `,
      [productId, lineId],
    );

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
