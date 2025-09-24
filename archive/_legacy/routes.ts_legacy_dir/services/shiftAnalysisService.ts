import { db } from '../db';
import { 
  posBatch, 
  posShiftReport, 
  posPaymentSummary, 
  dailySalesV2 
} from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export type ShiftAnalysis = {
  batchId: string;
  window: { start?: string; end?: string };
  staffForm: {
    salesId?: string;
    totalSales: number;
    totalExpenses: number;
    bankCash: number;
    bankQr: number;
    closingCash: number;
  };
  pos: {
    netSales: number;
    receiptCount: number;
    payments: Record<string, number>;
    cashSales: number;
    qrSales: number;
  };
  variances: {
    totalSalesDiff: number;
    bankCashVsCashSales: number;
    bankQrVsQrSales: number;
  };
  flags: string[];
};

const ABS_TOL_SALES = 50;   // THB tolerance
const ABS_TOL_BANK = 50;    // THB tolerance

export async function analyzeShift(batchId: string): Promise<ShiftAnalysis> {
  console.log(`[Shift Analysis] Starting analysis for batch ${batchId}`);

  // Get batch info
  const [batch] = await db
    .select()
    .from(posBatch)
    .where(eq(posBatch.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  // Get POS shift report
  const [shift] = await db
    .select()
    .from(posShiftReport)
    .where(eq(posShiftReport.batchId, batchId))
    .limit(1);

  // Get POS payment summary
  const payments = await db
    .select()
    .from(posPaymentSummary)
    .where(eq(posPaymentSummary.batchId, batchId));

  const payMap = payments.reduce((acc, p) => {
    acc[p.method] = parseFloat(p.amount);
    return acc;
  }, {} as Record<string, number>);

  // Get staff form: pick latest DailySales inside window (fallback to latest overall)
  let staff;
  if (batch.shiftStart && batch.shiftEnd) {
    // Try to find within shift window
    [staff] = await db
      .select()
      .from(dailySalesV2)
      .where(
        and(
          gte(dailySalesV2.createdAt, batch.shiftStart),
          lte(dailySalesV2.createdAt, batch.shiftEnd)
        )
      )
      .orderBy(dailySalesV2.createdAt)
      .limit(1);
  }

  // Fallback to latest overall if no staff form found in window
  if (!staff) {
    [staff] = await db
      .select()
      .from(dailySalesV2)
      .orderBy(dailySalesV2.createdAt)
      .limit(1);
  }

  // Helper function to safely convert decimal strings to numbers
  const safeNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    return parseFloat(String(val)) || 0;
  };

  const staffData = {
    salesId: staff?.id,
    totalSales: safeNum(staff?.totalSales),
    totalExpenses: safeNum(staff?.totalExpenses),
    bankCash: safeNum(staff?.cashBanked),
    bankQr: safeNum(staff?.qrSales),
    closingCash: safeNum(staff?.endingCash),
  };

  const posData = {
    netSales: safeNum(shift?.netSales),
    receiptCount: shift?.receiptCount || 0,
    payments: payMap,
    cashSales: safeNum(shift?.cashSales) || payMap["Cash"] || 0,
    qrSales: safeNum(shift?.qrSales) || payMap["QR"] || payMap["Card"] || 0,
  };

  const variances = {
    totalSalesDiff: staffData.totalSales - posData.netSales,
    bankCashVsCashSales: staffData.bankCash - posData.cashSales,
    bankQrVsQrSales: staffData.bankQr - posData.qrSales,
  };

  const flags: string[] = [];
  if (Math.abs(variances.totalSalesDiff) > ABS_TOL_SALES) {
    flags.push(`Total Sales mismatch: ฿${staffData.totalSales} vs ฿${posData.netSales}`);
  }
  if (Math.abs(variances.bankCashVsCashSales) > ABS_TOL_BANK) {
    flags.push(`Banked Cash mismatch: ฿${staffData.bankCash} vs POS Cash ฿${posData.cashSales}`);
  }
  if (Math.abs(variances.bankQrVsQrSales) > ABS_TOL_BANK) {
    flags.push(`Banked QR mismatch: ฿${staffData.bankQr} vs POS QR ฿${posData.qrSales}`);
  }

  console.log(`[Shift Analysis] Found ${flags.length} discrepancies for batch ${batchId}`);

  return {
    batchId,
    window: { 
      start: batch.shiftStart?.toISOString(), 
      end: batch.shiftEnd?.toISOString() 
    },
    staffForm: staffData,
    pos: posData,
    variances,
    flags
  };
}