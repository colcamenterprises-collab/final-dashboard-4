import { pool } from "../db";
import { recalcProductCosts } from "./productCost.service";

export async function validateAndActivateProduct(productId: number): Promise<{
  productId: number;
  totalCost: number;
  margin: number;
}> {
  const { rows } = await pool.query(
    `
    SELECT id, name, image_url, sale_price
    FROM product
    WHERE id = $1
    `,
    [productId]
  );

  const product = rows[0];
  if (!product) {
    throw new Error("Product not found");
  }

  if (!product.name || !product.name.trim()) throw new Error("Product name required");
  if (!product.image_url) throw new Error("Product image required");

  const salePrice = Number(product.sale_price);
  if (!Number.isFinite(salePrice)) {
    throw new Error("Sale price must be set");
  }

  const { totalCost } = await recalcProductCosts(productId);
  if (totalCost === null) {
    throw new Error("Total cost is not available");
  }

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
    [productId]
  );

  return {
    productId,
    totalCost,
    margin: (salePrice - totalCost) / salePrice,
  };
}

export async function deactivateProduct(productId: number): Promise<void> {
  await pool.query(
    `
    UPDATE product
    SET active = FALSE,
        updated_at = NOW()
    WHERE id = $1
    `,
    [productId]
  );
}
