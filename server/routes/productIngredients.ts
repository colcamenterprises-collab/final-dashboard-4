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

    if (!ingredientId || !quantityUsed || quantityUsed <= 0) {
      return res.status(400).json({ error: "Invalid ingredient payload" });
    }

    await pool.query(
      `
      INSERT INTO product_ingredient
        (product_id, ingredient_id, quantity_used, prep_note,
         unit_cost_derived, line_cost_derived)
      VALUES ($1, $2, $3, $4, 0, 0)
      `,
      [productId, ingredientId, quantityUsed, prepNote || null],
    );

    const cost = await recalcProductCosts(productId);
    res.json({ success: true, ...cost });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
