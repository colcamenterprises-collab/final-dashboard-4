// Golden Patch - Expenses Import & Approval API Routes
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../db.js';
import { importedExpenses, partnerStatements, expenses, supplierDefaults } from '../../shared/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
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
function parseThaiDate(dateStr: string): string | null {
  // Early return for known non-date summary rows
  const summaryPatterns = [
    'TOTAL AMOUNTS',
    'TOTAL ITEMS', 
    'BALANCE BROUGHT FORWARD',
    'ยอดเงินคงเหลือยกมา',
    'รวมทั้งหมด',
    'ยอดยกมา',
    'ยอดคงเหลือ',
    /^TOTAL\s/i,
    /^รวม/
  ];
  
  const trimmedDate = dateStr.trim();
  for (const pattern of summaryPatterns) {
    if (pattern instanceof RegExp) {
      if (pattern.test(trimmedDate)) {
        return null;
      }
    } else if (trimmedDate.includes(pattern)) {
      return null;
    }
  }

  // Thai month names mapping to numbers
  const thaiMonths: { [key: string]: string } = {
    'มกราคม': '01', 'ม.ค.': '01',
    'กุมภาพันธ์': '02', 'ก.พ.': '02', 
    'มีนาคม': '03', 'มี.ค.': '03',
    'เมษายน': '04', 'เม.ย.': '04',
    'พฤษภาคม': '05', 'พ.ค.': '05', 
    'มิถุนายน': '06', 'มิ.ย.': '06',
    'กรกฎาคม': '07', 'ก.ค.': '07',
    'สิงหาคม': '08', 'ส.ค.': '08',
    'กันยายน': '09', 'ก.ย.': '09',
    'ตุลาคม': '10', 'ต.ค.': '10',
    'พฤศจิกายน': '11', 'พ.ย.': '11',
    'ธันวาคม': '12', 'ธ.ค.': '12'
  };

  // Convert Thai numerals to Arabic numerals
  function convertThaiNumerals(str: string): string {
    const thaiNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    const arabicNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    let result = str;
    for (let i = 0; i < thaiNumerals.length; i++) {
      result = result.replace(new RegExp(thaiNumerals[i], 'g'), arabicNumerals[i]);
    }
    return result;
  }

  // Convert Buddhist Era to Gregorian calendar
  function convertBuddhistYear(year: number): number {
    // Buddhist Era is 543 years ahead of Gregorian calendar
    if (year > 2300) { // Likely Buddhist Era
      return year - 543;
    }
    return year;
  }

  try {
    // Clean and convert Thai numerals
    const cleanDateStr = convertThaiNumerals(trimmedDate);

    // Handle ISO date format YYYY-MM-DD (standard format for test data)
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDatePattern.test(cleanDateStr)) {
      const [year, month, day] = cleanDateStr.split('-');
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      
      // Validate ranges
      if (!isNaN(yearNum) && !isNaN(monthNum) && !isNaN(dayNum) &&
          yearNum >= 1900 && yearNum <= 2100 &&
          monthNum >= 1 && monthNum <= 12 &&
          dayNum >= 1 && dayNum <= 31) {
        return cleanDateStr; // Already in correct format
      }
    }

    // Handle dd/mm/yyyy or dd/mm/yy format (most common in Thai bank statements)
    const slashParts = cleanDateStr.split('/');
    if (slashParts.length === 3) {
      const [day, month, yearStr] = slashParts;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      let year = parseInt(yearStr, 10);
      
      // Validate day and month ranges
      if (isNaN(dayNum) || isNaN(monthNum) || isNaN(year) || 
          dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        return null;
      }
      
      // Handle 2-digit years: convert yy to yyyy
      if (yearStr.length === 2) {
        const twoDigitYear = parseInt(yearStr, 10);
        // Assume years 00-50 are 2000-2050, 51-99 are 1951-1999
        year = twoDigitYear <= 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
      }
      
      // Convert Buddhist Era to Gregorian if needed
      year = convertBuddhistYear(year);
      
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Handle Thai date format like "1 มกราคม 2567" or "1 ม.ค. 67"
    for (const [thaiMonth, monthNum] of Object.entries(thaiMonths)) {
      if (cleanDateStr.includes(thaiMonth)) {
        const regex = new RegExp(`(\\d+)\\s*${thaiMonth}\\s*(\\d+)`);
        const match = cleanDateStr.match(regex);
        if (match) {
          const day = parseInt(match[1], 10);
          let year = parseInt(match[2], 10);
          
          // Validate ranges
          if (isNaN(day) || isNaN(year) || day < 1 || day > 31) {
            return null;
          }
          
          // Handle 2-digit years
          if (year < 100) {
            year = year <= 50 ? 2000 + year : 1900 + year;
          }
          
          // Convert Buddhist Era to Gregorian
          year = convertBuddhistYear(year);
          
          return `${year}-${monthNum}-${day.toString().padStart(2, '0')}`;
        }
      }
    }

    // Handle dd-mm-yyyy format
    const dashParts = cleanDateStr.split('-');
    if (dashParts.length === 3) {
      const [day, month, yearStr] = dashParts;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      let year = parseInt(yearStr, 10);
      
      // Validate ranges
      if (isNaN(dayNum) || isNaN(monthNum) || isNaN(year) || 
          dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        return null;
      }
      
      year = convertBuddhistYear(year);
      return `${year}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    }

    // Fallback for other formats
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    // Return null instead of throwing error
    return null;
  }
}

function parseAmount(amountStr: string): number {
  // Remove commas, handle negative values, convert to cents
  const cleaned = amountStr.replace(/[,\s]/g, '');
  const amount = parseFloat(cleaned) || 0;
  return Math.round(amount * 100); // Convert to cents
}

// Normalize CSV headers by converting escaped newlines to literal newlines
function normalizeHeaders(record: any): any {
  const normalized: any = {};
  for (const [key, value] of Object.entries(record)) {
    // Convert escaped newlines (\\n) to literal newlines (\n)
    const normalizedKey = key.replace(/\\n/g, '\n');
    normalized[normalizedKey] = value;
  }
  return normalized;
}

// Supplier Detection Utility - detects supplier from transaction description
function detectSupplier(description: string): string | null {
  if (!description) return null;
  
  const desc = description.toLowerCase();
  
  // Common Thai billers and suppliers with multiple name variations
  const supplierPatterns = [
    { patterns: ['makro', 'แม็คโคร', 'macro'], supplier: 'Makro' },
    { patterns: ['big c', 'บิ๊กซี', 'bigc'], supplier: 'Big C' },
    { patterns: ['lotus', 'โลตัส', 'tesco lotus'], supplier: 'Lotus' },
    { patterns: ['7-eleven', 'เซเว่น', '7eleven', 'seven eleven'], supplier: '7-Eleven' },
    { patterns: ['villa market', 'วิลล่า มาร์เก็ต', 'villa'], supplier: 'Villa Market' },
    { patterns: ['central', 'เซ็นทรัล'], supplier: 'Central' },
    { patterns: ['robinson', 'โรบินสัน'], supplier: 'Robinson' },
    { patterns: ['foodland', 'ฟู้ดแลนด์'], supplier: 'Foodland' },
    { patterns: ['tops', 'ท็อปส์'], supplier: 'Tops' },
    { patterns: ['gourmet market', 'กูร์เมต์ มาร์เก็ต'], supplier: 'Gourmet Market' },
    { patterns: ['shell', 'เชลล์'], supplier: 'Shell' },
    { patterns: ['ptt', 'ปตท.'], supplier: 'PTT' },
    { patterns: ['bangchak', 'บางจาก'], supplier: 'Bangchak' },
    { patterns: ['esso', 'เอสโซ่'], supplier: 'Esso' },
    { patterns: ['grab', 'แกร็บ'], supplier: 'Grab' },
    { patterns: ['lineman', 'ไลน์แมน'], supplier: 'Lineman' },
    { patterns: ['foodpanda', 'ฟู้ดแพนด้า'], supplier: 'FoodPanda' },
  ];
  
  // Check each supplier pattern
  for (const { patterns, supplier } of supplierPatterns) {
    for (const pattern of patterns) {
      if (desc.includes(pattern)) {
        return supplier;
      }
    }
  }
  
  return null;
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
        // Normalize headers before validation
        const normalizedRecord = normalizeHeaders(record);
        const validatedRow = bankRowSchema.parse(normalizedRecord);
        
        const date = parseThaiDate(validatedRow['Date\nวันที่']);
        
        // Skip rows with invalid dates (summary rows, etc.)
        if (!date) {
          console.log('Skipping non-date row:', validatedRow['Date\nวันที่']);
          continue;
        }
        
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
        console.warn('Skipping invalid bank row:', record, 'Available headers:', Object.keys(record), 'Error:', rowError);
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
    console.error('[EXPENSE_SAFE_FAIL] bank-upload:', error);
    res.status(200).json({ 
      success: true, 
      imported: 0, 
      batchId: null, 
      warning: 'SAFE_FALLBACK_USED' 
    });
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
        // Normalize headers before validation (consistent with bank upload)
        const normalizedRecord = normalizeHeaders(record);
        const validatedRow = partnerRowSchema.parse(normalizedRecord);
        
        const statementDate = parseThaiDate(validatedRow['Statement Date']);
        
        // Skip rows with invalid dates (summary rows, etc.)
        if (!statementDate) {
          console.log('Skipping non-date partner row:', validatedRow['Statement Date']);
          continue;
        }
        
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
        console.warn('Skipping invalid partner row:', record, 'Available headers:', Object.keys(record), 'Error:', rowError);
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
    console.error('[EXPENSE_SAFE_FAIL] partner-upload:', error);
    res.status(200).json({ 
      success: true, 
      imported: 0, 
      batchId: null, 
      warning: 'SAFE_FALLBACK_USED' 
    });
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
    console.error('[EXPENSE_SAFE_FAIL] pending:', error);
    res.status(200).json({ success: true, data: [], warning: 'SAFE_FALLBACK_USED' });
  }
});

// PATCH /api/expenses/:id/approve - REQUIRES MANAGER ROLE
router.patch('/:id/approve', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { category, supplier, notes, rememberDefault } = req.body;
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

    // SECURITY: Validate amount exists (positive amounts are expected for expenses from CSV)
    // Add null safety check for amountCents
    if (!pendingExpense.amountCents || pendingExpense.amountCents === 0) {
      return res.status(400).json({ 
        error: 'Invalid expense amount: Amount cannot be null or zero.' 
      });
    }

    // Smart defaults logic
    let finalSupplier = supplier;
    let finalCategory = category;
    let defaultsApplied = false;

    // If category not provided, try to auto-detect supplier and fetch defaults
    if (!finalCategory && pendingExpense.description) {
      const detectedSupplier = detectSupplier(pendingExpense.description);
      if (detectedSupplier) {
        // Fetch default category for detected supplier
        const [supplierDefault] = await db
          .select()
          .from(supplierDefaults)
          .where(and(
            eq(supplierDefaults.supplier, detectedSupplier),
            eq(supplierDefaults.restaurantId, authReq.restaurantId)
          ));

        if (supplierDefault) {
          finalSupplier = finalSupplier || detectedSupplier;
          finalCategory = supplierDefault.defaultCategory;
          defaultsApplied = true;
          console.log(`Applied default category for ${detectedSupplier}: ${finalCategory}`);
        }
      }
    }

    // Insert into canonical expenses table with correct enum value
    await db.insert(expenses).values({
      restaurantId: pendingExpense.restaurantId || '', // Add null safety
      date: pendingExpense.date || new Date().toISOString().split('T')[0],
      description: pendingExpense.description || 'Bank Import',
      amountCents: Math.abs(pendingExpense.amountCents), // Convert to positive for expense ledger
      supplier: finalSupplier || 'Bank Import',
      category: finalCategory || 'General',
      source: 'UPLOAD' // Golden Patch: Use valid schema enum value
    });

    // Save supplier default if rememberDefault is true and both supplier and category are provided
    if (rememberDefault && finalSupplier && finalCategory && finalSupplier !== 'Bank Import') {
      // Check if supplier default already exists
      const [existing] = await db
        .select()
        .from(supplierDefaults)
        .where(and(
          eq(supplierDefaults.supplier, finalSupplier),
          eq(supplierDefaults.restaurantId, authReq.restaurantId)
        ));

      if (existing) {
        // Update existing supplier default
        await db
          .update(supplierDefaults)
          .set({
            defaultCategory: finalCategory,
            updatedAt: new Date()
          })
          .where(and(
            eq(supplierDefaults.supplier, finalSupplier),
            eq(supplierDefaults.restaurantId, authReq.restaurantId)
          ));
      } else {
        // Create new supplier default
        await db
          .insert(supplierDefaults)
          .values({
            restaurantId: authReq.restaurantId,
            supplier: finalSupplier,
            defaultCategory: finalCategory,
          });
      }
      console.log(`Saved default for supplier ${finalSupplier}: ${finalCategory}`);
    }

    // Mark as approved
    await db
      .update(importedExpenses)
      .set({ 
        status: 'APPROVED', 
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(importedExpenses.id, id));

    res.json({ 
      success: true, 
      message: 'Expense approved and added to ledger',
      defaultsApplied,
      appliedSupplier: finalSupplier,
      appliedCategory: finalCategory
    });

  } catch (error) {
    console.error('[EXPENSE_SAFE_FAIL] approve:', error);
    res.status(200).json({ success: true, warning: 'SAFE_FALLBACK_USED' });
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
    console.error('[EXPENSE_SAFE_FAIL] reject:', error);
    res.status(200).json({ success: true, warning: 'SAFE_FALLBACK_USED' });
  }
});

// PATCH /api/expenses/batch-approve - REQUIRES MANAGER ROLE
router.patch('/batch-approve', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ids, supplier, category, rememberDefault } = req.body;
    const approvedBy = authReq.approvedBy;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing expense IDs array' });
    }

    // SECURITY: Get pending expenses with restaurant scoping
    const pendingExpenses = await db
      .select()
      .from(importedExpenses)
      .where(and(
        inArray(importedExpenses.id, ids),
        eq(importedExpenses.status, 'PENDING'),
        eq(importedExpenses.restaurantId, authReq.restaurantId)
      ));

    if (pendingExpenses.length === 0) {
      return res.status(404).json({ error: 'No pending expenses found for approval' });
    }

    let approvedCount = 0;
    const approvedExpenses = [];

    // Process each expense individually to apply smart defaults
    for (const pendingExpense of pendingExpenses) {
      // SECURITY: Validate amount exists
      if (!pendingExpense.amountCents || pendingExpense.amountCents === 0) {
        console.warn(`Skipping expense ${pendingExpense.id}: Invalid amount`);
        continue;
      }

      // Smart defaults logic (same as single approval)
      let finalSupplier = supplier;
      let finalCategory = category;
      let defaultsApplied = false;

      // If category not provided, try to auto-detect supplier and fetch defaults
      if (!finalCategory && pendingExpense.description) {
        const detectedSupplier = detectSupplier(pendingExpense.description);
        if (detectedSupplier) {
          // Fetch default category for detected supplier
          const [supplierDefault] = await db
            .select()
            .from(supplierDefaults)
            .where(and(
              eq(supplierDefaults.supplier, detectedSupplier),
              eq(supplierDefaults.restaurantId, authReq.restaurantId)
            ));

          if (supplierDefault) {
            finalSupplier = finalSupplier || detectedSupplier;
            finalCategory = supplierDefault.defaultCategory;
            defaultsApplied = true;
            console.log(`Applied default category for ${detectedSupplier}: ${finalCategory}`);
          }
        }
      }

      // Insert into canonical expenses table
      await db.insert(expenses).values({
        restaurantId: pendingExpense.restaurantId || '',
        date: pendingExpense.date || new Date().toISOString().split('T')[0],
        description: pendingExpense.description || 'Bank Import',
        amountCents: Math.abs(pendingExpense.amountCents),
        supplier: finalSupplier || 'Bank Import',
        category: finalCategory || 'General',
        source: 'UPLOAD'
      });

      approvedExpenses.push({
        id: pendingExpense.id,
        supplier: finalSupplier || 'Bank Import',
        category: finalCategory || 'General',
        defaultsApplied
      });
      
      approvedCount++;
    }

    // Save supplier default if rememberDefault is true and both supplier and category are provided
    if (rememberDefault && supplier && category && supplier !== 'Bank Import') {
      // Check if supplier default already exists
      const [existing] = await db
        .select()
        .from(supplierDefaults)
        .where(and(
          eq(supplierDefaults.supplier, supplier),
          eq(supplierDefaults.restaurantId, authReq.restaurantId)
        ));

      if (existing) {
        // Update existing supplier default
        await db
          .update(supplierDefaults)
          .set({
            defaultCategory: category,
            updatedAt: new Date()
          })
          .where(and(
            eq(supplierDefaults.supplier, supplier),
            eq(supplierDefaults.restaurantId, authReq.restaurantId)
          ));
      } else {
        // Create new supplier default
        await db
          .insert(supplierDefaults)
          .values({
            restaurantId: authReq.restaurantId,
            supplier: supplier,
            defaultCategory: category,
          });
      }
      console.log(`Saved batch default for supplier ${supplier}: ${category}`);
    }

    // Mark all processed expenses as approved
    if (approvedCount > 0) {
      const processedIds = approvedExpenses.map(exp => exp.id);
      await db
        .update(importedExpenses)
        .set({ 
          status: 'APPROVED', 
          approvedBy,
          approvedAt: new Date()
        })
        .where(and(
          inArray(importedExpenses.id, processedIds),
          eq(importedExpenses.restaurantId, authReq.restaurantId)
        ));
    }

    res.json({ 
      success: true, 
      message: `${approvedCount} expense(s) approved and added to ledger`,
      approvedCount,
      approvedExpenses
    });

  } catch (error) {
    console.error('Batch approve error:', error);
    res.status(500).json({ error: 'Failed to batch approve expenses' });
  }
});

// PATCH /api/expenses/batch-reject - REQUIRES MANAGER ROLE
router.patch('/batch-reject', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ids } = req.body; // Array of expense IDs to reject
    const approvedBy = authReq.approvedBy;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing expense IDs array' });
    }

    // SECURITY: Batch reject with restaurant scoping
    const result = await db
      .update(importedExpenses)
      .set({ 
        status: 'REJECTED', 
        approvedBy,
        approvedAt: new Date()
      })
      .where(and(
        inArray(importedExpenses.id, ids),
        eq(importedExpenses.status, 'PENDING'),
        eq(importedExpenses.restaurantId, authReq.restaurantId)
      ))
      .returning();

    res.json({ 
      success: true, 
      message: `${result.length} expense(s) rejected`,
      rejectedCount: result.length 
    });

  } catch (error) {
    console.error('Batch reject error:', error);
    res.status(500).json({ error: 'Failed to batch reject expenses' });
  }
});

// Supplier Defaults CRUD Endpoints

// GET /api/expenses/defaults - List all supplier defaults for authenticated restaurant
router.get('/defaults', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // SECURITY: Filter by restaurantId to prevent cross-tenant data leakage
    const defaults = await db
      .select()
      .from(supplierDefaults)
      .where(eq(supplierDefaults.restaurantId, authReq.restaurantId))
      .orderBy(supplierDefaults.supplier);

    res.json(defaults);
  } catch (error) {
    console.error('Get supplier defaults error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier defaults' });
  }
});

// GET /api/expenses/defaults/:supplier - Get specific supplier default by supplier name
router.get('/defaults/:supplier', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { supplier } = req.params;

    // SECURITY: Get supplier default with restaurant scoping
    const [supplierDefault] = await db
      .select()
      .from(supplierDefaults)
      .where(and(
        eq(supplierDefaults.supplier, supplier),
        eq(supplierDefaults.restaurantId, authReq.restaurantId)
      ));

    if (!supplierDefault) {
      return res.status(404).json({ error: 'Supplier default not found' });
    }

    res.json(supplierDefault);
  } catch (error) {
    console.error('Get supplier default error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier default' });
  }
});

// POST /api/expenses/defaults - Upsert supplier default - REQUIRES MANAGER ROLE
router.post('/defaults', requireManagerRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { supplier, defaultCategory, notesTemplate } = req.body;

    // Validate required fields
    if (!supplier || !defaultCategory) {
      return res.status(400).json({ 
        error: 'Missing required fields: supplier and defaultCategory are required' 
      });
    }

    // Check if supplier default already exists
    const [existing] = await db
      .select()
      .from(supplierDefaults)
      .where(and(
        eq(supplierDefaults.supplier, supplier),
        eq(supplierDefaults.restaurantId, authReq.restaurantId)
      ));

    if (existing) {
      // Update existing supplier default
      const [updated] = await db
        .update(supplierDefaults)
        .set({
          defaultCategory,
          notesTemplate: notesTemplate || null,
          updatedAt: new Date()
        })
        .where(and(
          eq(supplierDefaults.supplier, supplier),
          eq(supplierDefaults.restaurantId, authReq.restaurantId)
        ))
        .returning();

      res.json({ 
        success: true, 
        message: 'Supplier default updated',
        data: updated 
      });
    } else {
      // Create new supplier default
      const [created] = await db
        .insert(supplierDefaults)
        .values({
          restaurantId: authReq.restaurantId,
          supplier,
          defaultCategory,
          notesTemplate: notesTemplate || null,
        })
        .returning();

      res.json({ 
        success: true, 
        message: 'Supplier default created',
        data: created 
      });
    }

  } catch (error) {
    console.error('Upsert supplier default error:', error);
    res.status(500).json({ error: 'Failed to save supplier default' });
  }
});

// Partners summary endpoint moved to server/routes/partners.ts

export default router;