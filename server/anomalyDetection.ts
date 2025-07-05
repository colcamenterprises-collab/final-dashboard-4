import { db } from "./db";
import { loyverseReceipts } from "@shared/schema";
import { eq, gte, lte, desc, asc, sql } from "drizzle-orm";

export interface AnomalyDetectionResult {
  type: 'price' | 'quantity' | 'timing' | 'pattern' | 'inventory' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: any;
  timestamp: Date;
  receiptId?: string;
  confidence: number;
  recommendations: string[];
}

export class AnomalyDetectionService {
  
  // Main anomaly detection orchestrator
  async detectAnomalies(days: number = 7): Promise<AnomalyDetectionResult[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const anomalies: AnomalyDetectionResult[] = [];
    
    // Get recent receipts for analysis
    const receipts = await this.getReceiptsForAnalysis(startDate, endDate);
    
    if (receipts.length === 0) {
      return anomalies;
    }
    
    // Run multiple detection algorithms
    const priceAnomalies = await this.detectPriceAnomalies(receipts);
    const quantityAnomalies = await this.detectQuantityAnomalies(receipts);
    const timingAnomalies = await this.detectTimingAnomalies(receipts);
    const patternAnomalies = await this.detectPatternAnomalies(receipts);
    const performanceAnomalies = await this.detectPerformanceAnomalies(receipts);
    const inventoryAnomalies = await this.detectInventoryAnomalies(receipts);
    
    anomalies.push(
      ...priceAnomalies,
      ...quantityAnomalies,
      ...timingAnomalies,
      ...patternAnomalies,
      ...performanceAnomalies,
      ...inventoryAnomalies
    );
    
    // Sort by severity and confidence
    return anomalies.sort((a, b) => {
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }
  
  // Price anomaly detection using statistical analysis
  async detectPriceAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const itemPrices: { [key: string]: number[] } = {};
    
    // Collect price data for each item
    receipts.forEach(receipt => {
      const items = this.parseReceiptItems(receipt);
      items.forEach(item => {
        const key = `${item.item_name}_${item.variant_name || 'default'}`;
        if (!itemPrices[key]) itemPrices[key] = [];
        itemPrices[key].push(item.unit_price);
      });
    });
    
    // Analyze price variations for each item
    Object.entries(itemPrices).forEach(([itemKey, prices]) => {
      if (prices.length < 3) return; // Need minimum data points
      
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      
      // Detect outliers (prices beyond 2 standard deviations)
      const outliers = prices.filter(price => Math.abs(price - mean) > 2 * stdDev);
      
      if (outliers.length > 0) {
        const [itemName, variant] = itemKey.split('_');
        anomalies.push({
          type: 'price',
          severity: outliers.length > prices.length * 0.3 ? 'high' : 'medium',
          title: `Price Anomaly: ${itemName}`,
          description: `${itemName}${variant !== 'default' ? ` (${variant})` : ''} shows unusual price variations. Expected: ฿${mean.toFixed(2)}, Found: ฿${outliers.join(', ฿')}`,
          data: {
            item: itemName,
            variant: variant !== 'default' ? variant : null,
            expected_price: mean,
            anomalous_prices: outliers,
            standard_deviation: stdDev
          },
          timestamp: new Date(),
          confidence: Math.min(0.9, outliers.length / prices.length + 0.5),
          recommendations: [
            'Check POS system for pricing errors',
            'Verify staff training on pricing procedures',
            'Review recent price changes or promotions'
          ]
        });
      }
    });
    
    return anomalies;
  }
  
  // Quantity anomaly detection
  async detectQuantityAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const itemQuantities: { [key: string]: number[] } = {};
    
    // Collect quantity data
    receipts.forEach(receipt => {
      const items = this.parseReceiptItems(receipt);
      items.forEach(item => {
        const key = `${item.item_name}_${item.variant_name || 'default'}`;
        if (!itemQuantities[key]) itemQuantities[key] = [];
        itemQuantities[key].push(item.quantity);
      });
    });
    
    // Detect unusual quantities
    Object.entries(itemQuantities).forEach(([itemKey, quantities]) => {
      const maxQuantity = Math.max(...quantities);
      const avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      
      // Flag items with unusually high quantities
      if (maxQuantity > avgQuantity * 5 && maxQuantity > 10) {
        const [itemName, variant] = itemKey.split('_');
        anomalies.push({
          type: 'quantity',
          severity: maxQuantity > 20 ? 'high' : 'medium',
          title: `Unusual Quantity: ${itemName}`,
          description: `${itemName} ordered in unusually large quantity (${maxQuantity}x). Average is ${avgQuantity.toFixed(1)}x`,
          data: {
            item: itemName,
            variant: variant !== 'default' ? variant : null,
            max_quantity: maxQuantity,
            average_quantity: avgQuantity
          },
          timestamp: new Date(),
          confidence: Math.min(0.95, (maxQuantity - avgQuantity) / avgQuantity),
          recommendations: [
            'Verify large orders are legitimate',
            'Check for staff errors or training needs',
            'Review inventory levels for bulk orders'
          ]
        });
      }
    });
    
    return anomalies;
  }
  
  // Timing anomaly detection
  async detectTimingAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const hourlyTransactions: { [key: number]: number } = {};
    
    // Group transactions by hour
    receipts.forEach(receipt => {
      const date = new Date(receipt.receiptDate);
      const hour = date.getHours();
      hourlyTransactions[hour] = (hourlyTransactions[hour] || 0) + 1;
    });
    
    // Calculate expected patterns (restaurant typically busy 7-9pm)
    const expectedBusyHours = [19, 20, 21]; // 7-9pm
    const expectedQuietHours = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // 3am-3pm
    
    // Detect unusual activity patterns
    expectedQuietHours.forEach(hour => {
      const transactions = hourlyTransactions[hour] || 0;
      if (transactions > 5) { // More than 5 transactions during quiet hours
        anomalies.push({
          type: 'timing',
          severity: transactions > 10 ? 'medium' : 'low',
          title: `Unusual Activity During Quiet Hours`,
          description: `${transactions} transactions at ${hour}:00. This is typically a quiet period.`,
          data: {
            hour: hour,
            transaction_count: transactions,
            expected_range: '0-2 transactions'
          },
          timestamp: new Date(),
          confidence: Math.min(0.8, transactions / 15),
          recommendations: [
            'Review staff scheduling',
            'Check for special events or promotions',
            'Verify transaction legitimacy'
          ]
        });
      }
    });
    
    return anomalies;
  }
  
  // Pattern anomaly detection
  async detectPatternAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const dailyTotals: { [key: string]: number } = {};
    const paymentMethods: { [key: string]: number } = {};
    
    // Analyze daily totals and payment methods
    receipts.forEach(receipt => {
      const date = new Date(receipt.receiptDate).toISOString().split('T')[0];
      const total = parseFloat(receipt.totalAmount || '0');
      
      dailyTotals[date] = (dailyTotals[date] || 0) + total;
      
      // Count payment methods (if available in receipt data)
      const paymentMethod = receipt.paymentMethod || 'Unknown';
      paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] || 0) + 1;
    });
    
    // Detect unusual daily sales patterns
    const dailyValues = Object.values(dailyTotals);
    if (dailyValues.length > 1) {
      const avgDaily = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
      const maxDaily = Math.max(...dailyValues);
      const minDaily = Math.min(...dailyValues);
      
      // Flag days with extreme sales
      if (maxDaily > avgDaily * 2) {
        anomalies.push({
          type: 'pattern',
          severity: 'medium',
          title: `Unusually High Sales Day`,
          description: `Daily sales reached ฿${maxDaily.toFixed(2)}, significantly above average of ฿${avgDaily.toFixed(2)}`,
          data: {
            max_daily_sales: maxDaily,
            average_daily_sales: avgDaily,
            variance: maxDaily - avgDaily
          },
          timestamp: new Date(),
          confidence: Math.min(0.9, (maxDaily - avgDaily) / avgDaily),
          recommendations: [
            'Review what drove the high sales',
            'Check for special promotions or events',
            'Ensure adequate inventory for similar days'
          ]
        });
      }
      
      if (minDaily < avgDaily * 0.3 && minDaily > 0) {
        anomalies.push({
          type: 'pattern',
          severity: 'medium',
          title: `Unusually Low Sales Day`,
          description: `Daily sales dropped to ฿${minDaily.toFixed(2)}, well below average of ฿${avgDaily.toFixed(2)}`,
          data: {
            min_daily_sales: minDaily,
            average_daily_sales: avgDaily,
            variance: avgDaily - minDaily
          },
          timestamp: new Date(),
          confidence: Math.min(0.9, (avgDaily - minDaily) / avgDaily),
          recommendations: [
            'Investigate causes of low sales',
            'Check for operational issues',
            'Review marketing and promotion strategies'
          ]
        });
      }
    }
    
    return anomalies;
  }
  
  // Performance anomaly detection
  async detectPerformanceAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const receiptIntervals: number[] = [];
    
    // Calculate time intervals between receipts
    const sortedReceipts = receipts.sort((a, b) => 
      new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime()
    );
    
    for (let i = 1; i < sortedReceipts.length; i++) {
      const current = new Date(sortedReceipts[i].receiptDate).getTime();
      const previous = new Date(sortedReceipts[i-1].receiptDate).getTime();
      const interval = (current - previous) / 1000 / 60; // minutes
      
      if (interval < 60) { // Only consider intervals under 1 hour
        receiptIntervals.push(interval);
      }
    }
    
    if (receiptIntervals.length > 5) {
      const avgInterval = receiptIntervals.reduce((a, b) => a + b, 0) / receiptIntervals.length;
      const maxInterval = Math.max(...receiptIntervals);
      
      // Detect unusually long gaps between orders
      if (maxInterval > avgInterval * 3 && maxInterval > 30) {
        anomalies.push({
          type: 'performance',
          severity: 'medium',
          title: `Unusual Service Gap`,
          description: `Gap of ${maxInterval.toFixed(1)} minutes between orders, much longer than average of ${avgInterval.toFixed(1)} minutes`,
          data: {
            max_interval: maxInterval,
            average_interval: avgInterval,
            total_gaps_analyzed: receiptIntervals.length
          },
          timestamp: new Date(),
          confidence: Math.min(0.85, (maxInterval - avgInterval) / avgInterval),
          recommendations: [
            'Review staffing during identified time periods',
            'Check for equipment or system issues',
            'Analyze customer wait times'
          ]
        });
      }
    }
    
    return anomalies;
  }
  
  // Inventory anomaly detection based on sales patterns
  async detectInventoryAnomalies(receipts: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    const itemSales: { [key: string]: { total: number, transactions: number } } = {};
    
    // Analyze item sales frequency
    receipts.forEach(receipt => {
      const items = this.parseReceiptItems(receipt);
      items.forEach(item => {
        const key = `${item.item_name}_${item.variant_name || 'default'}`;
        if (!itemSales[key]) itemSales[key] = { total: 0, transactions: 0 };
        itemSales[key].total += item.quantity;
        itemSales[key].transactions += 1;
      });
    });
    
    // Detect items with unusual sales patterns
    Object.entries(itemSales).forEach(([itemKey, sales]) => {
      const avgPerTransaction = sales.total / sales.transactions;
      
      // Flag items with very low sales (potential overstock)
      if (sales.total < 3 && sales.transactions < 2) {
        const [itemName, variant] = itemKey.split('_');
        anomalies.push({
          type: 'inventory',
          severity: 'low',
          title: `Low Movement Item: ${itemName}`,
          description: `${itemName} sold only ${sales.total} units in ${sales.transactions} transactions`,
          data: {
            item: itemName,
            variant: variant !== 'default' ? variant : null,
            total_sold: sales.total,
            transaction_count: sales.transactions
          },
          timestamp: new Date(),
          confidence: 0.7,
          recommendations: [
            'Review inventory levels for this item',
            'Consider removing from menu if consistently low',
            'Check for preparation or quality issues'
          ]
        });
      }
      
      // Flag items with very high sales (potential stock-out risk)
      if (sales.total > 50 && avgPerTransaction > 3) {
        const [itemName, variant] = itemKey.split('_');
        anomalies.push({
          type: 'inventory',
          severity: 'medium',
          title: `High Demand Item: ${itemName}`,
          description: `${itemName} sold ${sales.total} units with high average of ${avgPerTransaction.toFixed(1)} per transaction`,
          data: {
            item: itemName,
            variant: variant !== 'default' ? variant : null,
            total_sold: sales.total,
            average_per_transaction: avgPerTransaction
          },
          timestamp: new Date(),
          confidence: 0.8,
          recommendations: [
            'Ensure adequate inventory levels',
            'Consider bulk ordering for this popular item',
            'Monitor for potential stock-outs'
          ]
        });
      }
    });
    
    return anomalies;
  }
  
  // Helper methods
  private async getReceiptsForAnalysis(startDate: Date, endDate: Date): Promise<any[]> {
    const receipts = await db.select()
      .from(loyverseReceipts)
      .where(
        sql`${loyverseReceipts.receiptDate} >= ${startDate} AND ${loyverseReceipts.receiptDate} <= ${endDate}`
      )
      .orderBy(desc(loyverseReceipts.receiptDate));
    
    return receipts;
  }
  
  private parseReceiptItems(receipt: any): any[] {
    const items: any[] = [];
    
    try {
      let rawItems = [];
      if (Array.isArray(receipt.items)) {
        rawItems = receipt.items;
      } else if (receipt.items && typeof receipt.items === 'string') {
        rawItems = JSON.parse(receipt.items);
      } else if (receipt.rawData?.line_items) {
        rawItems = receipt.rawData.line_items;
      }
      
      rawItems.forEach(item => {
        items.push({
          item_name: item.item_name || item.name || 'Unknown',
          variant_name: item.variant_name || null,
          quantity: item.quantity || 1,
          unit_price: parseFloat(item.price || item.unit_price || '0'),
          total_amount: parseFloat(item.total_money || item.gross_total_money || item.price || '0')
        });
      });
    } catch (error) {
      console.error('Error parsing receipt items:', error);
    }
    
    return items;
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();