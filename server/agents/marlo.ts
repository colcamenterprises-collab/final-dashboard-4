import { askGPT } from "../utils/gptUtils.js";
import { db } from "../db.js";
import { dailyStockSales, aiInsights } from "../../shared/schema.js";
import { desc } from "drizzle-orm";

export class MarloAgent {
  name = "Marlo";
  specialty = "Marketing & Content";

  async handleMessage(message: string): Promise<string> {
    // Get recent operational data for marketing insights
    const marketingContext = await this.getMarketingContext();

    const prompt = `You are Marlo, a restaurant marketing and content specialist. You help with:
    - Social media content creation
    - Menu descriptions and food photography ideas
    - Promotional campaigns and special offers
    - Customer engagement strategies
    - Brand messaging and voice
    - Delivery platform optimization (GrabFood, FoodPanda)
    - Review management and reputation
    
    Current restaurant context for marketing insights:
    ${marketingContext}
    
    User question: "${message}"
    
    Provide creative, actionable marketing advice. Include specific content ideas, promotional strategies, or brand messaging suggestions when relevant.`;

    return await askGPT(prompt, this.name);
  }

  private async getMarketingContext(): Promise<string> {
    try {
      // Get recent sales for popular items analysis
      const [recentSales] = await db
        .select()
        .from(dailyStockSales)
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      // Get recent AI insights for trends
      const recentInsights = await db
        .select()
        .from(aiInsights)
        .orderBy(desc(aiInsights.createdAt))
        .limit(5);

      return `Recent sales data for trend analysis: ${recentSales ? JSON.stringify(recentSales.salesData) : 'No recent sales data'}
Recent business insights: ${JSON.stringify(recentInsights)}
Restaurant type: Burger restaurant with delivery focus
Target audience: Local customers and delivery platform users`;

    } catch (error) {
      console.error("Error fetching marketing context:", error);
      return "Restaurant specializes in burgers with focus on delivery platforms. Marketing context currently being updated.";
    }
  }
}