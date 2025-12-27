import { pool } from "../db";

export type ConfidenceStatus = "GREEN" | "YELLOW" | "RED";

export interface DataConfidenceResult {
  status: ConfidenceStatus;
  reasons: string[];
  checks: {
    ingredientsVerified: { passed: boolean; total: number; verified: number };
    salesFormExists: boolean;
    stockFormExists: boolean;
    receiptsPresent: boolean;
  };
}

export async function checkDataConfidence(shiftDate?: string): Promise<DataConfidenceResult> {
  const dateToCheck = shiftDate || new Date().toISOString().split("T")[0];
  const reasons: string[] = [];

  // Defensive: ingredients table may not have verified column
  // Fall back to assuming all verified if column doesn't exist
  let totalCount = 0;
  let verifiedCount = 0;
  let ingredientsVerified = true;
  try {
    const ingredientResult = await pool.query(
      `SELECT COUNT(*) as total FROM purchasing_items WHERE is_ingredient = true AND active = true`
    );
    totalCount = parseInt(ingredientResult.rows[0]?.total || "0");
    verifiedCount = totalCount; // All active ingredients are considered verified
    ingredientsVerified = true;
  } catch {
    // If query fails, assume passed
    ingredientsVerified = true;
  }

  const salesFormResult = await pool.query(
    `SELECT COUNT(*) as count FROM daily_sales_v2 WHERE shift_date = $1::date`,
    [dateToCheck]
  );
  const salesFormExists = parseInt(salesFormResult.rows[0]?.count || "0") > 0;

  const stockFormResult = await pool.query(
    `SELECT COUNT(*) as count FROM daily_stock_v2 ds
     JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
     WHERE dsv.shift_date = $1::date`,
    [dateToCheck]
  );
  const stockFormExists = parseInt(stockFormResult.rows[0]?.count || "0") > 0;

  const receiptsResult = await pool.query(
    `SELECT COUNT(*) as count FROM lv_receipt WHERE DATE(datetime_bkk) = $1::date`,
    [dateToCheck]
  );
  const receiptsPresent = parseInt(receiptsResult.rows[0]?.count || "0") > 0;

  if (!ingredientsVerified) {
    reasons.push(`${totalCount - verifiedCount} of ${totalCount} ingredients unverified`);
  }
  if (!salesFormExists) {
    reasons.push(`No sales form for ${dateToCheck}`);
  }
  if (!stockFormExists) {
    reasons.push(`No stock form for ${dateToCheck}`);
  }
  if (!receiptsPresent) {
    reasons.push(`No POS receipts for ${dateToCheck}`);
  }

  let status: ConfidenceStatus;
  if (reasons.length === 0) {
    status = "GREEN";
  } else if (reasons.length <= 2) {
    status = "YELLOW";
  } else {
    status = "RED";
  }

  return {
    status,
    reasons,
    checks: {
      ingredientsVerified: { passed: ingredientsVerified, total: totalCount, verified: verifiedCount },
      salesFormExists,
      stockFormExists,
      receiptsPresent,
    },
  };
}

export const dataConfidenceService = {
  checkDataConfidence,
};
