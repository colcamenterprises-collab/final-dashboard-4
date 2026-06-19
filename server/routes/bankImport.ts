import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { bankImportBatch, bankTxn, vendorRule } from "../../shared/schema";
import { eq, desc, sql, and, gte, lte, like, inArray } from "drizzle-orm";
import { z } from "zod";
import { parse as parseCsv } from "csv-parse/sync";

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

interface EnhancedTransaction extends ParsedTransaction {
  category?: string | null;
  supplier?: string | null;
}

// Bank format detection and parsing
type BankFormat = 'kbank' | 'scb' | 'bangkok_bank' | 'krungsri' | 'generic';

class CsvValidationError extends Error {
  status = 400;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CsvValidationError';
    this.details = details;
  }
}

const normalizeHeader = (value: string) => value.trim().replace(/^\uFEFF/, '').toLowerCase();
const compactHeader = (value: string) => normalizeHeader(value).replace(/[^a-z0-9ก-๙]/gi, '');

function detectBankFormat(headers: string[]): BankFormat {
  const normalized = headers.map(normalizeHeader);
  const compact = headers.map(compactHeader);
  const headerStr = normalized.join(',');

  if (compact.some(h => h.includes('withdrawal') || h.includes('ถอน')) && compact.some(h => h.includes('deposit') || h.includes('ฝาก'))) {
    return 'scb';
  }

  if (compact.some(h => h.includes('amountthb') || h === 'amount' || h.includes('จำนวนเงิน')) && compact.some(h => h.includes('description') || h.includes('details') || h.includes('รายการ'))) {
    return 'kbank';
  }

  if (headerStr.includes('debit') || headerStr.includes('credit')) {
    return 'bangkok_bank';
  }

  if (headerStr.includes('paid out') || headerStr.includes('paid in')) {
    return 'krungsri';
  }

  return 'generic';
}

function findColumn(headers: string[], candidates: string[]): number {
  const compact = headers.map(compactHeader);
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates.map(compactHeader)) {
    const idx = compact.findIndex(h => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  for (const candidate of candidates.map(c => c.toLowerCase())) {
    const idx = normalized.findIndex(h => h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function valueAt(row: string[], index: number): string {
  return index >= 0 ? String(row[index] ?? '').trim() : '';
}

function parseDate(dateStr: string): Date {
  const raw = String(dateStr || '').trim();
  if (!raw) throw new CsvValidationError('Transaction date is missing.');
  const dateOnly = raw.split(/\s+/)[0];
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  let match = dateOnly.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    const parsed = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  match = dateOnly.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (match) {
    let year = Number(match[1]);
    if (year > 2400) year -= 543;
    const parsed = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3])));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  match = dateOnly.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/);
  if (match) {
    const month = monthNames[match[2].toLowerCase()];
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    if (month !== undefined) return new Date(Date.UTC(year, month, Number(match[1])));
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  throw new CsvValidationError(`Unsupported transaction date "${raw}". Use DD/MM/YYYY, YYYY-MM-DD, or DD-MMM-YYYY.`);
}

function parseAmount(amountStr: string): number {
  const raw = String(amountStr || '').trim();
  if (!raw || raw === '-') return 0;
  const negativeByParens = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[฿,\s]/g, '').replace(/[()]/g, '');
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) throw new CsvValidationError(`Unsupported amount "${raw}".`);
  return negativeByParens ? -amount : amount;
}

function parseCSVRow(row: string[], format: BankFormat, headers: string[], rowNumber: number): ParsedTransaction | null {
  const dateCol = findColumn(headers, ['date', 'posting date', 'transaction date', 'effective date', 'วันที่']);
  const descCol = findColumn(headers, ['description', 'details', 'transaction details', 'particulars', 'รายการ', 'คำอธิบาย']);
  const refCol = findColumn(headers, ['reference', 'ref', 'cheque no', 'เลขที่อ้างอิง']);
  let postedAt: Date;
  let description: string;
  let amountTHB: number;
  let ref: string | undefined;

  if (format === 'scb') {
    const withdrawalCol = findColumn(headers, ['withdrawal', 'debit', 'paid out', 'ถอน']);
    const depositCol = findColumn(headers, ['deposit', 'credit', 'paid in', 'ฝาก']);
    postedAt = parseDate(valueAt(row, dateCol >= 0 ? dateCol : 0));
    description = valueAt(row, descCol >= 0 ? descCol : 1);
    const withdrawal = parseAmount(valueAt(row, withdrawalCol));
    const deposit = parseAmount(valueAt(row, depositCol));
    amountTHB = withdrawal > 0 ? withdrawal : -deposit;
  } else if (format === 'bangkok_bank' || format === 'krungsri') {
    const debitCol = findColumn(headers, ['debit', 'withdrawal', 'paid out', 'ถอน']);
    const creditCol = findColumn(headers, ['credit', 'deposit', 'paid in', 'ฝาก']);
    postedAt = parseDate(valueAt(row, dateCol >= 0 ? dateCol : 0));
    description = valueAt(row, descCol >= 0 ? descCol : 1);
    const debit = parseAmount(valueAt(row, debitCol));
    const credit = parseAmount(valueAt(row, creditCol));
    amountTHB = debit > 0 ? debit : -credit;
  } else {
    const amountCol = findColumn(headers, ['amount (thb)', 'amount thb', 'amount', 'จำนวนเงิน']);
    postedAt = parseDate(valueAt(row, dateCol >= 0 ? dateCol : 0));
    description = valueAt(row, descCol >= 0 ? descCol : 1);
    amountTHB = parseAmount(valueAt(row, amountCol >= 0 ? amountCol : 2));
  }

  ref = valueAt(row, refCol) || undefined;
  if (!description && amountTHB === 0) return null;
  if (!description) throw new CsvValidationError(`Row ${rowNumber}: transaction description is missing.`, { rowNumber });
  if (amountTHB === 0) return null;
  if (Number.isNaN(postedAt.getTime())) throw new CsvValidationError(`Row ${rowNumber}: transaction date is invalid.`, { rowNumber });

  return {
    postedAt,
    description,
    amountTHB,
    ref,
    raw: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  };
}

function generateDedupeKey(source: string, postedAt: Date, amountTHB: number, description: string): string {
  const dateStr = postedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const absAmount = Math.abs(amountTHB);
  const descPrefix = description.slice(0, 32).toUpperCase();
  return `${source}|${dateStr}|${absAmount}|${descPrefix}`;
}

function isMissingVendorRuleTableError(error: any): boolean {
  const messages = [
    error?.message,
    error?.detail,
    error?.cause?.message,
    error?.cause?.detail,
  ].filter(Boolean).map(String);

  return (
    error?.code === '42P01' ||
    error?.cause?.code === '42P01' ||
    messages.some((message) => /relation ["']?vendor_rule["']? does not exist/i.test(message))
  );
}

function logMissingVendorRuleWarning(where: string, error: any) {
  console.warn('bank_import_vendor_rule_unavailable', {
    code: 'VENDOR_RULE_TABLE_MISSING',
    message: 'vendor_rule table is unavailable; continuing without vendor/category suggestions.',
    where,
    canonical_source: 'vendor_rule',
    auto_build_attempted: false,
    db_code: error?.code || error?.cause?.code,
  });
}

function missingVendorRuleWarning(where: string) {
  return {
    code: 'VENDOR_RULE_TABLE_MISSING',
    message: 'vendor_rule table is unavailable; vendor/category suggestions are disabled.',
    where,
    canonical_source: 'vendor_rule',
    auto_build_attempted: false,
  };
}

async function applyVendorRules(txns: ParsedTransaction[]): Promise<EnhancedTransaction[]> {
  let rules: any[];
  try {
    rules = await db.select().from(vendorRule);
  } catch (error: any) {
    if (isMissingVendorRuleTableError(error)) {
      logMissingVendorRuleWarning('applyVendorRules', error);
      return txns;
    }
    throw error;
  }
  
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
    let records: string[][];
    try {
      records = parseCsv(csvContent, {
        bom: true,
        relaxColumnCount: true,
        skipEmptyLines: true,
        trim: true,
      });
    } catch (error: any) {
      throw new CsvValidationError(`CSV parser error: ${error.message || 'invalid CSV file'}`);
    }

    if (records.length < 2) {
      throw new CsvValidationError("CSV file must have at least a header and one data row");
    }

    const headers = records[0].map(h => String(h || '').trim());
    if (headers.every(h => !h)) {
      throw new CsvValidationError("CSV header row is empty");
    }

    const format = detectBankFormat(headers);
    const source = req.body.source || format.toUpperCase();
    const rowErrors: string[] = [];
    const rawTxns: ParsedTransaction[] = [];

    for (let i = 1; i < records.length; i++) {
      try {
        const parsed = parseCSVRow(records[i], format, headers, i + 1);
        if (parsed) rawTxns.push(parsed);
      } catch (error: any) {
        rowErrors.push(error.message || `Row ${i + 1}: could not parse transaction.`);
        if (rowErrors.length >= 5) break;
      }
    }

    if (rawTxns.length === 0) {
      throw new CsvValidationError(
        rowErrors.length > 0 ? rowErrors[0] : "No valid transactions found in CSV. Check date, description, and amount columns.",
        { format, headers, rowErrors }
      );
    }

    if (!db) {
      return res.status(503).json({
        error: "Database unavailable for bank import",
        reason: "DATABASE_URL is not configured, so parsed transactions cannot be saved for review.",
        details: { format, parsedRows: rawTxns.length },
      });
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

  } catch (error: any) {
    console.error('CSV upload error:', error);
    const status = error instanceof CsvValidationError ? error.status : 500;
    res.status(status).json({
      error: status === 500 ? "Failed to process CSV upload" : error.message,
      reason: error.message,
      details: error.details,
    });
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

    // Get requested transactions. Already-approved rows with an expense link are returned
    // idempotently so duplicate approval attempts do not create duplicate expenses.
    const txnsToApprove = await db.select()
      .from(bankTxn)
      .where(
        and(
          eq(bankTxn.batchId, batchId),
          inArray(bankTxn.id, ids)
        )
      );

    if (txnsToApprove.length === 0) {
      return res.status(400).json({ error: "No transactions found to approve" });
    }

    const approvedTxns: any[] = [];
    const blockers: any[] = [];

    for (const txn of txnsToApprove) {
      if (txn.status === 'approved' && txn.expenseId) {
        approvedTxns.push(txn);
        continue;
      }

      if (txn.status !== 'pending') {
        blockers.push({
          code: 'BANK_TXN_NOT_PENDING',
          message: 'Only pending transactions can be approved into expenses.',
          where: `bank_txn:${txn.id}`,
          canonical_source: 'bank_txn',
          auto_build_attempted: false,
        });
        continue;
      }

      const amountTHB = Number(txn.amountTHB);

      if (!Number.isFinite(amountTHB) || amountTHB <= 0) {
        blockers.push({
          code: 'BANK_TXN_NOT_EXPENSE_OUTFLOW',
          message: 'Only positive outflow bank transactions can create expense records.',
          where: `bank_txn:${txn.id}`,
          canonical_source: 'bank_txn',
          auto_build_attempted: false,
        });
        continue;
      }

      const supplier = defaults?.supplier || txn.supplier;
      const category = defaults?.category || txn.category;

      if (!supplier || !category) {
        blockers.push({
          code: 'BANK_TXN_EXPENSE_MAPPING_INCOMPLETE',
          message: 'Supplier and category are required before approval can create an expense.',
          where: `bank_txn:${txn.id}`,
          canonical_source: 'bank_txn',
          auto_build_attempted: false,
        });
        continue;
      }


      const expenseId = `bank_txn:${txn.id}`;
      // expenses."costCents" is a legacy/misnamed column in this app. Existing
      // expensesV2 reads and totals it as whole Thai Baht, not satang/cents, so
      // bank_txn.amountTHB is written through unchanged with no ×100 conversion.
      const expenseAmountTHB = amountTHB;
      await db.execute(sql`
        INSERT INTO expenses (id, "restaurantId", "shiftDate", supplier, "costCents", item, "expenseType", meta, source, "createdAt")
        VALUES (
          ${expenseId},
          ${req.headers['x-restaurant-id'] || 'sbb'},
          ${txn.postedAt},
          ${supplier},
          ${expenseAmountTHB},
          ${txn.description},
          ${category},
          ${JSON.stringify({
            source: 'bank_import',
            bankTxnId: txn.id,
            bankImportBatchId: batchId,
            bankRef: txn.ref || null,
            notes: defaults?.notes || txn.notes || null,
            dedupeKey: txn.dedupeKey,
            amountTHB,
          })}::jsonb,
          'BANK_UPLOAD',
          now()
        )
        ON CONFLICT (id) DO NOTHING
      `);

      const [updatedTxn] = await db.update(bankTxn)
        .set({
          status: 'approved',
          category,
          supplier,
          notes: defaults?.notes || txn.notes,
          expenseId,
        })
        .where(and(eq(bankTxn.id, txn.id), eq(bankTxn.status, 'pending')))
        .returning();

      if (updatedTxn) approvedTxns.push(updatedTxn);
    }

    const batchTxns = await db.select().from(bankTxn).where(eq(bankTxn.batchId, batchId));
    const approvedCount = batchTxns.filter((txn) => txn.status === 'approved').length;
    await db.update(bankImportBatch)
      .set({ status: approvedCount === batchTxns.length ? 'approved' : approvedCount > 0 ? 'partially_approved' : 'pending' })
      .where(eq(bankImportBatch.id, batchId));

    res.json({
      ok: blockers.length === 0,
      approved: approvedTxns.length,
      txns: approvedTxns,
      blockers,
      holdSupported: false,
      holdSchemaGap: 'bank_txn_status enum does not include hold; no schema migration was performed.',
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

  } catch (error: any) {
    if (isMissingVendorRuleTableError(error)) {
      logMissingVendorRuleWarning('GET /api/bank-imports/rules', error);
      return res.json({
        ok: true,
        rules: [],
        warnings: [missingVendorRuleWarning('GET /api/bank-imports/rules')],
      });
    }

    console.error('List rules error:', error);
    res.status(500).json({ error: "Failed to fetch vendor rules" });
  }
});

// GET /api/bank-imports — list all import batches (returns [] if table not yet created)
router.get("/", async (req, res) => {
  try {
    const batches = await db.select().from(bankImportBatch).orderBy(desc(bankImportBatch.createdAt));
    res.json({ batches });
  } catch (e: any) {
    // Table may not yet be migrated — return empty list gracefully
    res.json({ batches: [] });
  }
});

export { router as bankImportRouter };
