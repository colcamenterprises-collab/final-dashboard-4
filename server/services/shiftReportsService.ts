import { db } from "../db";
import { shiftReports, dailyStockSales, type ShiftReport, type InsertShiftReport } from "@shared/schema";
import { eq, desc, like, and, or } from "drizzle-orm";
import jsPDF from 'jspdf';
import path from 'path';
import fs from 'fs';

export class ShiftReportsService {
  // Get all shift reports
  async getShiftReports(): Promise<ShiftReport[]> {
    return await db.select().from(shiftReports).orderBy(desc(shiftReports.reportDate));
  }

  // Get shift report by ID
  async getShiftReportById(id: string): Promise<ShiftReport | undefined> {
    const [report] = await db.select().from(shiftReports).where(eq(shiftReports.id, id));
    return report || undefined;
  }

  // Get shift report by date
  async getShiftReportByDate(date: string): Promise<ShiftReport | undefined> {
    const [report] = await db.select().from(shiftReports).where(eq(shiftReports.reportDate, date));
    return report || undefined;
  }

  // Create new shift report
  async createShiftReport(report: InsertShiftReport): Promise<ShiftReport> {
    const [newReport] = await db.insert(shiftReports).values(report).returning();
    return newReport;
  }

  // Update shift report
  async updateShiftReport(id: string, updates: Partial<ShiftReport>): Promise<ShiftReport> {
    const [updatedReport] = await db
      .update(shiftReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shiftReports.id, id))
      .returning();
    return updatedReport;
  }

  // Delete shift report
  async deleteShiftReport(id: string): Promise<boolean> {
    const result = await db.delete(shiftReports).where(eq(shiftReports.id, id));
    return result.rowCount > 0;
  }

  // Search shift reports
  async searchShiftReports(query?: string, status?: string): Promise<ShiftReport[]> {
    let conditions = [];
    
    if (query) {
      conditions.push(like(shiftReports.reportDate, `%${query}%`));
    }
    
    if (status) {
      conditions.push(eq(shiftReports.status, status));
    }

    if (conditions.length === 0) {
      return this.getShiftReports();
    }

    return await db
      .select()
      .from(shiftReports)
      .where(and(...conditions))
      .orderBy(desc(shiftReports.reportDate));
  }

  // Process shift report data when new data becomes available
  async processShiftData(reportDate: string, salesData?: any, shiftData?: any) {
    let existingReport = await this.getShiftReportByDate(reportDate);
    
    if (!existingReport) {
      // Create new report
      existingReport = await this.createShiftReport({
        reportDate,
        hasDailySales: !!salesData,
        hasShiftReport: !!shiftData,
        salesData,
        shiftData,
        status: 'partial'
      });
    } else {
      // Update existing report
      await this.updateShiftReport(existingReport.id, {
        hasDailySales: salesData ? true : existingReport.hasDailySales,
        hasShiftReport: shiftData ? true : existingReport.hasShiftReport,
        salesData: salesData || existingReport.salesData,
        shiftData: shiftData || existingReport.shiftData,
      });
    }

    // Analyze the data if both sides are available
    if (existingReport.hasDailySales && existingReport.hasShiftReport) {
      await this.analyzeShiftReport(existingReport.id);
    }

    return existingReport;
  }

  // Analyze shift report for discrepancies
  async analyzeShiftReport(reportId: string) {
    const report = await this.getShiftReportById(reportId);
    if (!report || !report.salesData || !report.shiftData) return;

    const salesData = report.salesData as any;
    const shiftData = report.shiftData as any;
    
    // Analyze banking accuracy
    const expectedCash = Number(salesData.cashSales || 0);
    const actualCash = Number(shiftData.cashSales || 0);
    const cashVariance = Math.abs(expectedCash - actualCash);
    let bankingCheck = 'Accurate';
    
    if (cashVariance > 50) {
      bankingCheck = 'Mismatch';
    }

    // Detect anomalies
    const anomalies = [];
    const salesVariance = Math.abs(Number(salesData.totalSales || 0) - Number(shiftData.totalSales || 0));
    
    if (salesVariance > 100) {
      anomalies.push(`Sales variance: ฿${salesVariance.toFixed(2)}`);
    }
    
    if (cashVariance > 50) {
      anomalies.push(`Cash variance: ฿${cashVariance.toFixed(2)}`);
    }

    // Generate shopping list from sales data
    const shoppingList = this.generateShoppingListFromSales(salesData);
    
    // Extract meat, rolls, drinks data
    const meatRollsDrinks = {
      meat: salesData.meatWeight || 0,
      rolls: salesData.burgerBunsStock || 0,
      drinks: salesData.drinkStock || {}
    };

    // Update report with analysis
    await this.updateShiftReport(reportId, {
      bankingCheck,
      anomaliesDetected: anomalies,
      shoppingList,
      meatRollsDrinks,
      status: anomalies.length > 0 ? 'manual_review' : 'complete',
      manualReviewNeeded: anomalies.length > 0
    });
  }

  // Generate shopping list from sales data
  private generateShoppingListFromSales(salesData: any): any[] {
    const shoppingList = [];
    
    // Process inventory categories
    const categories = ['freshFood', 'frozenFood', 'shelfItems', 'kitchenItems', 'packagingItems'];
    
    categories.forEach(category => {
      const categoryData = salesData[category];
      if (categoryData && typeof categoryData === 'object') {
        Object.entries(categoryData).forEach(([item, quantity]) => {
          if (Number(quantity) > 0) {
            shoppingList.push({
              item,
              category,
              quantity: Number(quantity),
              priority: 'medium'
            });
          }
        });
      }
    });

    return shoppingList;
  }

  // Generate PDF report
  async generatePDFReport(reportId: string): Promise<string> {
    const report = await this.getShiftReportById(reportId);
    if (!report) throw new Error('Report not found');

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Smash Brothers Burgers - Shift Report', 20, 30);
    doc.setFontSize(12);
    doc.text(`Date: ${report.reportDate}`, 20, 45);
    doc.text(`Status: ${report.status?.toUpperCase()}`, 120, 45);
    
    let yPosition = 60;
    
    // Daily Sales Form Section
    doc.setFontSize(16);
    doc.text('Daily Sales Form', 20, yPosition);
    yPosition += 15;
    
    if (report.hasDailySales && report.salesData) {
      const salesData = report.salesData as any;
      doc.setFontSize(10);
      doc.text(`Total Sales: ฿${Number(salesData.totalSales || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 10;
      doc.text(`Cash Sales: ฿${Number(salesData.cashSales || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 10;
      doc.text(`Grab Sales: ฿${Number(salesData.grabSales || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 10;
      doc.text(`Total Expenses: ฿${Number(salesData.totalExpenses || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 15;
    } else {
      doc.setFontSize(10);
      doc.text('No Daily Sales Form available', 30, yPosition);
      yPosition += 15;
    }
    
    // POS Shift Report Section
    doc.setFontSize(16);
    doc.text('POS Shift Report', 20, yPosition);
    yPosition += 15;
    
    if (report.hasShiftReport && report.shiftData) {
      const shiftData = report.shiftData as any;
      doc.setFontSize(10);
      doc.text(`Total Sales: ฿${Number(shiftData.totalSales || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 10;
      doc.text(`Cash Sales: ฿${Number(shiftData.cashSales || 0).toFixed(2)}`, 30, yPosition);
      yPosition += 10;
      doc.text(`Orders: ${shiftData.totalOrders || 0}`, 30, yPosition);
      yPosition += 15;
    } else {
      doc.setFontSize(10);
      doc.text('No POS Shift Report available', 30, yPosition);
      yPosition += 15;
    }
    
    // Analysis Section
    doc.setFontSize(16);
    doc.text('Analysis', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(10);
    doc.text(`Banking Check: ${report.bankingCheck || 'Not available'}`, 30, yPosition);
    yPosition += 10;
    
    if (report.anomaliesDetected && report.anomaliesDetected.length > 0) {
      doc.text('Anomalies Detected:', 30, yPosition);
      yPosition += 10;
      report.anomaliesDetected.forEach(anomaly => {
        doc.text(`• ${anomaly}`, 40, yPosition);
        yPosition += 8;
      });
    } else {
      doc.text('No anomalies detected', 30, yPosition);
      yPosition += 10;
    }

    // Save PDF
    const pdfPath = path.join(process.cwd(), 'exports', `shift-report-${report.reportDate}.pdf`);
    const pdfDir = path.dirname(pdfPath);
    
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    
    fs.writeFileSync(pdfPath, doc.output('arraybuffer'));
    
    // Update report with PDF URL
    const pdfUrl = `/exports/shift-report-${report.reportDate}.pdf`;
    await this.updateShiftReport(reportId, { pdfUrl });
    
    return pdfUrl;
  }
}

export const shiftReportsService = new ShiftReportsService();