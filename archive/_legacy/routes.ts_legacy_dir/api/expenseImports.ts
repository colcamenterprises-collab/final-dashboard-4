import { Router } from 'express';
import { db } from '../db';
import { expenseImportBatch, expenseImportLine, vendors, categories, expenses } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { categorizationEngine } from '../services/expenseCategorizationEngine';
import { seedExpenseData } from '../seedExpenseData';
import Papa from 'papaparse';

const router = Router();

// Initialize seed data if needed
async function ensureSeedData() {
  const categoriesCount = await db.select().from(categories).limit(1);
  if (categoriesCount.length === 0) {
    await seedExpenseData();
  }
}

// POST /api/expenses/imports - Create new import batch
router.post('/', async (req, res) => {
  try {
    await ensureSeedData();
    
    const { type, filename, mime, contentBase64 } = req.body;
    
    if (!type || !filename || !contentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [batch] = await db.insert(expenseImportBatch).values({
      type,
      filename,
      originalMime: mime || 'text/csv',
      rowCount: 0,
      status: 'DRAFT',
      createdBy: 'user' // TODO: Get from auth session
    }).returning();

    res.json({ batchId: batch.id });
  } catch (error) {
    console.error('Error creating import batch:', error);
    res.status(500).json({ error: 'Failed to create import batch' });
  }
});

// POST /api/expenses/imports/:batchId/parse - Parse uploaded content
router.post('/:batchId/parse', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { mapping, locale = 'th-TH', contentBase64 } = req.body;

    if (!contentBase64) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Decode base64 content
    const content = Buffer.from(contentBase64, 'base64').toString('utf-8');
    
    // Parse CSV content
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing failed', 
        details: parseResult.errors 
      });
    }

    const rows = parseResult.data as any[];
    const importLines = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Apply column mapping or use defaults
        const dateRaw = mapping?.date ? row[mapping.date] : (row['Date'] || row['date'] || row['วันที่']);
        const descriptionRaw = mapping?.description ? row[mapping.description] : (row['Description'] || row['description'] || row['รายการ']);
        const amountRaw = mapping?.amount ? row[mapping.amount] : (row['Amount'] || row['amount'] || row['จำนวน']);
        const currencyRaw = mapping?.currency ? row[mapping.currency] : (row['Currency'] || row['currency'] || 'THB');

        if (!descriptionRaw || !amountRaw) {
          continue; // Skip rows without essential data
        }

        // Parse amount
        const amount = parseFloat(String(amountRaw).replace(/[^\d.-]/g, ''));
        if (isNaN(amount) || amount >= 0) {
          continue; // Skip positive amounts (credits) or invalid amounts
        }

        // Parse date
        let parsedDate: Date;
        try {
          parsedDate = new Date(dateRaw);
          if (isNaN(parsedDate.getTime())) {
            throw new Error('Invalid date');
          }
        } catch {
          // Try Thai date format parsing
          const thaiDateMatch = String(dateRaw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (thaiDateMatch) {
            const [, day, month, year] = thaiDateMatch;
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            continue; // Skip if can't parse date
          }
        }

        // Categorize the expense
        const categorization = await categorizationEngine.categorizeExpense({
          date: parsedDate.toISOString(),
          description: String(descriptionRaw),
          amount: Math.abs(amount),
          currency: String(currencyRaw) || 'THB',
          side: 'debit'
        });

        // Check for duplicates
        const duplicateId = await categorizationEngine.checkDuplicates(
          Math.abs(amount),
          parsedDate.toISOString(),
          String(descriptionRaw)
        );

        importLines.push({
          batchId: parseInt(batchId),
          rowIndex: i,
          dateRaw: String(dateRaw),
          descriptionRaw: String(descriptionRaw),
          amountRaw: String(amountRaw),
          currencyRaw: String(currencyRaw) || 'THB',
          parsedOk: true,
          parseErrors: null,
          vendorGuess: categorization.vendorGuess,
          categoryGuessId: categorization.categoryGuessId,
          confidence: categorization.confidence,
          duplicateOfExpenseId: duplicateId
        });

      } catch (error) {
        // Store parse errors
        importLines.push({
          batchId: parseInt(batchId),
          rowIndex: i,
          dateRaw: String(row[mapping?.date || 'Date'] || ''),
          descriptionRaw: String(row[mapping?.description || 'Description'] || ''),
          amountRaw: String(row[mapping?.amount || 'Amount'] || ''),
          currencyRaw: String(row[mapping?.currency || 'Currency'] || 'THB'),
          parsedOk: false,
          parseErrors: { message: (error as Error).message },
          vendorGuess: null,
          categoryGuessId: null,
          confidence: 0,
          duplicateOfExpenseId: null
        });
      }
    }

    // Save import lines to database
    if (importLines.length > 0) {
      await db.insert(expenseImportLine).values(importLines);
    }

    // Update batch row count
    await db.update(expenseImportBatch)
      .set({ 
        rowCount: importLines.length,
        status: 'REVIEW'
      })
      .where(eq(expenseImportBatch.id, parseInt(batchId)));

    res.json({ 
      rows: importLines.length,
      parsed: importLines.filter(l => l.parsedOk).length,
      errors: importLines.filter(l => !l.parsedOk).length
    });

  } catch (error) {
    console.error('Error parsing import:', error);
    res.status(500).json({ error: 'Failed to parse import' });
  }
});

// GET /api/expenses/imports/:batchId/lines - Get import lines for review
router.get('/:batchId/lines', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { uncertain = '0' } = req.query;

    let query = db
      .select({
        id: expenseImportLine.id,
        rowIndex: expenseImportLine.rowIndex,
        dateRaw: expenseImportLine.dateRaw,
        descriptionRaw: expenseImportLine.descriptionRaw,
        amountRaw: expenseImportLine.amountRaw,
        currencyRaw: expenseImportLine.currencyRaw,
        parsedOk: expenseImportLine.parsedOk,
        parseErrors: expenseImportLine.parseErrors,
        vendorGuess: expenseImportLine.vendorGuess,
        categoryGuessId: expenseImportLine.categoryGuessId,
        confidence: expenseImportLine.confidence,
        duplicateOfExpenseId: expenseImportLine.duplicateOfExpenseId
      })
      .from(expenseImportLine)
      .where(eq(expenseImportLine.batchId, parseInt(batchId)));

    if (uncertain === '1') {
      query = query.where(and(
        eq(expenseImportLine.batchId, parseInt(batchId)),
        // Add condition for confidence < 0.8
      ));
    }

    const lines = await query.orderBy(expenseImportLine.rowIndex);

    res.json(lines);
  } catch (error) {
    console.error('Error fetching import lines:', error);
    res.status(500).json({ error: 'Failed to fetch import lines' });
  }
});

// GET /api/expenses/vendors - Get vendors for dropdown
router.get('/vendors', async (req, res) => {
  try {
    const { q } = req.query;
    
    let query = db.select().from(vendors);
    
    if (q) {
      query = query.where(
        // Add ILIKE search condition
      );
    }
    
    const vendorList = await query.limit(20);
    res.json(vendorList);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET /api/expenses/categories - Get categories for dropdown
router.get('/categories', async (req, res) => {
  try {
    const categoryList = await db.select().from(categories);
    res.json(categoryList);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// PATCH /api/expenses/imports/:batchId/lines/:lineId - Update import line
router.patch('/:batchId/lines/:lineId', async (req, res) => {
  try {
    const { batchId, lineId } = req.params;
    const { vendorId, categoryId, ignore, note } = req.body;

    const updates: any = {};
    if (vendorId !== undefined) updates.vendorGuess = vendorId;
    if (categoryId !== undefined) updates.categoryGuessId = categoryId;
    if (note !== undefined) updates.parseErrors = { note };

    await db.update(expenseImportLine)
      .set(updates)
      .where(and(
        eq(expenseImportLine.id, parseInt(lineId)),
        eq(expenseImportLine.batchId, parseInt(batchId))
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating import line:', error);
    res.status(500).json({ error: 'Failed to update import line' });
  }
});

// POST /api/expenses/imports/:batchId/commit - Commit reviewed lines to expenses
router.post('/:batchId/commit', async (req, res) => {
  try {
    const { batchId } = req.params;

    // Get all reviewed lines
    const lines = await db
      .select()
      .from(expenseImportLine)
      .where(and(
        eq(expenseImportLine.batchId, parseInt(batchId)),
        eq(expenseImportLine.parsedOk, true)
      ));

    const expenseEntries = [];

    for (const line of lines) {
      // Skip duplicates
      if (line.duplicateOfExpenseId) continue;

      // Parse the line data
      const amount = parseFloat(String(line.amountRaw).replace(/[^\d.-]/g, ''));
      const date = new Date(line.dateRaw);

      expenseEntries.push({
        date,
        descriptionRaw: line.descriptionRaw,
        amountMinor: Math.round(Math.abs(amount) * 100), // Convert to minor currency units
        currency: line.currencyRaw || 'THB',
        source: 'DIRECT_UPLOAD',
        vendorId: line.vendorGuess ? parseInt(line.vendorGuess) : null,
        categoryId: line.categoryGuessId,
        importBatchId: parseInt(batchId),
        notes: null
      });
    }

    // Insert expenses
    if (expenseEntries.length > 0) {
      await db.insert(expenses).values(expenseEntries);
    }

    // Update batch status
    await db.update(expenseImportBatch)
      .set({ status: 'COMMITTED' })
      .where(eq(expenseImportBatch.id, parseInt(batchId)));

    res.json({ 
      committed: expenseEntries.length,
      skipped: lines.length - expenseEntries.length
    });

  } catch (error) {
    console.error('Error committing import:', error);
    res.status(500).json({ error: 'Failed to commit import' });
  }
});

// GET /api/expenses/imports - Get all import batches
router.get('/', async (req, res) => {
  try {
    const batches = await db
      .select()
      .from(expenseImportBatch)
      .orderBy(desc(expenseImportBatch.createdAt))
      .limit(50);

    res.json(batches);
  } catch (error) {
    console.error('Error fetching import batches:', error);
    res.status(500).json({ error: 'Failed to fetch import batches' });
  }
});

export default router;