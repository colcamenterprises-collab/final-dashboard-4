import { pool } from "../db";
import { recalcProductCosts } from "./productCost.service";

export async function validateAndActivateProduct(productId: number): Promise<{
  productId: number;
  totalCost: number;
  margin: number;
}> {
  const { rows } = await pool.query(
    `
    SELECT id, name, description, image_url, sale_price
    FROM product
    WHERE id = $1
    `,
    [productId],
  );

  const product = rows[0];
  if (!product) {
    throw new Error("Product not found");
  }

  if (!product.name) throw new Error("Product name required");
  if (!product.description) throw new Error("Product description required");
  if (!product.image_url) throw new Error("Product image required");

  const salePrice = Number(product.sale_price);
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error("Sale price must be greater than zero");
  }

  const ingredientCount = await pool.query(
    `SELECT COUNT(*)::int AS c FROM product_ingredient WHERE product_id = $1`,
    [productId],
  );

  if (ingredientCount.rows[0]?.c === 0) {
    throw new Error("At least one ingredient required");
  }

  const { totalCost } = await recalcProductCosts(productId);

  if (salePrice <= totalCost) {
    throw new Error("Sale price must exceed total cost");
  }

  await pool.query(
    `
    UPDATE product
    SET active = TRUE,
        updated_at = NOW()
    WHERE id = $1
    `,
    [productId],
  );

  return {
    productId,
    totalCost,
    margin: (salePrice - totalCost) / salePrice,
  };
}
