// Golden Patch - Expenses Import & Approval API Routes
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../db.js';
import { importedExpenses, partnerStatements, expenses } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Extend Express Request interface
interface AuthenticatedRequest extends Request {
  restaurantId: string;
  userId: string;
  userRole: string;
  approvedBy: string;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// SECURE Authentication middleware - REQUIRES valid authentication
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const restaurantId = req.headers['x-restaurant-id'] as string;
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  
  // SECURITY: Reject requests without proper authentication
  if (!restaurantId || !userId || restaurantId === 'default' || userId === 'anonymous') {
    return res.status(401).json({ error: 'Authentication required: Missing or invalid restaurant/user credentials' });
  }
  
  const authReq = req as AuthenticatedRequest;
  authReq.restaurantId = restaurantId;
  authReq.userId = userId;
  authReq.userRole = userRole || 'user';
  authReq.approvedBy = userId;
  next();
};

// AUTHORIZATION: Check if user can perform sensitive operations
const requireManagerRole = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.userRole !== 'manager' && authReq.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions: Manager role required' });
  }
  next();
};

// Apply auth to all routes
router.use(requireAuth);

// CSV validation schemas
// Fixed for Thai bilingual bank statement headers with newlines
const bankRowSchema = z.object({
  'Date\nวันที่': z.string(),
  'Description\nรายละเอียด': z.string(), 
  'Debit/Credit\nลูกหนี้/เจ้าหนี้': z.string(),
  'Balance/Baht\nยอดเงินคงเหลือ': z.string().optional(),
});

const partnerRowSchema = z.object({
  'Statement Date': z.string(),
  'Gross Sales': z.string(),
  'Commission Fee': z.string(), 
  'Net Payout': z.string(),
});

// Utility functions
function parseThaiDate(dateStr: string): string {
  // Handle dd/mm/yy and dd/mm/yyyy format common in Thailand
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, yearStr] = parts;
    let year = yearStr;
    
    // Handle 2-digit years: convert yy to yyyy
    if (yearStr.length === 2) {
      const twoDigitYear = parseInt(yearStr, 10);
      // Assume years 00-50 are 2000-2050, 51-99 are 1951-1999
      year = twoDigitYear <= 50 ? `20${yearStr}` : `19${yearStr}`;
    }
    
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Fallback for other formats
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    throw new Error(`Unable to parse date: ${dateStr}`);
  }
}

function parseAmount(amountStr: string): number {
  // Remove commas, handle negative values, convert to cents
  const cleaned = amountStr.replace(/[,\s]/g, '');
  const amount = parseFloat(cleaned) || 0;
  return Math.round(amount * 100); // Convert to cents
}

// POST /api/expenses/upload-bank - REQUIRES MANAGER ROLE
router.post('/upload-bank', requireManagerRole, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
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
    const restaurantId = authReq.restaurantId;

    const insertData = [];
    for (const record of records) {
      try {
        const validatedRow = bankRowSchema.parse(record);
        
        const date = parseThaiDate(validatedRow['Date\nวันที่']);
        // Handle single Debit/Credit column - positive values are credits (income), negative are debits (expenses)
        const debitCreditAmount = parseAmount(validatedRow['Debit/Credit\nลูกหนี้/เจ้าหนี้']);
        
        // For bank statements: positive amounts are income (credits), negative are expenses (debits)
        const amountCents = debitCreditAmount;
        
        if (amountCents !== 0) { // Only import non-zero transactions
          insertData.push({
            restaurantId,
            importBatchId,
            date, // Already returns date string from parseThaiDate
            description: validatedRow['Description\nรายละเอียด'],
            amountCents,
            supplier: null,
            category: null,
            source: 'BANK_UPLOAD' as const,
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

// POST /api/expenses/upload-partner - REQUIRES MANAGER ROLE
router.post('/upload-partner', requireManagerRole, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
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
    const restaurantId = authReq.restaurantId;
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
          statementDate, // Already returns date string from parseThaiDate
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
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // SECURITY: Filter by restaurantId to prevent cross-tenant data leakage
    const pendingExpenses = await db
      .select()
      .from(importedExpenses)
      .where(and(
        eq(importedExpenses.status, 'PENDING'),
        eq(importedExpenses.restaurantId, authReq.restaurantId)
      ))
      .orderBy(importedExpenses.createdAt);

    // Convert cents to THB for frontend display with null safety
    const formatted = pendingExpenses.map((expense) => ({
      ...expense,
      amountTHB: expense.amountCents !== null ? expense.amountCents / 100 : 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending expenses' });
  }
});

// PATCH /api/expenses/:id/approve - REQUIRES MANAGER ROLE
router.patch('/:id/approve', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { category, supplier } = req.body;
    const approvedBy = authReq.approvedBy;

    // SECURITY: Get pending expense with restaurant scoping
    const [pendingExpense] = await db
      .select()
      .from(importedExpenses)
      .where(and(
        eq(importedExpenses.id, id),
        eq(importedExpenses.status, 'PENDING'),
        eq(importedExpenses.restaurantId, authReq.restaurantId)
      ));

    if (!pendingExpense) {
      return res.status(404).json({ error: 'Pending expense not found or access denied' });
    }

    // SECURITY: Validate ledger integrity - only negative amounts can be expenses
    // Add null safety check for amountCents
    if (!pendingExpense.amountCents || pendingExpense.amountCents >= 0) {
      return res.status(400).json({ 
        error: 'Ledger integrity violation: Cannot approve positive amounts as expenses. Positive amounts indicate income.' 
      });
    }

    // Insert into canonical expenses table with BANK_IMPORT source
    await db.insert(expenses).values({
      restaurantId: pendingExpense.restaurantId || '', // Add null safety
      shiftDate: pendingExpense.date ? new Date(pendingExpense.date) : new Date(),
      item: pendingExpense.description || 'Bank Import',
      costCents: Math.abs(pendingExpense.amountCents), // Convert to positive for expense ledger
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

// PATCH /api/expenses/:id/reject - REQUIRES MANAGER ROLE
router.patch('/:id/reject', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const approvedBy = authReq.approvedBy;

    // SECURITY: Reject with restaurant scoping
    const result = await db
      .update(importedExpenses)
      .set({ 
        status: 'REJECTED', 
        approvedBy,
        approvedAt: new Date()
      })
      .where(and(
        eq(importedExpenses.id, id),
        eq(importedExpenses.status, 'PENDING'),
        eq(importedExpenses.restaurantId, authReq.restaurantId)
      ))
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

// Partners summary endpoint moved to server/routes/partners.ts

export default router;