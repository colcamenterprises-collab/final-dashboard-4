import { prisma } from "../../../lib/prisma";

const THB = (n:number)=>Number.isFinite(Number(n)) ? Number(n) : 0;
const TOL = { salesVariance: 40, bankCash: 0, bankQr: 0, rolls: 3, meat: 200 };

export async function analyzeShift(batchId: string) {
  const batch = await prisma.posBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("POS batch not found");

  const shift = await prisma.posShiftReport.findUnique({ where: { batchId } });
  const pays  = await prisma.posPaymentSummary.findMany({ where: { batchId } });
  const payMap = Object.fromEntries(pays.map(p => [p.method, Number(p.amount)]));

  // robust receipt count
  const receiptCount = await prisma.posReceipt.count({ where: { batchId } });

  // Staff forms inside window (if available)
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

  // Compose POS with fallbacks:
  // prefer shift.netSales; else sum of payments; else sum of items net
  const itemsNet = await prisma.posSalesItem.aggregate({
    where: { batchId },
    _sum: { net: true }
  });

  const posNet =
    THB(Number(shift?.netSales || 0)) ||
    THB(Object.values(payMap).reduce((a:any,b:any)=>a+Number(b||0),0)) ||
    THB(Number(itemsNet._sum.net || 0));

  const posCash =
    THB(Number(shift?.cashSales || 0)) ||
    THB(Number(payMap["Cash"] || payMap["CASH"] || 0));

  const posQr =
    THB(Number(shift?.qrSales || 0)) ||
    THB(Number(payMap["QR"] || payMap["Card"] || payMap["CARD"] || 0));

  const posData = {
    netSales: posNet,
    receiptCount,
    cashSales: posCash,
    qrSales: posQr,
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
    batch: { id: batch.id, window: { start: batch.shiftStart?.toISOString(), end: batch.shiftEnd?.toISOString() } },
    staff: staffData,
    pos: posData,
    variances,
    flags
  };
}