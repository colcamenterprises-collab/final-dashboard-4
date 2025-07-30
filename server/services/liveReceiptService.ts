import axios from 'axios';

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
  private accessToken: string;
  private baseUrl: string = 'https://api.loyverse.com/v1.0';

  private constructor() {
    this.accessToken = process.env.LOYVERSE_ACCESS_TOKEN || 'c1ba07b4dc304101b8dbff63107a3d87';
  }

  static getInstance(): LiveReceiptService {
    if (!LiveReceiptService.instance) {
      LiveReceiptService.instance = new LiveReceiptService();
    }
    return LiveReceiptService.instance;
  }

  async fetchReceiptsForPeriod(startTime: string, endTime: string): Promise<ReceiptSummary> {
    console.log(`🔍 Fetching live receipts from Loyverse API: ${startTime} to ${endTime}`);
    
    try {
      const allReceipts: LoyverseReceipt[] = [];
      let cursor: string | undefined;
      let pagesProcessed = 0;
      let totalFetched = 0;

      do {
        const params = new URLSearchParams({
          start_time: startTime,
          end_time: endTime,
          limit: '250'
        });

        if (cursor) {
          params.append('cursor', cursor);
        }

        const response = await axios.get(`${this.baseUrl}/receipts?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        if (response.status !== 200) {
          throw new Error(`Loyverse API returned status ${response.status}`);
        }

        const data = response.data;
        const receipts = data.receipts || [];
        
        // Transform receipts to expected format
        const transformedReceipts = receipts.map((receipt: any) => ({
          receipt_number: receipt.receipt_number,
          created_at: receipt.created_at,
          total_money: receipt.total_money,
          payment_type_name: receipt.payments?.[0]?.payment_type?.name || 'Unknown',
          customer_name: receipt.customer?.name || 'Walk-in',
          receipt_items: receipt.line_items || [],
          refunded_by: receipt.refunded_by,
          source: receipt.source || 'Smash Brothers Burgers'
        }));

        allReceipts.push(...transformedReceipts);
        cursor = data.cursor;
        pagesProcessed++;
        totalFetched += receipts.length;

        console.log(`📄 Page ${pagesProcessed}: Fetched ${receipts.length} receipts`);

      } while (cursor);

      console.log(`✅ Total receipts fetched: ${totalFetched} across ${pagesProcessed} pages`);

      return {
        receipts: allReceipts,
        metadata: {
          totalFetched,
          validReceipts: allReceipts.length,
          pagesProcessed
        }
      };

    } catch (error) {
      console.error('❌ Error fetching receipts from Loyverse API:', error);
      throw new Error(`Failed to fetch live receipts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}