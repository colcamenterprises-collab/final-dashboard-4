// Legacy Loyverse receipt service retained only for compatibility.
// Live API ingestion is retired; historical database records are untouched.

export class LoyverseReceiptService {
  async fetchAndStoreReceipts(): Promise<{ success: boolean; receiptsProcessed: number }> {
    console.log('[Loyverse] fetchAndStoreReceipts disabled — SBB POS is source of truth');
    return { success: false, receiptsProcessed: 0 };
  }

  async fetchAndStoreShiftReports(): Promise<{ success: boolean; reportsProcessed: number }> {
    console.log('[Loyverse] fetchAndStoreShiftReports disabled — SBB POS is source of truth');
    return { success: false, reportsProcessed: 0 };
  }
}

export const loyverseReceiptService = new LoyverseReceiptService();
