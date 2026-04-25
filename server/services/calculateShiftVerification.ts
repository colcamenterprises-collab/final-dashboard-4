/**
 * calculateShiftVerification
 * Anti-Manipulation Patch: Shift verification is computed server-side from POS data,
 * not from staff-entered sales figures.
 *
 * This service will compare POS-sourced sales against staff-declared cash positions
 * to detect discrepancies without allowing staff to influence the sales totals.
 *
 * STATUS: Stub — POS integration to be wired in a future patch.
 */

export interface ShiftVerificationInput {
  salesId: string;
  shiftDate: string;
  startingCash: number;
  closingCash: number;
  cashBanked: number;
  qrTransfer: number;
  grabReceiptCount: number;
  cashReceiptCount: number;
  qrReceiptCount: number;
  directReceiptCount?: number;
}

export interface ShiftVerificationResult {
  verified: boolean;
  posTotal: number | null;
  staffDeclaredClosingCash: number;
  expectedClosingCash: number | null;
  cashVariance: number | null;
  receiptCountTotal: number;
  notes: string;
}

export async function calculateShiftVerification(
  input: ShiftVerificationInput
): Promise<ShiftVerificationResult> {
  const receiptCountTotal =
    (input.grabReceiptCount ?? 0) +
    (input.cashReceiptCount ?? 0) +
    (input.qrReceiptCount ?? 0) +
    (input.directReceiptCount ?? 0);

  return {
    verified: false,
    posTotal: null,
    staffDeclaredClosingCash: input.closingCash,
    expectedClosingCash: null,
    cashVariance: null,
    receiptCountTotal,
    notes: "POS-sourced verification not yet wired. Stub active.",
  };
}
