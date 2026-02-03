import OpenAI from 'openai';
import { ValidatedLoyverseReceipt } from './loyverseDataValidator';
import { DateTime } from 'luxon';
import winston from 'winston';
import { db } from '../db';
import { recipes, recipeIngredients, ingredients, aiInsights, dailyStockSales } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
// For auto-ordering alerts
// import { Client } from '@line/bot-sdk';
// const lineClient = new Client({ channelAccessToken: process.env.LINE_TOKEN });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ai-analysis.log' })
  ]
});

interface IngredientUsage {
  name: string;
  quantityUsed: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  category: string;
}

interface ItemAnalysis {
  itemName: string;
  quantity: number;
  totalSales: number;
  ingredientUsage: IngredientUsage[];
  profit: number;
  profitMargin: number;
}

interface AnomalyDetection {
  type: 'quantity' | 'timing' | 'pricing' | 'ingredient' | 'staff';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: string[];
  recommendation: string;
  confidence: number;
}

interface ShiftAnalysis {
  shiftDate: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  itemAnalysis: ItemAnalysis[];
  ingredientUsage: IngredientUsage[];
  anomalies: AnomalyDetection[];
  recommendations: string[];
  comparisonWithPrevious: {
    salesChange: number;
    orderChange: number;
    profitChange: number;
    keyInsights: string[];
  };
  staffFormComparison?: {
    discrepancies: Array<{
      field: string;
      posValue: number;
      staffValue: number;
      difference: number;
      severity: 'low' | 'medium' | 'high';
    }>;
    overallAccuracy: number;
  };
}

export class AIAnalysisService {
  private openai: OpenAI | null;
  private static instance: AIAnalysisService;

  private constructor() {
    this.openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }
  
  isConfigured(): boolean {
    return this.openai !== null;
  }

  static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  // Main analysis function that processes shift receipts
  async analyzeShiftReceipts(receipts: ValidatedLoyverseReceipt[], shiftDate: Date): Promise<ShiftAnalysis> {
    const startTime = Date.now();
    logger.info(`Starting AI analysis for ${receipts.length} receipts on ${shiftDate.toISOString()}`);

    try {
      // Calculate basic shift metrics
      const totalSales = receipts.reduce((sum, receipt) => sum + receipt.total_money, 0);
      const totalOrders = receipts.length;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Analyze each item type
      const itemAnalysis = await this.analyzeItemSales(receipts);
      
      // Calculate ingredient usage
      const ingredientUsage = await this.calculateIngredientUsage(receipts);
      
      // Detect anomalies
      const anomalies = await this.detectAnomalies(receipts, itemAnalysis);
      
      // Generate AI recommendations
      const recommendations = await this.generateRecommendations(receipts, itemAnalysis, ingredientUsage);
      
      // Add marketing content generation
      const topItems = itemAnalysis.slice(0, 5);
      const marketingContent = await this.generateMarketingContent(topItems);
      recommendations.push(...marketingContent.recommendations);
      
      // Add finance forecast
      const financeForecast = await this.forecastExpenses(ingredientUsage);
      recommendations.push(...financeForecast.recommendations);
      
      // Auto-order low stock (commented out until LINE_TOKEN is available)
      /*
      for (const ing of ingredientUsage) {
        if (ing.quantityUsed > (ing.stock || 0) * 0.9) { // Threshold
          await lineClient.pushMessage({ 
            to: 'supplier_group', 
            messages: [{ 
              type: 'text', 
              text: `Order ${ing.name}: ${ing.quantityUsed + 20} ${ing.unit}` 
            }] 
          });
        }
      }
      */
      
      // Compare with previous shift
      const comparisonWithPrevious = await this.compareWithPreviousShift(shiftDate, totalSales, totalOrders, itemAnalysis);
      
      // Compare with staff form if available
      const staffFormComparison = await this.compareWithStaffForm(shiftDate, totalSales, receipts);

      const analysis: ShiftAnalysis = {
        shiftDate: shiftDate.toISOString(),
        totalSales,
        totalOrders,
        averageOrderValue,
        itemAnalysis,
        ingredientUsage,
        anomalies,
        recommendations,
        comparisonWithPrevious,
        staffFormComparison
      };

      // Store the analysis in the database
      await this.storeAnalysis(analysis);

      const processingTime = Date.now() - startTime;
      logger.info(`Completed AI analysis in ${processingTime}ms`);

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze shift receipts:', error);
      throw error;
    }
  }

  // Analyze item sales with recipe integration
  private async analyzeItemSales(receipts: ValidatedLoyverseReceipt[]): Promise<ItemAnalysis[]> {
    const itemMap = new Map<string, { quantity: number; totalSales: number; receipts: ValidatedLoyverseReceipt[] }>();

    // Group items by name
    for (const receipt of receipts) {
      for (const item of receipt.line_items) {
        const key = item.item_name;
        if (!itemMap.has(key)) {
          itemMap.set(key, { quantity: 0, totalSales: 0, receipts: [] });
        }
        const existing = itemMap.get(key)!;
        existing.quantity += item.quantity;
        existing.totalSales += item.line_total;
        existing.receipts.push(receipt);
      }
    }

    // Analyze each item
    const itemAnalysis: ItemAnalysis[] = [];
    
    for (const [itemName, itemData] of itemMap) {
      try {
        // Get recipe information
        const recipe = await db.select()
          .from(recipes)
          .where(eq(recipes.name, itemName))
          .limit(1);

        let ingredientUsage: IngredientUsage[] = [];
        let totalCost = 0;

        if (recipe.length > 0) {
          // Get recipe ingredients
          const recipeIngredientsData = await db.select({
            ingredient: ingredients,
            quantity: recipeIngredients.quantity,
            unit: recipeIngredients.unit,
            cost: recipeIngredients.cost
          })
          .from(recipeIngredients)
          .leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
          .where(eq(recipeIngredients.recipeId, recipe[0].id));

          // Calculate ingredient usage for this item
          for (const recipeIngredient of recipeIngredientsData) {
            if (recipeIngredient.ingredient) {
              const usage: IngredientUsage = {
                name: recipeIngredient.ingredient.name,
                quantityUsed: parseFloat(recipeIngredient.quantity.toString()) * itemData.quantity,
                unit: recipeIngredient.unit,
                costPerUnit: parseFloat(recipeIngredient.ingredient.unitPrice.toString()),
                totalCost: parseFloat(recipeIngredient.cost.toString()) * itemData.quantity,
                category: recipeIngredient.ingredient.category
              };
              ingredientUsage.push(usage);
              totalCost += usage.totalCost;
            }
          }
        }

        const profit = itemData.totalSales - totalCost;
        const profitMargin = itemData.totalSales > 0 ? (profit / itemData.totalSales) * 100 : 0;

        itemAnalysis.push({
          itemName,
          quantity: itemData.quantity,
          totalSales: itemData.totalSales,
          ingredientUsage,
          profit,
          profitMargin
        });
      } catch (error) {
        logger.error(`Error analyzing item ${itemName}:`, error);
      }
    }

    return itemAnalysis.sort((a, b) => b.totalSales - a.totalSales);
  }

  // Calculate total ingredient usage across all items
  private async calculateIngredientUsage(receipts: ValidatedLoyverseReceipt[]): Promise<IngredientUsage[]> {
    const ingredientMap = new Map<string, IngredientUsage>();

    // Process each receipt
    for (const receipt of receipts) {
      for (const item of receipt.line_items) {
        try {
          // Get recipe for this item
          const recipe = await db.select()
            .from(recipes)
            .where(eq(recipes.name, item.item_name))
            .limit(1);

          if (recipe.length > 0) {
            // Get recipe ingredients
            const recipeIngredientsData = await db.select({
              ingredient: ingredients,
              quantity: recipeIngredients.quantity,
              unit: recipeIngredients.unit,
              cost: recipeIngredients.cost
            })
            .from(recipeIngredients)
            .leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
            .where(eq(recipeIngredients.recipeId, recipe[0].id));

            // Add ingredient usage to map
            for (const recipeIngredient of recipeIngredientsData) {
              if (recipeIngredient.ingredient) {
                const key = recipeIngredient.ingredient.name;
                const quantityUsed = parseFloat(recipeIngredient.quantity.toString()) * item.quantity;
                const cost = parseFloat(recipeIngredient.cost.toString()) * item.quantity;

                if (!ingredientMap.has(key)) {
                  ingredientMap.set(key, {
                    name: recipeIngredient.ingredient.name,
                    quantityUsed: 0,
                    unit: recipeIngredient.unit,
                    costPerUnit: parseFloat(recipeIngredient.ingredient.unitPrice.toString()),
                    totalCost: 0,
                    category: recipeIngredient.ingredient.category
                  });
                }

                const existing = ingredientMap.get(key)!;
                existing.quantityUsed += quantityUsed;
                existing.totalCost += cost;
              }
            }
          }
        } catch (error) {
          logger.error(`Error calculating ingredient usage for item ${item.item_name}:`, error);
        }
      }
    }

    return Array.from(ingredientMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }

  // Detect anomalies using AI
  private async detectAnomalies(receipts: ValidatedLoyverseReceipt[], itemAnalysis: ItemAnalysis[]): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    try {
      // Prepare data for AI analysis
      const analysisData = {
        receiptCount: receipts.length,
        totalSales: receipts.reduce((sum, r) => sum + r.total_money, 0),
        averageOrderValue: receipts.length > 0 ? receipts.reduce((sum, r) => sum + r.total_money, 0) / receipts.length : 0,
        topItems: itemAnalysis.slice(0, 10),
        timeDistribution: this.analyzeTimeDistribution(receipts),
        paymentMethods: this.analyzePaymentMethods(receipts)
      };

      const prompt = `
        Analyze the following restaurant sales data for anomalies and unusual patterns:

        ${JSON.stringify(analysisData, null, 2)}

        Look for:
        1. Unusual quantity patterns (e.g., 100 burgers sold but only 80 buns used)
        2. Timing anomalies (e.g., high sales at unusual hours)
        3. Pricing discrepancies
        4. Ingredient usage inconsistencies
        5. Staff behavior patterns

        Return a JSON array of anomalies with this structure:
        [
          {
            "type": "quantity|timing|pricing|ingredient|staff",
            "severity": "low|medium|high",
            "description": "Clear description of the anomaly",
            "affectedItems": ["item1", "item2"],
            "recommendation": "Specific action to take",
            "confidence": 0.85
          }
        ]

        Focus on actionable insights that could indicate theft, waste, or operational issues.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert restaurant operations analyst specializing in POS data analysis and anomaly detection. Provide precise, actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        try {
          const detectedAnomalies = JSON.parse(aiResponse);
          anomalies.push(...detectedAnomalies);
        } catch (parseError) {
          logger.error('Failed to parse AI anomaly detection response:', parseError);
        }
      }
    } catch (error) {
      logger.error('Failed to detect anomalies with AI:', error);
    }

    // Add rule-based anomaly detection as fallback
    const ruleBasedAnomalies = this.detectRuleBasedAnomalies(receipts, itemAnalysis);
    anomalies.push(...ruleBasedAnomalies);

    return anomalies;
  }

  // Rule-based anomaly detection
  private detectRuleBasedAnomalies(receipts: ValidatedLoyverseReceipt[], itemAnalysis: ItemAnalysis[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];

    // Check for zero-value transactions
    const zeroValueReceipts = receipts.filter(r => r.total_money === 0);
    if (zeroValueReceipts.length > 0) {
      anomalies.push({
        type: 'pricing',
        severity: 'medium',
        description: `${zeroValueReceipts.length} zero-value transactions detected`,
        affectedItems: zeroValueReceipts.map(r => r.receipt_number),
        recommendation: 'Investigate zero-value transactions for potential system issues or refunds',
        confidence: 0.9
      });
    }

    // Check for unusually high quantities
    for (const item of itemAnalysis) {
      if (item.quantity > 50 && item.itemName.toLowerCase().includes('burger')) {
        anomalies.push({
          type: 'quantity',
          severity: 'high',
          description: `Unusually high quantity of ${item.itemName}: ${item.quantity} units`,
          affectedItems: [item.itemName],
          recommendation: 'Verify inventory levels and check for potential data entry errors',
          confidence: 0.8
        });
      }
    }

    // Check for timing anomalies
    const hourlyDistribution = this.analyzeTimeDistribution(receipts);
    const unusualHours = Object.entries(hourlyDistribution).filter(([hour, count]) => {
      const hourNum = parseInt(hour);
      return (hourNum >= 4 && hourNum <= 16) && count > 10; // Sales during closed hours
    });

    if (unusualHours.length > 0) {
      anomalies.push({
        type: 'timing',
        severity: 'medium',
        description: `Sales detected during unusual hours: ${unusualHours.map(([h, c]) => `${h}:00 (${c} orders)`).join(', ')}`,
        affectedItems: [],
        recommendation: 'Check if sales during closed hours are legitimate or indicate system issues',
        confidence: 0.7
      });
    }

    return anomalies;
  }

  // Generate AI-powered recommendations
  private async generateRecommendations(receipts: ValidatedLoyverseReceipt[], itemAnalysis: ItemAnalysis[], ingredientUsage: IngredientUsage[]): Promise<string[]> {
    try {
      const summaryData = {
        totalSales: receipts.reduce((sum, r) => sum + r.total_money, 0),
        totalOrders: receipts.length,
        topSellingItems: itemAnalysis.slice(0, 5),
        highestCostIngredients: ingredientUsage.slice(0, 5),
        profitMargins: itemAnalysis.map(i => ({ item: i.itemName, margin: i.profitMargin }))
      };

      const prompt = `
        Based on this restaurant shift analysis, provide actionable recommendations:

        ${JSON.stringify(summaryData, null, 2)}

        Provide 5-7 specific, actionable recommendations focusing on:
        1. Inventory management and reordering
        2. Cost optimization opportunities
        3. Menu optimization suggestions
        4. Operational efficiency improvements
        5. Profit margin enhancement

        Return a JSON array of strings with specific, actionable recommendations.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert restaurant operations consultant. Provide specific, actionable recommendations based on POS data analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        try {
          return JSON.parse(aiResponse);
        } catch (parseError) {
          logger.error('Failed to parse AI recommendations response:', parseError);
        }
      }
    } catch (error) {
      logger.error('Failed to generate AI recommendations:', error);
    }

    // Fallback recommendations
    return [
      'Monitor high-cost ingredient usage and consider supplier negotiations',
      'Review menu items with low profit margins for potential pricing adjustments',
      'Optimize inventory levels based on sales patterns',
      'Consider promoting high-margin items to increase profitability'
    ];
  }

  // Compare with previous shift
  private async compareWithPreviousShift(
    currentShiftDate: Date,
    currentSales: number,
    currentOrders: number,
    currentItemAnalysis: ItemAnalysis[]
  ): Promise<ShiftAnalysis['comparisonWithPrevious']> {
    try {
      // Get previous shift data from database
      const previousShift = await db.select()
        .from(aiInsights)
        .where(and(
          eq(aiInsights.type, 'shift_analysis'),
          lte(aiInsights.createdAt, currentShiftDate)
        ))
        .orderBy(desc(aiInsights.createdAt))
        .limit(1);

      if (previousShift.length === 0) {
        return {
          salesChange: 0,
          orderChange: 0,
          profitChange: 0,
          keyInsights: ['No previous shift data available for comparison']
        };
      }

      const previousData = previousShift[0].content as any;
      const salesChange = ((currentSales - previousData.totalSales) / previousData.totalSales) * 100;
      const orderChange = ((currentOrders - previousData.totalOrders) / previousData.totalOrders) * 100;
      
      const currentProfit = currentItemAnalysis.reduce((sum, item) => sum + item.profit, 0);
      const previousProfit = previousData.itemAnalysis?.reduce((sum: number, item: any) => sum + item.profit, 0) || 0;
      const profitChange = previousProfit > 0 ? ((currentProfit - previousProfit) / previousProfit) * 100 : 0;

      const keyInsights = [];
      if (Math.abs(salesChange) > 20) {
        keyInsights.push(`Sales ${salesChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(salesChange).toFixed(1)}%`);
      }
      if (Math.abs(orderChange) > 15) {
        keyInsights.push(`Order count ${orderChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(orderChange).toFixed(1)}%`);
      }
      if (Math.abs(profitChange) > 10) {
        keyInsights.push(`Profit ${profitChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(profitChange).toFixed(1)}%`);
      }

      return {
        salesChange,
        orderChange,
        profitChange,
        keyInsights: keyInsights.length > 0 ? keyInsights : ['Performance similar to previous shift']
      };
    } catch (error) {
      logger.error('Failed to compare with previous shift:', error);
      return {
        salesChange: 0,
        orderChange: 0,
        profitChange: 0,
        keyInsights: ['Error comparing with previous shift']
      };
    }
  }

  // Compare with staff form data
  private async compareWithStaffForm(
    shiftDate: Date,
    posSales: number,
    receipts: ValidatedLoyverseReceipt[]
  ): Promise<ShiftAnalysis['staffFormComparison']> {
    try {
      // Get staff form data for the same shift
      const staffForm = await db.select()
        .from(dailyStockSales)
        .where(and(
          gte(dailyStockSales.shiftDate, shiftDate),
          lte(dailyStockSales.shiftDate, new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      if (staffForm.length === 0) {
        return undefined;
      }

      const form = staffForm[0];
      const discrepancies = [];

      // Compare total sales
      const staffTotalSales = parseFloat(form.totalSales?.toString() || '0');
      if (Math.abs(posSales - staffTotalSales) > 50) {
        discrepancies.push({
          field: 'Total Sales',
          posValue: posSales,
          staffValue: staffTotalSales,
          difference: posSales - staffTotalSales,
          severity: Math.abs(posSales - staffTotalSales) > 500 ? 'high' : 'medium' as 'high' | 'medium'
        });
      }

      // Compare cash sales
      const cashReceipts = receipts.filter(r => 
        r.payments.some(p => p.payment_type_id.toLowerCase().includes('cash'))
      );
      const posCashSales = cashReceipts.reduce((sum, r) => sum + r.total_money, 0);
      const staffCashSales = parseFloat(form.cashSales?.toString() || '0');
      
      if (Math.abs(posCashSales - staffCashSales) > 50) {
        discrepancies.push({
          field: 'Cash Sales',
          posValue: posCashSales,
          staffValue: staffCashSales,
          difference: posCashSales - staffCashSales,
          severity: Math.abs(posCashSales - staffCashSales) > 200 ? 'high' : 'medium' as 'high' | 'medium'
        });
      }

      // Calculate overall accuracy
      const totalDiscrepancy = discrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0);
      const totalValue = posSales + posCashSales;
      const overallAccuracy = totalValue > 0 ? Math.max(0, (1 - totalDiscrepancy / totalValue) * 100) : 100;

      return {
        discrepancies,
        overallAccuracy
      };
    } catch (error) {
      logger.error('Failed to compare with staff form:', error);
      return undefined;
    }
  }

  // Helper function to analyze time distribution
  private analyzeTimeDistribution(receipts: ValidatedLoyverseReceipt[]): Record<string, number> {
    const hourlyCount: Record<string, number> = {};
    
    for (const receipt of receipts) {
      const hour = new Date(receipt.receipt_date).getHours();
      hourlyCount[hour.toString()] = (hourlyCount[hour.toString()] || 0) + 1;
    }
    
    return hourlyCount;
  }

  // Helper function to analyze payment methods
  private analyzePaymentMethods(receipts: ValidatedLoyverseReceipt[]): Record<string, number> {
    const paymentCount: Record<string, number> = {};
    
    for (const receipt of receipts) {
      for (const payment of receipt.payments) {
        paymentCount[payment.payment_type_id] = (paymentCount[payment.payment_type_id] || 0) + 1;
      }
    }
    
    return paymentCount;
  }

  // Store analysis in database
  private async storeAnalysis(analysis: ShiftAnalysis): Promise<void> {
    try {
      await db.insert(aiInsights).values({
        type: 'shift_analysis',
        title: `Shift Analysis - ${DateTime.fromISO(analysis.shiftDate).toFormat('yyyy-MM-dd')}`,
        content: analysis,
        priority: 'medium',
        isActionable: true,
        relevantDate: new Date(analysis.shiftDate),
        tags: ['shift', 'analysis', 'ai', 'ingredients', 'anomalies']
      });
      
      logger.info(`Stored analysis for shift ${analysis.shiftDate}`);
    } catch (error) {
      logger.error('Failed to store analysis:', error);
    }
  }

  // New Marketing Agent Method
  private async generateMarketingContent(topItems: ItemAnalysis[]): Promise<{ recommendations: string[] }> {
    try {
      const prompt = `Generate social media posts and ad content for these top-selling items: ${JSON.stringify(topItems.map(item => ({ name: item.itemName, sales: item.totalSales, quantity: item.quantity })))}.
      
      Focus on:
      1. Engaging social media captions
      2. Promotional offers to increase sales
      3. Highlighting popular items
      4. Creating urgency and appetite appeal
      
      Return a JSON array of marketing recommendations.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        try {
          return { recommendations: JSON.parse(aiResponse) };
        } catch (parseError) {
          logger.error('Failed to parse marketing content response:', parseError);
        }
      }
    } catch (error) {
      logger.error('Failed to generate marketing content:', error);
    }

    return { recommendations: ['Consider promoting top-selling items on social media platforms'] };
  }

  // New Finance Agent Method
  private async forecastExpenses(usage: IngredientUsage[]): Promise<{ recommendations: string[] }> {
    try {
      const prompt = `Forecast expenses from ingredient usage data: ${JSON.stringify(usage)}.
      
      Analyze:
      1. Cost trends and patterns
      2. Predict next week's expenses
      3. Identify cost-saving opportunities
      4. Budget recommendations
      5. Supplier negotiation suggestions
      
      Return a JSON array of financial recommendations.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        try {
          return { recommendations: JSON.parse(aiResponse) };
        } catch (parseError) {
          logger.error('Failed to parse finance forecast response:', parseError);
        }
      }
    } catch (error) {
      logger.error('Failed to generate finance forecast:', error);
    }

    return { recommendations: ['Monitor ingredient costs and seek supplier alternatives for cost optimization'] };
  }
}

export default AIAnalysisService;