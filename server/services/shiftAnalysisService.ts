import { db } from "../db";
import { dailyStockSales, loyverseShiftReports, aiInsights } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export interface ShiftAnalysisResult {
  balance: 'Yes' | 'No';
  anomalies: string[];
  salesDiff: number;
  expenseDiff: number;
  cashDiff: number;
  shiftData: {
    report: any;
    form: any;
  };
}

export class ShiftAnalysisService {
  /**
   * Compare shift report vs staff form data for anomalies
   * @param shiftDate - Date of the shift to analyze
   * @returns Analysis results with balance status and anomalies
   */
  async analyzeShiftData(shiftDate: string): Promise<ShiftAnalysisResult> {
    try {
      // Get latest shift report for the date
      const shiftReport = await db
        .select()
        .from(loyverseShiftReports)
        .where(eq(loyverseShiftReports.shiftDate, new Date(shiftDate)))
        .orderBy(desc(loyverseShiftReports.createdAt))
        .limit(1);

      // Get staff form for the same date
      const staffForm = await db
        .select()
        .from(dailyStockSales)
        .where(eq(dailyStockSales.shiftDate, new Date(shiftDate)))
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      if (!shiftReport.length || !staffForm.length) {
        throw new Error(`Missing data: ${!shiftReport.length ? 'shift report' : 'staff form'} for ${shiftDate}`);
      }

      const report = shiftReport[0];
      const form = staffForm[0];
      const anomalies: string[] = [];

      // Parse report data (stored as JSON)
      const reportData = typeof report.reportData === 'string' 
        ? JSON.parse(report.reportData) 
        : report.reportData;

      // Compare sales figures (5% tolerance or ฿50 minimum)
      const reportSales = reportData.net_sales || 0;
      const formSales = parseFloat(form.totalSales || '0');
      const salesDiff = Math.abs(reportSales - formSales);
      const salesThreshold = Math.max(reportSales * 0.05, 50);

      if (salesDiff > salesThreshold) {
        anomalies.push(`Sales difference: ฿${salesDiff.toFixed(2)} (Report: ฿${reportSales}, Form: ฿${formSales})`);
      }

      // Compare expenses (฿50 tolerance)
      const reportExpenses = (reportData.total_discount || 0) + (reportData.total_tax || 0);
      const formExpenses = parseFloat(form.totalExpenses || '0');
      const expenseDiff = Math.abs(reportExpenses - formExpenses);

      if (expenseDiff > 50) {
        anomalies.push(`Expense difference: ฿${expenseDiff.toFixed(2)} (Report: ฿${reportExpenses}, Form: ฿${formExpenses})`);
      }

      // Compare cash sales (฿50 tolerance)
      const reportCash = reportData.cash_sales || 0;
      const formCash = parseFloat(form.cashSales || '0');
      const cashDiff = Math.abs(reportCash - formCash);

      if (cashDiff > 50) {
        anomalies.push(`Cash difference: ฿${cashDiff.toFixed(2)} (Report: ฿${reportCash}, Form: ฿${formCash})`);
      }

      // Determine balance status
      const balance = anomalies.length === 0 ? 'Yes' : 'No';

      // Store analysis result
      const analysisDescription = anomalies.length === 0 
        ? `Balance: ${balance}. No anomalies detected.`
        : `Balance: ${balance}. Anomalies: ${anomalies.join(', ')}`;

      await db.insert(aiInsights).values({
        type: 'shift_analysis',
        description: analysisDescription,
        data: { 
          report: reportData, 
          form: form,
          analysis: {
            balance,
            anomalies,
            salesDiff,
            expenseDiff,
            cashDiff
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        balance,
        anomalies,
        salesDiff,
        expenseDiff,
        cashDiff,
        shiftData: {
          report: reportData,
          form
        }
      };

    } catch (error) {
      console.error('Error analyzing shift data:', error);
      throw error;
    }
  }

  /**
   * Get latest shift analysis results
   */
  async getLatestShiftAnalysis(): Promise<any> {
    try {
      const analysis = await db
        .select()
        .from(aiInsights)
        .where(eq(aiInsights.type, 'shift_analysis'))
        .orderBy(desc(aiInsights.createdAt))
        .limit(1);

      return analysis.length > 0 ? analysis[0] : null;
    } catch (error) {
      console.error('Error fetching latest shift analysis:', error);
      return null;
    }
  }
}

export const shiftAnalysisService = new ShiftAnalysisService();