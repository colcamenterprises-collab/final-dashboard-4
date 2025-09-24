import { db } from '../db';
import { vendors, vendorAliases, categories, expenses, expenseImportLine } from '../../shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';

export interface ParsedExpenseRow {
  date: string;
  description: string;
  amount: number;
  currency: string;
  side: 'debit' | 'credit';
}

export interface CategorizationResult {
  vendorGuess?: string;
  categoryGuessId?: number;
  confidence: number;
  vendorId?: number;
}

export class ExpenseCategorizationEngine {
  private vendors: Array<{ id: number; displayName: string; defaultCategoryId: number | null }> = [];
  private aliases: Array<{ vendorId: number; aliasText: string }> = [];
  private categories: Array<{ id: number; name: string; code: string }> = [];

  async initialize() {
    // Load vendors, aliases, and categories into memory for fast lookup
    this.vendors = await db.select().from(vendors);
    this.aliases = await db.select().from(vendorAliases);
    this.categories = await db.select().from(categories);
  }

  /**
   * Normalize text for Thai-ready comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7F\w\s\d]/g, ''); // Keep Thai chars, alphanumeric, spaces
  }

  /**
   * Find vendor by exact/substring alias match (Thai + English)
   */
  private findVendorByAlias(description: string): { vendorId: number; confidence: number } | null {
    const normalized = this.normalizeText(description);
    
    // Exact match gets highest confidence
    for (const alias of this.aliases) {
      const normalizedAlias = this.normalizeText(alias.aliasText);
      if (normalized.includes(normalizedAlias)) {
        return { vendorId: alias.vendorId, confidence: 0.95 };
      }
    }

    // Fuzzy match with Levenshtein distance (simplified)
    for (const alias of this.aliases) {
      const normalizedAlias = this.normalizeText(alias.aliasText);
      if (this.calculateSimilarity(normalized, normalizedAlias) > 0.85) {
        return { vendorId: alias.vendorId, confidence: 0.6 };
      }
    }

    return null;
  }

  /**
   * Simple similarity calculation for fuzzy matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Apply heuristic rules for category guessing
   */
  private applyHeuristics(description: string): { categoryId?: number; confidence: number } {
    const normalized = this.normalizeText(description);
    
    const rules = [
      {
        keywords: ['ค่าน้ำ', 'ค่าไฟ', 'ไฟฟ้า', 'pwa', 'mea', 'การไฟฟ้า', 'การประปา'],
        categoryCode: 'UTIL',
        confidence: 0.8
      },
      {
        keywords: ['เช่า', 'rent'],
        categoryCode: 'RENT',
        confidence: 0.8
      },
      {
        keywords: ['ค่าธรรมเนียม', 'fee', 'ธนาคาร'],
        categoryCode: 'BANK_FEES',
        confidence: 0.8
      },
      {
        keywords: ['น้ำมัน', 'fuel', 'ปตท', 'บางจาก'],
        categoryCode: 'FUEL',
        confidence: 0.7
      }
    ];

    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (normalized.includes(keyword)) {
          const category = this.categories.find(c => c.code === rule.categoryCode);
          if (category) {
            return { categoryId: category.id, confidence: rule.confidence };
          }
        }
      }
    }

    return { confidence: 0.0 };
  }

  /**
   * Check for potential duplicates
   */
  async checkDuplicates(
    amount: number, 
    date: string, 
    description: string
  ): Promise<number | null> {
    const parsedDate = new Date(date);
    const startDate = new Date(parsedDate);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(parsedDate);
    endDate.setDate(endDate.getDate() + 2);

    const amountMinor = Math.round(amount * 100); // Convert to minor units
    const amountRange = 100; // ±1 THB = ±100 satang

    const duplicates = await db
      .select()
      .from(expenses)
      .where(
        sql`
          ${expenses.amountMinor} BETWEEN ${amountMinor - amountRange} AND ${amountMinor + amountRange}
          AND ${expenses.date} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
          AND similarity(${expenses.descriptionRaw}, ${description}) > 0.7
        `
      )
      .limit(1);

    return duplicates.length > 0 ? duplicates[0].id : null;
  }

  /**
   * Categorize a single parsed expense row
   */
  async categorizeExpense(row: ParsedExpenseRow): Promise<CategorizationResult> {
    await this.initialize();

    let result: CategorizationResult = { confidence: 0.0 };

    // Step 1: Try alias matching
    const aliasMatch = this.findVendorByAlias(row.description);
    if (aliasMatch) {
      const vendor = this.vendors.find(v => v.id === aliasMatch.vendorId);
      if (vendor) {
        result.vendorGuess = vendor.displayName;
        result.vendorId = vendor.id;
        result.categoryGuessId = vendor.defaultCategoryId || undefined;
        result.confidence = aliasMatch.confidence;
      }
    }

    // Step 2: If no vendor found, try heuristics
    if (result.confidence < 0.8) {
      const heuristicResult = this.applyHeuristics(row.description);
      if (heuristicResult.confidence > result.confidence) {
        result.categoryGuessId = heuristicResult.categoryId;
        result.confidence = heuristicResult.confidence;
      }
    }

    return result;
  }

  /**
   * Learn from user corrections during review
   */
  async learnFromCorrection(
    description: string,
    correctedVendorId: number,
    correctedCategoryId: number
  ) {
    // Create vendor alias from the description if it doesn't exist
    const normalizedDesc = this.normalizeText(description);
    
    // Check if alias already exists
    const existingAlias = await db
      .select()
      .from(vendorAliases)
      .where(
        sql`${vendorAliases.vendorId} = ${correctedVendorId} 
        AND ${vendorAliases.aliasText} ILIKE ${`%${normalizedDesc}%`}`
      )
      .limit(1);

    if (existingAlias.length === 0) {
      // Extract key vendor name from description
      const words = normalizedDesc.split(' ');
      const significantWords = words.filter(word => word.length > 2);
      
      if (significantWords.length > 0) {
        await db.insert(vendorAliases).values({
          vendorId: correctedVendorId,
          aliasText: significantWords[0] // Use the first significant word
        });
      }
    }

    // Update vendor default category if it makes sense
    const vendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, correctedVendorId))
      .limit(1);

    if (vendor.length > 0 && !vendor[0].defaultCategoryId) {
      await db
        .update(vendors)
        .set({ defaultCategoryId: correctedCategoryId })
        .where(eq(vendors.id, correctedVendorId));
    }
  }
}

export const categorizationEngine = new ExpenseCategorizationEngine();