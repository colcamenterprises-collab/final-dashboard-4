import { prisma } from "../../../lib/prisma";
const THB = (n:number)=>Number.isFinite(Number(n)) ? Number(n) : 0;

// tolerances
const TOL = {
  salesVariance: 40,     // THB
  bankCash: 0,           // THB
  bankQr: 0,             // THB
  rolls: 3,              // pcs
  meat: 200              // grams
};

export async function analyzeShift(batchId: string) {
  const batch = await prisma.posBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("POS batch not found");

  // POS side
  const shift = await prisma.posShiftReport.findUnique({ where: { batchId } });
  const pays  = await prisma.posPaymentSummary.findMany({ where: { batchId } });
  const payMap = Object.fromEntries(pays.map(p => [p.method, Number(p.amount)]));

  // Staff side: pick most recent DailySales inside window; fallback latest
  const staff = await prisma.dailySales.findFirst({
    where: batch.shiftStart && batch.shiftEnd ? {
      createdAt: { gte: batch.shiftStart!, lte: batch.shiftEnd! }
    } : {},
    orderBy: { createdAt: "desc" }
  });

  const stock = staff
    ? await prisma.dailyStock.findFirst({ where: { salesId: staff.id }, orderBy: { createdAt: "desc" }})
    : null;

  const staffData = {
    salesId: staff?.id || null,
    totalSales: THB(staff?.totalSales || 0),
    totalExpenses: THB(staff?.totalExpenses || 0),
    bankCash: THB(staff?.cashBanked || 0),
    bankQr: THB(staff?.qrTransfer || 0),
    closingCash: THB(staff?.closingCash || 0),
    rolls: stock?.bunsCount ?? null,
    meat: stock?.meatWeightG ?? null
  };

  const posData = {
    netSales: THB(shift?.netSales || 0),
    receiptCount: shift?.receiptCount || 0,
    cashSales: THB(shift?.cashSales ?? (payMap["Cash"] ?? 0)),
    qrSales: THB(shift?.qrSales ?? (payMap["QR"] ?? payMap["Card"] ?? 0)),
    methodBreakdown: payMap
  };

  const variances = {
    totalSales: staffData.totalSales - posData.netSales,
    bankCash: staffData.bankCash - posData.cashSales,
    bankQr: staffData.bankQr - posData.qrSales
  };

  const flags:string[] = [];
  if (Math.abs(variances.totalSales) > TOL.salesVariance)
    flags.push(`Total Sales variance: staff ${staffData.totalSales} vs POS ${posData.netSales}`);
  if (Math.abs(variances.bankCash) > TOL.bankCash)
    flags.push(`Banked Cash mismatch: staff ${staffData.bankCash} vs POS Cash ${posData.cashSales}`);
  if (Math.abs(variances.bankQr) > TOL.bankQr)
    flags.push(`Banked QR mismatch: staff ${staffData.bankQr} vs POS QR/Card ${posData.qrSales}`);

  return {
    batch: {
      id: batch.id,
      window: { start: batch.shiftStart?.toISOString(), end: batch.shiftEnd?.toISOString() }
    },
    staff: staffData,
    pos: posData,
    variances,
    flags
  };
}