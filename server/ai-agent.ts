import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeReport(textContent: string, filename: string) {
  try {
    const prompt = `
You are analyzing a Loyverse POS report. Please extract and summarize the following information from this report:

1. Total sales amount
2. Number of orders/receipts
3. Items sold (name, quantity, sales amount)
4. Payment method breakdown
5. Any anomalies or unusual patterns
6. Stock usage estimates for key items:
   - Burger rolls/buns used
   - Meat patties used
   - Drinks sold
   - French fries sold

Please structure your response as JSON with this exact format:
{
  "totalSales": number,
  "totalOrders": number,
  "topItems": [
    {"name": "item name", "quantity": number, "sales": number}
  ],
  "paymentMethods": {
    "cash": number,
    "card": number,
    "other": number
  },
  "anomalies": [
    "description of any unusual patterns"
  ],
  "stockUsage": {
    "rolls": number,
    "meat": number,
    "drinks": number,
    "fries": number
  },
  "shiftDate": "YYYY-MM-DD",
  "summary": "Brief summary of the shift performance"
}

Report content:
${textContent}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse JSON, with fallback handling
    try {
      return JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse AI response as JSON');
    }
  } catch (error) {
    console.error('Error analyzing report:', error);
    throw error;
  }
}

export async function updateDashboardFromAnalysis(analysis: any, shiftDate: string) {
  try {
    const { db } = await import('./db');
    const { dailyShiftSummary, shiftItemSales } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');

    // Update daily shift summary
    await db.insert(dailyShiftSummary).values({
      shiftDate,
      burgersSold: analysis.stockUsage?.rolls || 0,
      pattiesUsed: analysis.stockUsage?.meat || 0,
      rollsStart: 0, // Will be filled by staff forms
      rollsPurchased: 0, // Will be filled by staff forms
      rollsExpected: analysis.stockUsage?.rolls || 0,
      rollsActual: 0, // Will be filled by staff forms
      rollsVariance: 0,
      varianceFlag: false,
    }).onConflictDoUpdate({
      target: dailyShiftSummary.shiftDate,
      set: {
        burgersSold: analysis.stockUsage?.rolls || 0,
        pattiesUsed: analysis.stockUsage?.meat || 0,
        rollsExpected: analysis.stockUsage?.rolls || 0,
      }
    });

    // Clear existing item sales for this shift
    await db.delete(shiftItemSales).where(eq(shiftItemSales.shiftDate, shiftDate));

    // Insert new item sales
    if (analysis.topItems && Array.isArray(analysis.topItems)) {
      for (const item of analysis.topItems) {
        await db.insert(shiftItemSales).values({
          shiftDate,
          itemName: item.name,
          quantity: item.quantity,
          salesTotal: item.sales.toString(),
        });
      }
    }

    return { success: true, message: 'Dashboard updated successfully' };
  } catch (error) {
    console.error('Error updating dashboard:', error);
    throw error;
  }
}