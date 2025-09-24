import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { bankImportBatch, bankTxn, vendorRule } from "../../shared/schema";
import { eq, desc, sql, and, gte, lte, like, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Configure multer for CSV upload
const upload = multer({ storage: multer.memoryStorage() });

// CSV parsing utilities
interface ParsedTransaction {
  postedAt: Date;
  description: string;
  amountTHB: number;
  ref?: string;
  raw: any;
}

// Bank format detection and parsing
function detectBankFormat(headers: string[]): 'kbank' | 'scb' | 'generic' {
  const headerStr = headers.join(',').toLowerCase();
  
  if (headerStr.includes('posting date') || headerStr.includes('date') && headerStr.includes('description')) {
    if (headerStr.includes('amount (thb)') || headerStr.includes('amount')) {
      return 'kbank';
    }
  }
  
  if (headerStr.includes('withdrawal') || headerStr.includes('deposit')) {
    return 'scb';
  }
  
  return 'generic';
}

function parseDate(dateStr: string): Date {
  // Try different date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})-(\w{3})-(\d{2,4})/, // DD-MMM-YY/YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format.source.includes('\\w{3}')) {
        // Handle MMM format (Jan, Feb, etc.)
        const months: Record<string, number> = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const day = parseInt(match[1]);
        const month = months[match[2].toLowerCase()];
        let year = parseInt(match[3]);
        if (year < 100) year += 2000; // Convert 2-digit to 4-digit year
        
        return new Date(year, month, day);
      } else if (format.source.includes('\\d{4}')) {
        // YYYY-MM-DD format
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        // DD/MM/YYYY format (assume Thai format)
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const year = parseInt(match[3]);
        return new Date(year, month, day);
      }
    }
  }
  
  // Fallback to native parsing
  return new Date(dateStr);
}

function parseAmount(amountStr: string): number {
  // Remove commas, currency symbols, spaces
  const cleaned = amountStr.replace(/[,฿\s]/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

function parseCSVRow(row: any, format: string, headers: string[]): ParsedTransaction | null {
  try {
    let postedAt: Date;
    let description: string;
    let amountTHB: number;
    let ref: string | undefined;

    if (format === 'kbank') {
      // KBank format: Date, Description, Amount (THB), Reference
      const dateCol = headers.findIndex(h => h.toLowerCase().includes('date'));
      const descCol = headers.findIndex(h => h.toLowerCase().includes('description') || h.toLowerCase().includes('details'));
      const amountCol = headers.findIndex(h => h.toLowerCase().includes('amount'));
      const refCol = headers.findIndex(h => h.toLowerCase().includes('reference') || h.toLowerCase().includes('ref'));
      
      postedAt = parseDate(row[dateCol] || row[0]);
      description = String(row[descCol] || row[1] || '').trim();
      amountTHB = parseAmount(String(row[amountCol] || row[2] || '0'));
      ref = refCol >= 0 ? String(row[refCol] || '').trim() : undefined;
      
    } else if (format === 'scb') {
      // SCB format: Date, Description, Withdrawal, Deposit
      const dateCol = headers.findIndex(h => h.toLowerCase().includes('date'));
      const descCol = headers.findIndex(h => h.toLowerCase().includes('description'));
      const withdrawalCol = headers.findIndex(h => h.toLowerCase().includes('withdrawal'));
      const depositCol = headers.findIndex(h => h.toLowerCase().includes('deposit'));
      
      postedAt = parseDate(row[dateCol] || row[0]);
      description = String(row[descCol] || row[1] || '').trim();
      
      const withdrawal = parseAmount(String(row[withdrawalCol] || '0'));
      const deposit = parseAmount(String(row[depositCol] || '0'));
      amountTHB = withdrawal > 0 ? withdrawal : -deposit; // Positive = expense, negative = income
      
    } else {
      // Generic format: assume first 3 columns are date, description, amount
      postedAt = parseDate(row[0] || '');
      description = String(row[1] || '').trim();
      amountTHB = parseAmount(String(row[2] || '0'));
      ref = row[3] ? String(row[3]).trim() : undefined;
    }

    // Skip empty or zero transactions
    if (!description || amountTHB === 0) return null;

    return {
      postedAt,
      description,
      amountTHB,
      ref,
      raw: Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    };
    
  } catch (error) {
    console.error('Error parsing CSV row:', error, row);
    return null;
  }
}

function generateDedupeKey(source: string, postedAt: Date, amountTHB: number, description: string): string {
  const dateStr = postedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const absAmount = Math.abs(amountTHB);
  const descPrefix = description.slice(0, 32).toUpperCase();
  return `${source}|${dateStr}|${absAmount}|${descPrefix}`;
}

async function applyVendorRules(txns: ParsedTransaction[]) {
  const rules = await db.select().from(vendorRule);
  
  return txns.map(txn => {
    // Find matching rule
    const rule = rules.find((r: any) => 
      txn.description.toUpperCase().includes(r.matchText.toUpperCase())
    );
    
    return {
      ...txn,
      category: rule?.category,
      supplier: rule?.supplier,
    };
  });
}

// POST /api/bank-imports - Upload and parse CSV
router.post("/", upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV file must have at least a header and one data row" });
    }

    // Parse CSV manually (simple approach)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const format = detectBankFormat(headers);
    const source = req.body.source || format.toUpperCase();
    
    // Parse all data rows
    const rawTxns: ParsedTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      const parsed = parseCSVRow(cells, format, headers);
      if (parsed) {
        rawTxns.push(parsed);
      }
    }

    if (rawTxns.length === 0) {
      return res.status(400).json({ error: "No valid transactions found in CSV" });
    }

    // Apply vendor rules for smart suggestions
    const enhancedTxns = await applyVendorRules(rawTxns);

    // Create batch
    const [batch] = await db.insert(bankImportBatch).values({
      source,
      filename: req.file.originalname || 'upload.csv',
      status: 'pending',
    }).returning();

    // Insert transactions with deduplication
    let inserted = 0;
    let skippedDupes = 0;

    for (const txn of enhancedTxns) {
      const dedupeKey = generateDedupeKey(source, txn.postedAt, txn.amountTHB, txn.description);
      
      try {
        await db.insert(bankTxn).values({
          batchId: batch.id,
          postedAt: txn.postedAt,
          description: txn.description,
          amountTHB: txn.amountTHB.toString(),
          ref: txn.ref,
          raw: txn.raw,
          category: txn.category,
          supplier: txn.supplier,
          status: 'pending',
          dedupeKey,
        });
        inserted++;
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          skippedDupes++;
        } else {
          throw error;
        }
      }
    }

    res.json({
      ok: true,
      batchId: batch.id,
      inserted,
      skippedDupes,
      format,
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: "Failed to process CSV upload" });
  }
});

// GET /api/bank-imports/:batchId/txns - List transactions with filters
const listTxnsSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(), 
  min: z.string().optional(),
  max: z.string().optional(),
  month: z.string().optional(), // YYYY-MM
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get("/:batchId/txns", async (req, res) => {
  try {
    const { batchId } = req.params;
    const query = listTxnsSchema.parse(req.query);
    
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    const offset = (page - 1) * limit;

    let whereConditions = [eq(bankTxn.batchId, batchId)];

    // Apply filters
    if (query.status) {
      whereConditions.push(eq(bankTxn.status, query.status as any));
    }

    if (query.search) {
      whereConditions.push(
        like(bankTxn.description, `%${query.search}%`)
      );
    }

    if (query.min) {
      const minAmount = parseFloat(query.min);
      whereConditions.push(gte(bankTxn.amountTHB, minAmount.toString()));
    }

    if (query.max) {
      const maxAmount = parseFloat(query.max);
      whereConditions.push(lte(bankTxn.amountTHB, maxAmount.toString()));
    }

    if (query.month) {
      const monthStart = new Date(`${query.month}-01`);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      whereConditions.push(
        and(
          gte(bankTxn.postedAt, monthStart),
          lte(bankTxn.postedAt, monthEnd)
        )!
      );
    }

    const [txns, totalResult] = await Promise.all([
      db.select()
        .from(bankTxn)
        .where(and(...whereConditions))
        .orderBy(desc(bankTxn.postedAt))
        .limit(limit)
        .offset(offset),
      
      db.select({ count: sql<number>`count(*)` })
        .from(bankTxn)
        .where(and(...whereConditions))
    ]);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      ok: true,
      txns,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });

  } catch (error) {
    console.error('List txns error:', error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /api/bank-imports/:batchId/approve - Approve transactions
const approveTxnsSchema = z.object({
  ids: z.array(z.string()),
  defaults: z.object({
    category: z.string().optional(),
    supplier: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

router.post("/:batchId/approve", async (req, res) => {
  try {
    const { batchId } = req.params;
    const { ids, defaults } = approveTxnsSchema.parse(req.body);

    if (ids.length === 0) {
      return res.status(400).json({ error: "No transaction IDs provided" });
    }

    // Get transactions to approve
    const txnsToApprove = await db.select()
      .from(bankTxn)
      .where(
        and(
          eq(bankTxn.batchId, batchId),
          inArray(bankTxn.id, ids),
          eq(bankTxn.status, 'pending')
        )
      );

    if (txnsToApprove.length === 0) {
      return res.status(400).json({ error: "No pending transactions found to approve" });
    }

    // TODO: Create expense entries in expensesV2 system
    // For now, just mark as approved
    const approvedTxns = await db.update(bankTxn)
      .set({
        status: 'approved',
        category: defaults?.category,
        supplier: defaults?.supplier, 
        notes: defaults?.notes,
      })
      .where(inArray(bankTxn.id, ids))
      .returning();

    res.json({
      ok: true,
      approved: approvedTxns.length,
      txns: approvedTxns,
    });

  } catch (error) {
    console.error('Approve txns error:', error);
    res.status(500).json({ error: "Failed to approve transactions" });
  }
});

// PATCH /api/bank-imports/txns/:id - Edit transaction
const editTxnSchema = z.object({
  category: z.string().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'deleted']).optional(),
});

router.patch("/txns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = editTxnSchema.parse(req.body);

    const [updatedTxn] = await db.update(bankTxn)
      .set(updates)
      .where(eq(bankTxn.id, id))
      .returning();

    if (!updatedTxn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      ok: true,
      txn: updatedTxn,
    });

  } catch (error) {
    console.error('Edit txn error:', error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// DELETE /api/bank-imports/txns/:id - Delete/reject transaction
router.delete("/txns/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deletedTxn] = await db.update(bankTxn)
      .set({ status: 'deleted' })
      .where(eq(bankTxn.id, id))
      .returning();

    if (!deletedTxn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      ok: true,
      txn: deletedTxn,
    });

  } catch (error) {
    console.error('Delete txn error:', error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// POST /api/bank-imports/rules - Create vendor rule
const createRuleSchema = z.object({
  matchText: z.string().min(1),
  category: z.string().min(1),
  supplier: z.string().min(1),
});

router.post("/rules", async (req, res) => {
  try {
    const ruleData = createRuleSchema.parse(req.body);

    const [rule] = await db.insert(vendorRule)
      .values(ruleData)
      .returning();

    res.json({
      ok: true,
      rule,
    });

  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: "Failed to create vendor rule" });
  }
});

// GET /api/bank-imports/rules - List vendor rules
router.get("/rules", async (req, res) => {
  try {
    const rules = await db.select()
      .from(vendorRule)
      .orderBy(desc(vendorRule.createdAt));

    res.json({
      ok: true,
      rules,
    });

  } catch (error) {
    console.error('List rules error:', error);
    res.status(500).json({ error: "Failed to fetch vendor rules" });
  }
});

export { router as bankImportRouter };