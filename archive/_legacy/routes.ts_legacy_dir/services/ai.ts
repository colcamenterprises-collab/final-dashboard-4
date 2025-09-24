import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "" 
});

const gemini = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_ENV_VAR || "" 
});

export interface ReceiptAnalysis {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    ingredients: string[];
  }>;
  totalCost: number;
  anomalies: string[];
}

export interface AnomalyDetection {
  severity: 'low' | 'medium' | 'high';
  type: string;
  description: string;
  confidence: number;
}

export interface IngredientUsage {
  ingredient: string;
  quantityUsed: number;
  unit: string;
  estimatedCost: number;
}

export async function analyzeReceipt(receiptImageBase64: string): Promise<ReceiptAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a restaurant receipt analysis expert. Analyze the receipt image and extract menu items with their ingredients, detect any pricing anomalies, and calculate ingredient usage. Return JSON format."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this restaurant receipt and provide: 1) List of items with quantities, prices, and estimated ingredients 2) Total cost 3) Any pricing anomalies detected. Format as JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${receiptImageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result as ReceiptAnalysis;
  } catch (error) {
    console.error("Error analyzing receipt:", error);
    throw new Error("Failed to analyze receipt");
  }
}

export async function detectAnomalies(transactionData: any[]): Promise<AnomalyDetection[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a restaurant transaction anomaly detection expert. Analyze transaction patterns and identify unusual activities, pricing errors, or suspicious patterns."
        },
        {
          role: "user",
          content: `Analyze these restaurant transactions for anomalies: ${JSON.stringify(transactionData)}. Look for unusual discounts, pricing errors, void patterns, or suspicious activities. Return JSON array of anomalies with severity, type, description, and confidence score.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.anomalies || [];
  } catch (error) {
    console.error("Error detecting anomalies:", error);
    return [];
  }
}

export async function calculateIngredientUsage(menuItems: any[], salesData: any[]): Promise<IngredientUsage[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a restaurant inventory management expert. Calculate ingredient usage based on menu items sold and their recipes."
        },
        {
          role: "user",
          content: `Calculate ingredient usage based on these menu items: ${JSON.stringify(menuItems)} and sales data: ${JSON.stringify(salesData)}. Return JSON array with ingredient name, quantity used, unit, and estimated cost.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.ingredients || [];
  } catch (error) {
    console.error("Error calculating ingredient usage:", error);
    return [];
  }
}

export async function generateStockRecommendations(inventoryData: any[], salesTrends: any[]): Promise<Array<{item: string, recommendedQuantity: number, reasoning: string}>> {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  recommendedQuantity: { type: "number" },
                  reasoning: { type: "string" }
                },
                required: ["item", "recommendedQuantity", "reasoning"]
              }
            }
          },
          required: ["recommendations"]
        }
      },
      contents: `Analyze this restaurant inventory data: ${JSON.stringify(inventoryData)} and sales trends: ${JSON.stringify(salesTrends)}. Generate stock reordering recommendations with quantities and reasoning.`
    });

    const result = JSON.parse(response.text || "{}");
    return result.recommendations || [];
  } catch (error) {
    console.error("Error generating stock recommendations:", error);
    return [];
  }
}

export async function analyzeFinancialVariance(posData: any, staffData: any): Promise<{
  salesVariance: number;
  transactionVariance: number;
  cashVariance: number;
  alerts: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a restaurant financial analysis expert. Compare POS data with staff reports to identify variances and generate alerts."
        },
        {
          role: "user",
          content: `Compare POS data: ${JSON.stringify(posData)} with staff report data: ${JSON.stringify(staffData)}. Calculate variances in sales, transactions, and cash. Identify potential issues and generate alerts. Return JSON with variance amounts and alert messages.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Error analyzing financial variance:", error);
    return {
      salesVariance: 0,
      transactionVariance: 0,
      cashVariance: 0,
      alerts: ["Unable to analyze variance - AI service unavailable"]
    };
  }
}
