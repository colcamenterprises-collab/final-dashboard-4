// Golden Patch - Expenses Import & Approval API Routes
import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../db.js';
import { importedExpenses, partnerStatements, expenses } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// CSV validation schemas
const bankRowSchema = z.object({
  Date: z.string(),
  Description: z.string(), 
  'Withdrawal': z.string().optional(),
  'Deposit': z.string().optional(),
  'Balance': z.string().optional(),
});

const partnerRowSchema = z.object({
  'Statement Date': z.string(),
  'Gross Sales': z.string(),
  'Commission Fee': z.string(), 
  'Net Payout': z.string(),
});

// Utility functions
function parseThaiDate(dateStr: string): Date {
  // Handle dd/mm/yyyy format common in Thailand
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  return new Date(dateStr);
}

function parseAmount(amountStr: string): number {
  // Remove commas, handle negative values, convert to cents
  const cleaned = amountStr.replace(/[,\s]/g, '');
  const amount = parseFloat(cleaned) || 0;
  return Math.round(amount * 100); // Convert to cents
}

// POST /api/expenses/upload-bank
router.post('/upload-bank', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const importBatchId = `batch_${Date.now()}`;
    const restaurantId = 'default'; // TODO: Get from authenticated user

    const insertData = [];
    for (const record of records) {
      try {
        const validatedRow = bankRowSchema.parse(record);
        
        const date = parseThaiDate(validatedRow.Date);
        const withdrawal = parseAmount(validatedRow.Withdrawal || '0');
        const deposit = parseAmount(validatedRow.Deposit || '0'); 
        
        // Net amount: deposits are positive income, withdrawals are negative expenses
        const amountCents = deposit - withdrawal;
        
        if (amountCents !== 0) { // Only import non-zero transactions
          insertData.push({
            restaurantId,
            importBatchId,
            date,
            description: validatedRow.Description,
            amountCents,
            rawData: record,
            status: 'PENDING' as const,
          });
        }
      } catch (rowError) {
        console.warn('Skipping invalid row:', record, rowError);
      }
    }

    if (insertData.length === 0) {
      return res.status(400).json({ error: 'No valid transactions found in CSV' });
    }

    const result = await db.insert(importedExpenses).values(insertData).returning();
    
    res.json({ 
      success: true, 
      imported: result.length,
      batchId: importBatchId 
    });

  } catch (error) {
    console.error('Bank upload error:', error);
    res.status(500).json({ error: 'Failed to process bank statement' });
  }
});

// POST /api/expenses/upload-partner  
router.post('/upload-partner', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const importBatchId = `partner_batch_${Date.now()}`;
    const restaurantId = 'default'; // TODO: Get from authenticated user
    const partner = req.body.partner || 'Unknown';

    const insertData = [];
    for (const record of records) {
      try {
        const validatedRow = partnerRowSchema.parse(record);
        
        const statementDate = parseThaiDate(validatedRow['Statement Date']);
        const grossSalesCents = parseAmount(validatedRow['Gross Sales']);
        const commissionCents = parseAmount(validatedRow['Commission Fee']);
        const netPayoutCents = parseAmount(validatedRow['Net Payout']);
        
        insertData.push({
          restaurantId,
          partner,
          importBatchId,
          statementDate,
          grossSalesCents,
          commissionCents,
          netPayoutCents,
          rawData: record,
          status: 'PENDING' as const,
        });
      } catch (rowError) {
        console.warn('Skipping invalid partner row:', record, rowError);
      }
    }

    if (insertData.length === 0) {
      return res.status(400).json({ error: 'No valid partner statements found in CSV' });
    }

    const result = await db.insert(partnerStatements).values(insertData).returning();
    
    res.json({ 
      success: true, 
      imported: result.length,
      batchId: importBatchId 
    });

  } catch (error) {
    console.error('Partner upload error:', error);
    res.status(500).json({ error: 'Failed to process partner statement' });
  }
});

// GET /api/expenses/pending
router.get('/pending', async (req, res) => {
  try {
    const pendingExpenses = await db
      .select()
      .from(importedExpenses)
      .where(eq(importedExpenses.status, 'PENDING'))
      .orderBy(importedExpenses.createdAt);

    // Convert cents to THB for frontend display
    const formatted = pendingExpenses.map((expense: any) => ({
      ...expense,
      amountTHB: expense.amountCents ? expense.amountCents / 100 : 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending expenses' });
  }
});

// PATCH /api/expenses/:id/approve
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, supplier } = req.body;
    const approvedBy = 'manager'; // TODO: Get from authenticated user

    // Get the pending expense
    const [pendingExpense] = await db
      .select()
      .from(importedExpenses)
      .where(and(eq(importedExpenses.id, id), eq(importedExpenses.status, 'PENDING')));

    if (!pendingExpense) {
      return res.status(404).json({ error: 'Pending expense not found' });
    }

    // Insert into canonical expenses table with BANK_IMPORT source
    await db.insert(expenses).values({
      restaurantId: pendingExpense.restaurantId,
      shiftDate: new Date(pendingExpense.date!),
      item: pendingExpense.description || 'Bank Import',
      costCents: Math.abs(pendingExpense.amountCents || 0), // Ensure positive for expenses
      supplier: supplier || 'Bank Import',
      expenseType: category || 'General',
      source: 'BANK_IMPORT',
      meta: {
        importedExpenseId: pendingExpense.id,
        rawData: pendingExpense.rawData
      }
    });

    // Mark as approved
    await db
      .update(importedExpenses)
      .set({ 
        status: 'APPROVED', 
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(importedExpenses.id, id));

    res.json({ success: true, message: 'Expense approved and added to ledger' });

  } catch (error) {
    console.error('Approve expense error:', error);
    res.status(500).json({ error: 'Failed to approve expense' });
  }
});

// PATCH /api/expenses/:id/reject
router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const approvedBy = 'manager'; // TODO: Get from authenticated user

    const result = await db
      .update(importedExpenses)
      .set({ 
        status: 'REJECTED', 
        approvedBy,
        approvedAt: new Date()
      })
      .where(and(eq(importedExpenses.id, id), eq(importedExpenses.status, 'PENDING')))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Pending expense not found' });
    }

    res.json({ success: true, message: 'Expense rejected' });

  } catch (error) {
    console.error('Reject expense error:', error);
    res.status(500).json({ error: 'Failed to reject expense' });
  }
});

// GET /api/partners/summary
router.get('/partners/summary', async (req, res) => {
  try {
    const partnerSummaries = await db
      .select()
      .from(partnerStatements)
      .where(eq(partnerStatements.status, 'APPROVED'));

    // Calculate analytics
    const analytics = partnerSummaries.reduce((acc: any, statement: any) => {
      const partner = statement.partner || 'Unknown';
      
      if (!acc[partner]) {
        acc[partner] = {
          partner,
          totalSales: 0,
          totalCommission: 0,
          totalPayout: 0,
          statementCount: 0
        };
      }
      
      acc[partner].totalSales += statement.grossSalesCents || 0;
      acc[partner].totalCommission += statement.commissionCents || 0;
      acc[partner].totalPayout += statement.netPayoutCents || 0;
      acc[partner].statementCount += 1;
      
      return acc;
    }, {} as Record<string, any>);

    // Convert to array and calculate percentages
    const summaries = Object.values(analytics).map((summary: any) => ({
      ...summary,
      commissionRate: summary.totalSales > 0 ? (summary.totalCommission / summary.totalSales * 100) : 0,
      totalSalesTHB: summary.totalSales / 100,
      totalCommissionTHB: summary.totalCommission / 100,
      totalPayoutTHB: summary.totalPayout / 100
    }));

    res.json(summaries);

  } catch (error) {
    console.error('Partners summary error:', error);
    res.status(500).json({ error: 'Failed to fetch partner analytics' });
  }
});

export default router;