import { askGPT } from "../utils/gptUtils.js";
import { db } from "../db.js";
import { dailyStockSales, shiftReports, receipts, uploadedReports } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";

export class JussiAgent {
  name = "Jussi";
  specialty = "Head of Operations - Analysis & Operations Assistant";

  async handleMessage(message: string): Promise<string> {
    // Get comprehensive context for operations analysis
    const operationalContext = await this.getOperationalContext();
    
    const prompt = `You are Jussi, Head of Operations for Smash Brothers Burgers restaurant. You are an expert in:
    - Operations analysis and anomaly detection
    - Dataset review and interpretation
    - Shift reports and daily operations management
    - Banking discrepancies and cash flow analysis
    - Staff performance and operational efficiency
    - Trend analysis and forecasting
    - Quality control and process improvement
    - Inventory management and waste reduction
    
    Your role is to provide intelligent insights on uploaded datasets, operational reports, and day-to-day restaurant management questions.
    
    Current operational context:
    ${operationalContext}
    
    User request: "${message}"
    
    When analyzing data or answering questions:
    - Identify anomalies, trends, and patterns
    - Provide actionable recommendations
    - Highlight potential issues requiring immediate attention
    - Offer strategic insights for operational improvement
    - Use restaurant-specific terminology and metrics
    - Focus on practical, implementable solutions
    
    Respond as the experienced Head of Operations you are - confident, analytical, and focused on results.`;

    return await askGPT(prompt, this.name);
  }

  private async getOperationalContext() {
    try {
      // Import schema tables from shared schema
      const { loyverseShiftReports, dailyStockSales, loyverseReceipts } = await import("../../shared/schema.js");
      
      // Get recent shift reports and daily forms for context
      const [recentShiftReport] = await db
        .select()
        .from(loyverseShiftReports)
        .orderBy(desc(loyverseShiftReports.createdAt))
        .limit(1);

      const [recentDailyForm] = await db
        .select()
        .from(dailyStockSales)
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      const [recentReceipt] = await db
        .select()
        .from(loyverseReceipts)
        .orderBy(desc(loyverseReceipts.receiptDate))
        .limit(1);

      return {
        lastShiftDate: recentShiftReport?.shiftDate?.toISOString() || "No recent shift data",
        lastShiftStatus: "Available",
        lastFormSubmitted: recentDailyForm?.shiftDate?.toISOString() || "No recent forms",
        lastReceiptDate: recentReceipt?.receiptDate?.toISOString() || "No recent receipts",
        operationalStatus: "Active monitoring enabled"
      };
    } catch (error) {
      console.error("Error fetching operational context:", error);
      return {
        status: "Limited context available",
        note: "Operating with basic operational knowledge"
      };
    }
  }
}