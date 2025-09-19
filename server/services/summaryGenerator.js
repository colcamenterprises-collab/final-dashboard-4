import { db } from "../db.js";
import { dailyReceiptSummaries, dailySalesV2, expenses, recipes } from "../../shared/schema.js";
import { getShiftReport, getLoyverseReceipts } from "../utils/loyverse.js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateJussiReport(date) {
  try {
    console.log(`Starting Jussi report generation for ${date}`);
    
    // 1. Pull data sources
    // Get store ID from environment or use default
    const storeId = process.env.LOYVERSE_STORE_ID;
    
    console.log('Fetching shift report...');
    const shift = await getShiftReport({ date, storeId });       // ✅ Gross, Net, Discounts, Refunds, Cash Drawer
    
    console.log('Fetching receipts...');
    const receipts = await getLoyverseReceipts({ date, storeId });
    
    console.log('Fetching form data...');
    const form = await db.query.dailySalesV2.findFirst({ where: (t, { eq }) => eq(t.date, new Date(date)) });
    
    console.log('Fetching purchases...');
    const purchases = await db.query.expenses.findMany({ where: (t, { eq }) => eq(t.date, new Date(date)) });
    
    console.log('Fetching recipes...');
    const recipeList = await db.query.recipes.findMany();

  // 2. Build OpenAI prompt
  const prompt = `
  You are Jussi, Head of Ops. Build a JSON management report for shift ${date}.
  Compare Staff Form vs POS Shift Report, receipts, and recipes.

  Required Output:
  {
    executiveSummary: "text summary, list mismatches",
    salesVsPOS: [
      { field: "Gross Sales", formValue, posValue, status },
      { field: "Net Sales", formValue, posValue, status },
      { field: "Cash Payments", formValue, posValue, status },
      { field: "Cash Refunds", formValue, posValue, status },
      { field: "Paid In", formValue, posValue, status },
      { field: "Paid Out", formValue, posValue, status },
      { field: "Expected Cash", formValue, posValue, status },
      { field: "Actual Cash", formValue, posValue, status },
      { field: "Difference", formValue, posValue, status },
      { field: "Discounts", formValue, posValue, status },
      { field: "Refunds", formValue, posValue, status }
    ],
    stockUsage: [
      { item: "Rolls", expected, actual, variance, status },
      { item: "Meat", expected, actual, variance, status },
      { item: "Drinks", expected, actual, variance, status }
    ],
    basketBreakdown: { burgers, sides, modifiers },
    top5Items: [{ item, qty }],
    paymentBreakdown: [{ method, amount }],
    flags: [ "list anomalies here" ]
  }

  Rules:
  - Rolls tolerance: ±4
  - Meat tolerance: ±500g
  - Drinks tolerance: ±2 units
  - Flag mismatches with 🚨, balanced with ✅

  Inputs:
  - Shift Report: ${JSON.stringify(shift)}
  - Staff Form: ${JSON.stringify(form)}
  - Receipts: ${JSON.stringify(receipts)}
  - Purchases: ${JSON.stringify(purchases)}
  - Recipes: ${JSON.stringify(recipeList)}
  `;

    console.log('Calling OpenAI...');
    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are Jussi, operations AI. Output ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
    });

    console.log('Parsing OpenAI response...');
    const data = JSON.parse(resp.choices[0].message.content);

    console.log('Saving to database...');
    // 3. Save to DB using raw SQL to avoid date issues
    await db.execute(`
      INSERT INTO "dailyReceiptSummaries" (shift_date, data) 
      VALUES ('${date}', '${JSON.stringify(data)}') 
      ON CONFLICT (shift_date) 
      DO UPDATE SET data = EXCLUDED.data
    `);

    console.log('Jussi report generation completed successfully');
    return data;
  } catch (error) {
    console.error('Error in generateJussiReport:', error);
    throw error;
  }
}