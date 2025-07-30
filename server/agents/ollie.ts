import { askGPT } from "../utils/gptUtils";
import { db } from "../db";
import { dailyStockSales } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export class OllieAgent {
  name = "Ollie";
  specialty = "Operations & Stock Management";

  async handleMessage(message: string): Promise<string> {
    // Get recent stock data for context
    const recentStockData = await this.getRecentStockData();
    const stockContext = recentStockData ? `Recent stock data: ${JSON.stringify(recentStockData)}` : "No recent stock data available.";

    const prompt = `You are Ollie, a restaurant operations and stock management specialist. You help with:
    - Inventory tracking and stock levels
    - Daily operations optimization
    - Food safety and storage
    - Equipment maintenance
    - Staff scheduling for operations
    
    Current restaurant context:
    ${stockContext}
    
    User question: "${message}"
    
    Provide a helpful, professional response focused on operations and stock management. Keep responses concise but informative.`;

    return await askGPT(prompt, this.name);
  }

  private async getRecentStockData() {
    try {
      const [recentForm] = await db
        .select()
        .from(dailyStockSales)
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      return recentForm ? {
        date: recentForm.shiftDate,
        burgerBuns: recentForm.burgerBunsStock,
        startingCash: recentForm.startingCash,
        totalSales: recentForm.totalSales
      } : null;
    } catch (error) {
      console.error("Error fetching stock data:", error);
      return null;
    }
  }
}