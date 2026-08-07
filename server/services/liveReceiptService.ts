interface LoyverseReceipt {
  receipt_number: string;
  created_at: string;
  total_money: number;
  payment_type_name?: string;
  customer_name?: string;
  receipt_items?: any[];
  refunded_by?: string;
  source?: string;
}

interface ReceiptSummary {
  receipts: LoyverseReceipt[];
  metadata: {
    totalFetched: number;
    validReceipts: number;
    pagesProcessed: number;
  };
}

export class LiveReceiptService {
  private static instance: LiveReceiptService;

  static getInstance(): LiveReceiptService {
    if (!LiveReceiptService.instance) LiveReceiptService.instance = new LiveReceiptService();
    return LiveReceiptService.instance;
  }

  async fetchReceiptsForPeriod(_startTime: string, _endTime: string): Promise<ReceiptSummary> {
    throw new Error('Loyverse live receipt API is retired. Use the SBB POS receipt ledger.');
  }
}
