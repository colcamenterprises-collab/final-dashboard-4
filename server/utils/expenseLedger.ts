import { db } from "../db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export type DirectExpense = {
  item?: string;
  description?: string;
  costCents?: number;
  shop?: string;
  category?: string;
};

export async function insertDirectExpensesFromShift(shiftDate: Date, expenses: DirectExpense[]) {
  if (!Array.isArray(expenses) || expenses.length === 0) return;
  
  // Get the restaurant ID for Smash Brothers Burgers
  const { rows } = await db.execute(sql`
    SELECT "id" FROM "restaurants" LIMIT 1
  `);
  
  const restaurantId = rows?.[0]?.id;
  if (!restaurantId) {
    console.error("Restaurant ID not found for Smash Brothers Burgers");
    return;
  }
  
  for (const e of expenses) {
    const id = randomUUID();
    const item = (e.item || e.description || "Expense").slice(0, 255);
    const costCents = Number.isFinite(e.costCents) ? Number(e.costCents) : (Number(e.cost) * 100 || 0);
    const supplier = (e.shop || "Unknown").slice(0, 255);
    const expenseType = (e.category || "Misc").slice(0, 64);
    await db.execute(sql`
      INSERT INTO "expenses" 
        ("id","restaurantId","shiftDate","item","costCents","supplier","expenseType","meta","source","createdAt")
      VALUES (${id}, ${restaurantId}, ${shiftDate}, ${item}, ${costCents}, ${supplier}, ${expenseType}, '{}'::jsonb, 'SHIFT_FORM', NOW())
    `);
  }
}

export async function insertRollsExpenseLodgment(shiftDate: Date, item: string, qty: number, unitPriceCents: number, supplier: string) {
  // Get the restaurant ID for Smash Brothers Burgers
  const { rows } = await db.execute(sql`
    SELECT "id" FROM "restaurants" LIMIT 1
  `);
  
  const restaurantId = rows?.[0]?.id;
  if (!restaurantId) {
    console.error("Restaurant ID not found for Smash Brothers Burgers");
    return;
  }
  
  const id = randomUUID();
  const costCents = Math.max(0, Math.round(qty * unitPriceCents));
  await db.execute(sql`
    INSERT INTO "expenses"
      ("id","restaurantId","shiftDate","item","costCents","supplier","expenseType","meta","source","createdAt")
    VALUES (${id}, ${restaurantId}, ${shiftDate}, ${item}, ${costCents}, ${supplier}, 'Rolls', '{}'::jsonb, 'STOCK_LODGMENT', NOW())
  `);
}

export async function getExpenseTotalsForShiftDate(shiftDate: Date) {
  const { rows } = await db.execute(sql`
    SELECT 
      SUM(CASE WHEN source = 'DIRECT' THEN "costCents" ELSE 0 END) as direct,
      SUM(CASE WHEN source = 'SHIFT_FORM' THEN "costCents" ELSE 0 END) as shift_form,
      SUM(CASE WHEN source = 'STOCK_LODGMENT' THEN "costCents" ELSE 0 END) as stock_lodgment
    FROM "expenses"
    WHERE DATE("shiftDate") = DATE(${shiftDate})
  `);
  
  const row = rows?.[0] || { direct: 0, shift_form: 0, stock_lodgment: 0 };
  return {
    direct: Number(row.direct) || 0,
    business: Number(row.shift_form) || 0,
    stock: Number(row.stock_lodgment) || 0,
  };
}