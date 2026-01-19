import { pool } from "../db";

export type ProductActivationResult = {
  ok: boolean;
  productId: number;
  totalCost: number | null;
  margin: number | null;
  reasons: string[];
};

const formatIngredientLabel = (name: string | null, id: number) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : `Ingredient #${id}`;
};

export async function validateAndActivateProduct(productId: number): Promise<ProductActivationResult> {
  const reasons: string[] = [];

  const { rows } = await pool.query(
    `
    SELECT id, sale_price
    FROM product
    WHERE id = $1
    `,
    [productId],
  );

  const product = rows[0];
  if (!product) {
    return {
      ok: false,
      productId,
      totalCost: null,
      margin: null,
      reasons: ["Product not found"],
    };
  }

  const salePrice = Number(product.sale_price);
  const salePriceValid = Number.isFinite(salePrice) && salePrice > 0;
  if (!salePriceValid) {
    reasons.push("Sale price must be greater than zero");
  }

  const { rows: ingredientRows } = await pool.query(
    `
    SELECT
      pi.id,
      pi.quantity_used,
      pi.unit_cost_derived,
      pi.line_cost_derived,
      i.name as ingredient_name
    FROM product_ingredient pi
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = $1
    ORDER BY pi.id
    `,
    [productId],
  );

  if (ingredientRows.length === 0) {
    reasons.push("No ingredient lines found");
  }

  let totalCost = 0;
  let totalCostValid = ingredientRows.length > 0;

  for (const row of ingredientRows) {
    const label = formatIngredientLabel(row.ingredient_name, Number(row.id));
    const qty = Number(row.quantity_used);
    const unitCost = Number(row.unit_cost_derived);
    const lineCost = Number(row.line_cost_derived);

    if (!Number.isFinite(qty) || qty <= 0) {
      reasons.push(`Missing quantity for ${label}`);
      totalCostValid = false;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      reasons.push(`Missing unit cost for ${label}`);
      totalCostValid = false;
    }

    if (!Number.isFinite(lineCost) || lineCost < 0) {
      reasons.push(`Missing line cost for ${label}`);
      totalCostValid = false;
    }

    if (Number.isFinite(lineCost) && lineCost >= 0) {
      totalCost += lineCost;
    }
  }

  const totalCostValue = totalCostValid ? Number(totalCost.toFixed(2)) : null;
  if (totalCostValue === null) {
    reasons.push("Total cost is not computable");
  }

  if (salePriceValid && totalCostValue !== null && salePrice <= totalCostValue) {
    reasons.push("Sale price must exceed total cost");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      productId,
      totalCost: totalCostValue,
      margin: salePriceValid && totalCostValue !== null ? (salePrice - totalCostValue) / salePrice : null,
      reasons,
    };
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
    ok: true,
    productId,
    totalCost: totalCostValue ?? 0,
    margin: (salePrice - (totalCostValue ?? 0)) / salePrice,
    reasons: [],
  };
}
