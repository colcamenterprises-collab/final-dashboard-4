// Enhanced Loyverse API compatibility facade.
// Live external requests are retired; SBB POS is the live source of truth.

const retired = 'Loyverse live API is retired. SBB POS is the live source of truth.';

export class EnhancedLoyverseAPI {
  constructor(_accessToken?: string, _baseURL?: string, _retryConfig?: any, _rateLimitConfig?: any) {}

  async fetchAllReceiptsForShift(_shiftDate: Date): Promise<any> {
    throw new Error(retired);
  }

  async testConnection(): Promise<any> {
    return { success: false, message: retired, diagnostics: { disabled: true } };
  }

  async getHealthStatus(): Promise<any> {
    return { isHealthy: false, disabled: true, message: retired };
  }
}
