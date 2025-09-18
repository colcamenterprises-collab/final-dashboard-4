/**
 * 🚨 DO NOT MODIFY 🚨
 * Jussi Daily Report Generator
 * Uses Loyverse receipts, staff forms, and recipes to build summary.
 */
import { db } from "../db.js";
import { dailyReceiptSummaries, dailySales, expenses, recipes } from "../../shared/schema.js";
import { getLoyverseReceipts, getShiftReport } from "../utils/loyverse.js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateJussiReport(date) {
  const receipts = await getLoyverseReceipts({ date });
  const shift = await getShiftReport({ date });
  const form = await db.query.dailySales.findFirst({ where: (t, { eq }) => eq(t.date, date) });
  const purchases = await db.query.expenses.findMany({ where: (t, { eq }) => eq(t.date, date) });
  const recipeList = await db.query.recipes.findMany();

  // Build OpenAI prompt
  const prompt = `
  You are Jussi, Head of Ops. Analyze data for shift ${date}.
  Inputs:
  - Receipts: ${JSON.stringify(receipts)}
  - Shift Report: ${JSON.stringify(shift)}
  - Staff Form: ${JSON.stringify(form)}
  - Purchases: ${JSON.stringify(purchases)}
  - Recipes: ${JSON.stringify(recipeList)}

  Tasks:
  1. Sales vs POS: Compare staff form totals (gross, net, grab, qr, direct, expenses) vs shift report. Flag any mismatch.
  2. Stock Usage:
     - Rolls: Expected = Start + Purchases – BurgersSold. Flag if variance < -4 or > +4.
     - Meat: 90g per patty. Flag if variance > 500g.
     - Drinks: 1 per sale. Flag if variance > 2 units.
  3. Basket of Goods: Count burgers, side orders, modifiers sold.
  4. Ingredient Breakdown: For each menu item sold, calculate expected ingredient usage based on recipes. Return totals.
  5. Top 5 Items Sold (by qty).
  6. Payment Breakdown: Total by cash, qr, grab, direct.
  7. Flags: List all anomalies clearly.

  Output JSON ONLY in structure:
  {
    top5Items: [{item, qty}],
    paymentBreakdown: [{method, amount}],
    basketBreakdown: {burgers, sides, modifiers},
    ingredientUsage: [{ingredient, expected, actual, variance, status}],
    variances: {salesVsPOS: [{field, formValue, posValue, status}], stockUsage: [{item, expected, actual, variance, status}]},
    flags: [ "text summary of issues" ]
  }
  `;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: "You are Jussi, operations AI." }, { role: "user", content: prompt }],
  });

  const data = JSON.parse(resp.choices[0].message.content);

  await db.insert(dailyReceiptSummaries).values({ shiftDate: date, data })
    .onConflictDoUpdate({ target: dailyReceiptSummaries.shiftDate, set: { data } });

  return data;
}