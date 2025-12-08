// PATCH 6 — AI INSIGHTS ENGINE
// Deterministic rules-based insights (no external APIs)

export function generateAIInsights(report: any) {
  const v = report.variances || {};
  const notes: string[] = [];

  // Severity
  if (v.level === "RED") {
    notes.push("Critical discrepancies detected. Immediate manager review required.");
  }

  // Cash issues
  if (v.cashVariance && Math.abs(v.cashVariance) > 100) {
    notes.push("Significant cash variance suggests counting or handling error.");
  }

  // QR issues
  if (v.qrVariance && Math.abs(v.qrVariance) > 20) {
    notes.push("QR payment mismatch detected. Verify QR receipts and settlement.");
  }

  // Settlement issues
  if (v.qrSettlementVariance && Math.abs(v.qrSettlementVariance) > 20) {
    notes.push("QR settlement does not match POS totals. Confirm SCB settlement.");
  }

  // Grab issues
  if (v.grabVariance && Math.abs(v.grabVariance) > 20) {
    notes.push("GrabFood sales mismatch. Check Grab transactions vs POS.");
  }

  // Total sales variance
  if (v.totalSalesVariance && Math.abs(v.totalSalesVariance) > 50) {
    notes.push("Total sales discrepancy exceeds tolerance. Investigate missing receipts.");
  }

  // POS issues
  if (v.errors && v.errors.includes("Missing POS shift report")) {
    notes.push("POS report missing — cannot validate sales or variance.");
  }

  // Sales/Stock issues
  if (v.errors && v.errors.includes("Missing Daily Sales V2")) {
    notes.push("Daily Sales submission missing — staff did not submit shift report.");
  }

  if (notes.length === 0) {
    notes.push("No significant issues detected for this shift.");
  }

  return notes.join("\n");
}
