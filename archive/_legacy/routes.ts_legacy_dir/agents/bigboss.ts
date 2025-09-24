import { askGPT } from "../utils/gptUtils";
import { db } from "../db";
import { chatLogs, aiInsights, dailyStockSales } from "../../shared/schema";
import { desc } from "drizzle-orm";

export class BigBossAgent {
  name = "Big Boss";
  specialty = "Director & Team Oversight";

  async handleMessage(message: string): Promise<string> {
    // Get context from recent team activities
    const teamContext = await this.getTeamContext();

    const prompt = `You are Big Boss, the Director overseeing the restaurant management team including:
    - Ollie (Operations & Stock Management)
    - Sally (Finance & Expenses) 
    - Marlo (Marketing & Content)
    
    Your role is to:
    - Provide strategic oversight and decision-making
    - Mediate conflicts between team members
    - Delegate tasks to appropriate agents
    - Ensure operational efficiency across all departments
    - Make executive decisions on restaurant management
    - Oversee performance and guide team direction
    
    Current team activity context:
    ${teamContext}
    
    User message: "${message}"
    
    Respond with authority, decisiveness, and strategic insight. If this involves team coordination, provide clear directives. If it's about delegation, specify which team member should handle the task. Keep your response professional but assertive, befitting a director role.`;

    return await askGPT(prompt, this.name);
  }

  private async getTeamContext(): Promise<string> {
    try {
      // Get recent chat interactions from all agents
      const recentChats = await db
        .select()
        .from(chatLogs)
        .orderBy(desc(chatLogs.createdAt))
        .limit(10);

      // Get recent AI insights
      const recentInsights = await db
        .select()
        .from(aiInsights)
        .orderBy(desc(aiInsights.createdAt))
        .limit(5);

      // Get recent operational data
      const [recentOperations] = await db
        .select()
        .from(dailyStockSales)
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      return `Recent team interactions: ${JSON.stringify(recentChats.slice(0, 3))}
Recent business insights: ${JSON.stringify(recentInsights)}
Latest operational status: ${recentOperations ? JSON.stringify({
        shift: recentOperations.shiftType,
        date: recentOperations.shiftDate,
        completed: !recentOperations.isDraft
      }) : 'No recent operations data'}
Restaurant status: Operational with active POS integration and AI analytics`;

    } catch (error) {
      console.error("Error fetching team context:", error);
      return "Team oversight active. All departments operational and reporting normally.";
    }
  }
}