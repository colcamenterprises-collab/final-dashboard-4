// Loyverse live orchestration is retired.
// Historical Loyverse database records remain available for archive/import work only.

type ProcessingResult = {
  success: boolean;
  receiptsProcessed: number;
  shiftsProcessed: number;
  analysisGenerated: boolean;
  errors: string[];
  processingTime: number;
  metadata: {
    validationStats: any;
    shiftDate: string;
    totalSales: number;
    totalOrders: number;
  };
};

const disabledMessage = 'Loyverse live ingestion is retired. SBB POS is the live source of truth.';

export class LoyverseDataOrchestrator {
  private static instance: LoyverseDataOrchestrator;

  static getInstance(): LoyverseDataOrchestrator {
    if (!this.instance) this.instance = new LoyverseDataOrchestrator();
    return this.instance;
  }

  static async processReceipt(_receipt: any) {
    return { disabled: true, source: 'sbb_pos_core' };
  }

  async fetchReceiptsForPeriod(_startTime: string, _endTime: string) {
    throw new Error(disabledMessage);
  }

  async processShiftData(shiftDate: Date): Promise<ProcessingResult> {
    return {
      success: false,
      receiptsProcessed: 0,
      shiftsProcessed: 0,
      analysisGenerated: false,
      errors: [disabledMessage],
      processingTime: 0,
      metadata: {
        validationStats: {},
        shiftDate: shiftDate.toISOString(),
        totalSales: 0,
        totalOrders: 0,
      },
    };
  }

  async processCurrentShift(): Promise<ProcessingResult> {
    return this.processShiftData(new Date());
  }

  setupAutomatedScheduling(): void {
    console.log('[Loyverse] Automated orchestrator disabled — SBB POS is source of truth');
  }

  stopAutomatedScheduling(): void {}

  getProcessingStatus() {
    return {
      isProcessing: false,
      lastProcessingTime: null,
      isScheduled: false,
      nextScheduledRun: null,
      validationStats: {},
      disabled: true,
    };
  }

  async testConnection() {
    return { success: false, message: disabledMessage, diagnostics: { disabled: true, source: 'sbb_pos_core' } };
  }

  async performManualSync() {
    return { success: false, message: disabledMessage };
  }

  async getProcessingHistory(_limit: number = 10): Promise<any[]> {
    return [];
  }
}

export default LoyverseDataOrchestrator;
