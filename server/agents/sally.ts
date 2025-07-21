import { askGPT } from "../utils/gptUtils.js";
import { db } from "../utils/dbUtils.js";
import { desc, sql } from "drizzle-orm";

export class SallyAgent {
  name = "Sally";
  specialty = "Finance & Expenses";

  async handleMessage(message: string): Promise<string> {
    // Get recent financial data for context
    const financialContext = await this.getFinancialContext();

    const prompt = `You are Sally, a restaurant finance and expense management specialist. You help with:
    - Expense tracking and categorization
    - Financial reporting and analysis
    - Budget planning and cost control
    - Payment processing and reconciliation
    - Profitability analysis
    - Tax preparation support
    
    Current financial context:
    ${financialContext}
    
    User question: "${message}"
    
    Provide helpful financial advice and analysis. Include specific numbers when available and actionable recommendations for cost optimization.`;

    return await askGPT(prompt, this.name);
  }

  private async getFinancialContext(): Promise<string> {
    try {
      // Get recent expenses
      const recentExpenses = await db
        .select()
        .from(db.schema.expenses)
        .orderBy(desc(db.schema.expenses.createdAt))
        .limit(10);

      // Get expense summary for current month
      const monthlyExpenses = await db
        .select({
          category: db.schema.expenses.category,
          total: sql<number>`sum(${db.schema.expenses.amount})`
        })
        .from(db.schema.expenses)
        .where(sql`extract(month from ${db.schema.expenses.date}) = extract(month from current_date)`)
        .groupBy(db.schema.expenses.category);

      // Get recent sales data
      const [recentSales] = await db
        .select()
        .from(db.schema.dailyStockSales)
        .orderBy(desc(db.schema.dailyStockSales.createdAt))
        .limit(1);

      return `Recent expenses: ${JSON.stringify(recentExpenses.slice(0, 5))}
Monthly expense summary: ${JSON.stringify(monthlyExpenses)}
Recent sales data: ${recentSales ? JSON.stringify(recentSales.salesData) : 'No recent sales data'}`;

    } catch (error) {
      console.error("Error fetching financial data:", error);
      return "Financial data currently unavailable.";
    }
  }
}