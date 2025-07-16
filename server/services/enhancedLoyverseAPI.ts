import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DateTime } from 'luxon';
import winston from 'winston';
import { LoyverseDataValidator, ValidatedLoyverseReceipt, ValidatedLoyverseShift } from './loyverseDataValidator';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/loyverse-api.log' })
  ]
});

interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
}

// Enhanced Loyverse API client with comprehensive error handling
export class EnhancedLoyverseAPI {
  private client: AxiosInstance;
  private validator: LoyverseDataValidator;
  private retryConfig: RetryConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private lastRequestTime = 0;
  private requestCount = 0;
  private resetTime = Date.now();

  constructor(
    accessToken: string,
    baseURL: string = 'https://api.loyverse.com/v1.0',
    retryConfig: RetryConfig = { maxRetries: 3, retryDelayMs: 1000, exponentialBackoff: true },
    rateLimitConfig: RateLimitConfig = { requestsPerMinute: 60, burstLimit: 10 }
  ) {
    this.validator = LoyverseDataValidator.getInstance();
    this.retryConfig = retryConfig;
    this.rateLimitConfig = rateLimitConfig;

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500 // Retry on 5xx errors
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.enforceRateLimit();
      logger.info(`Making request to: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Response received: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`Request failed: ${error.config?.url}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  // Rate limiting implementation
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.resetTime >= 60000) {
      this.requestCount = 0;
      this.resetTime = now;
    }

    // Check if we're over the rate limit
    if (this.requestCount >= this.rateLimitConfig.requestsPerMinute) {
      const waitTime = 60000 - (now - this.resetTime);
      logger.warn(`Rate limit reached. Waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.resetTime = Date.now();
    }

    // Enforce minimum time between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.rateLimitConfig.requestsPerMinute;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  // Enhanced request method with retry logic
  private async makeRequest<T>(
    config: AxiosRequestConfig,
    attempt: number = 1
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await this.client.request<T>(config);
      
      // Check for API-specific error responses
      if (response.data && typeof response.data === 'object' && 'error' in response.data) {
        throw new Error(`API Error: ${(response.data as any).error}`);
      }

      return response;
    } catch (error: any) {
      // Handle different types of errors
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please check your access token.');
      }
      
      if (error.response?.status === 403) {
        throw new Error('Access forbidden. Please check your permissions.');
      }
      
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryConfig.retryDelayMs;
        logger.warn(`Rate limited. Retrying after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(config, attempt);
      }

      // Retry on network errors and 5xx errors
      if (attempt < this.retryConfig.maxRetries && 
          (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || 
           (error.response?.status && error.response.status >= 500))) {
        
        const delay = this.retryConfig.exponentialBackoff 
          ? this.retryConfig.retryDelayMs * Math.pow(2, attempt - 1)
          : this.retryConfig.retryDelayMs;
        
        logger.warn(`Request failed (attempt ${attempt}/${this.retryConfig.maxRetries}). Retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(config, attempt + 1);
      }

      throw error;
    }
  }

  // Enhanced receipts fetching with comprehensive validation
  async fetchReceipts(params: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    cursor?: string;
    store_id?: string;
  } = {}): Promise<{
    receipts: ValidatedLoyverseReceipt[];
    cursor?: string;
    metadata: {
      totalFetched: number;
      validReceipts: number;
      invalidReceipts: number;
      fetchTime: string;
    };
  }> {
    const startTime = Date.now();
    
    try {
      // Set default parameters
      const queryParams = new URLSearchParams();
      if (params.start_time) queryParams.append('start_time', params.start_time);
      if (params.end_time) queryParams.append('end_time', params.end_time);
      if (params.limit) queryParams.append('limit', Math.min(params.limit, 250).toString());
      if (params.cursor) queryParams.append('cursor', params.cursor);
      if (params.store_id) queryParams.append('store_id', params.store_id);

      const response = await this.makeRequest<{
        receipts: any[];
        cursor?: string;
      }>({
        method: 'GET',
        url: `/receipts?${queryParams.toString()}`
      });

      // Validate API response structure
      if (!this.validator.validateAPIResponse(response.data, 'receipts')) {
        throw new Error('Invalid API response structure for receipts');
      }

      const rawReceipts = response.data.receipts || [];
      const validReceipts: ValidatedLoyverseReceipt[] = [];
      let invalidCount = 0;

      // Validate each receipt
      for (const rawReceipt of rawReceipts) {
        const validatedReceipt = this.validator.validateReceipt(rawReceipt);
        if (validatedReceipt) {
          validReceipts.push(validatedReceipt);
        } else {
          invalidCount++;
        }
      }

      const endTime = Date.now();
      const metadata = {
        totalFetched: rawReceipts.length,
        validReceipts: validReceipts.length,
        invalidReceipts: invalidCount,
        fetchTime: DateTime.fromMillis(endTime - startTime).toFormat('ss.SSS') + 's'
      };

      logger.info(`Fetched receipts: ${metadata.totalFetched} total, ${metadata.validReceipts} valid, ${metadata.invalidReceipts} invalid`);

      return {
        receipts: validReceipts,
        cursor: response.data.cursor,
        metadata
      };
    } catch (error) {
      logger.error('Failed to fetch receipts:', error);
      throw error;
    }
  }

  // Enhanced shifts fetching with comprehensive validation
  async fetchShifts(params: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    cursor?: string;
    store_id?: string;
  } = {}): Promise<{
    shifts: ValidatedLoyverseShift[];
    cursor?: string;
    metadata: {
      totalFetched: number;
      validShifts: number;
      invalidShifts: number;
      fetchTime: string;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const queryParams = new URLSearchParams();
      if (params.start_time) queryParams.append('start_time', params.start_time);
      if (params.end_time) queryParams.append('end_time', params.end_time);
      if (params.limit) queryParams.append('limit', Math.min(params.limit, 250).toString());
      if (params.cursor) queryParams.append('cursor', params.cursor);
      if (params.store_id) queryParams.append('store_id', params.store_id);

      const response = await this.makeRequest<{
        shifts: any[];
        cursor?: string;
      }>({
        method: 'GET',
        url: `/shifts?${queryParams.toString()}`
      });

      // Validate API response structure
      if (!this.validator.validateAPIResponse(response.data, 'shifts')) {
        throw new Error('Invalid API response structure for shifts');
      }

      const rawShifts = response.data.shifts || [];
      const validShifts: ValidatedLoyverseShift[] = [];
      let invalidCount = 0;

      // Validate each shift
      for (const rawShift of rawShifts) {
        const validatedShift = this.validator.validateShift(rawShift);
        if (validatedShift) {
          validShifts.push(validatedShift);
        } else {
          invalidCount++;
        }
      }

      const endTime = Date.now();
      const metadata = {
        totalFetched: rawShifts.length,
        validShifts: validShifts.length,
        invalidShifts: invalidCount,
        fetchTime: DateTime.fromMillis(endTime - startTime).toFormat('ss.SSS') + 's'
      };

      logger.info(`Fetched shifts: ${metadata.totalFetched} total, ${metadata.validShifts} valid, ${metadata.invalidShifts} invalid`);

      return {
        shifts: validShifts,
        cursor: response.data.cursor,
        metadata
      };
    } catch (error) {
      logger.error('Failed to fetch shifts:', error);
      throw error;
    }
  }

  // Fetch all receipts with pagination (Bangkok timezone aware)
  async fetchAllReceiptsForShift(shiftDate: Date): Promise<{
    receipts: ValidatedLoyverseReceipt[];
    metadata: {
      totalFetched: number;
      validReceipts: number;
      invalidReceipts: number;
      pagesProcessed: number;
      fetchTime: string;
    };
  }> {
    const startTime = Date.now();
    
    // Convert Bangkok shift times to UTC for API calls
    const bangkokShiftStart = DateTime.fromJSDate(shiftDate).setZone('Asia/Bangkok').set({ hour: 17, minute: 0, second: 0 });
    const bangkokShiftEnd = bangkokShiftStart.plus({ hours: 10 }); // 10-hour shift (5pm-3am)
    
    const utcStart = bangkokShiftStart.toUTC().toISO();
    const utcEnd = bangkokShiftEnd.toUTC().toISO();

    logger.info(`Fetching all receipts for shift: ${bangkokShiftStart.toFormat('yyyy-MM-dd HH:mm')} to ${bangkokShiftEnd.toFormat('yyyy-MM-dd HH:mm')} Bangkok time`);

    const allReceipts: ValidatedLoyverseReceipt[] = [];
    let cursor: string | undefined;
    let pagesProcessed = 0;
    let totalFetched = 0;
    let totalInvalid = 0;

    do {
      const result = await this.fetchReceipts({
        start_time: utcStart,
        end_time: utcEnd,
        limit: 250,
        cursor
      });

      allReceipts.push(...result.receipts);
      cursor = result.cursor;
      pagesProcessed++;
      totalFetched += result.metadata.totalFetched;
      totalInvalid += result.metadata.invalidReceipts;

      // Small delay between pagination requests
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (cursor);

    const endTime = Date.now();
    const metadata = {
      totalFetched,
      validReceipts: allReceipts.length,
      invalidReceipts: totalInvalid,
      pagesProcessed,
      fetchTime: DateTime.fromMillis(endTime - startTime).toFormat('ss.SSS') + 's'
    };

    logger.info(`Completed shift receipt fetch: ${metadata.validReceipts} valid receipts from ${metadata.pagesProcessed} pages`);

    return {
      receipts: allReceipts,
      metadata
    };
  }

  // Get API health status
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    responseTime: number;
    timestamp: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest({
        method: 'GET',
        url: '/stores',
        timeout: 5000
      });

      return {
        isHealthy: true,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get validation statistics
  getValidationStats() {
    return this.validator.getValidationStats();
  }

  // Test connection with comprehensive diagnostics
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    diagnostics: {
      apiHealth: any;
      validationStats: any;
      sampleDataTest: {
        success: boolean;
        receiptsCount: number;
        error?: string;
      };
    };
  }> {
    try {
      // Test basic API health
      const healthStatus = await this.getHealthStatus();
      
      // Test fetching a small sample of data
      let sampleDataTest = { success: false, receiptsCount: 0, error: undefined };
      
      try {
        const sampleResult = await this.fetchReceipts({ limit: 5 });
        sampleDataTest = {
          success: true,
          receiptsCount: sampleResult.receipts.length
        };
      } catch (error) {
        sampleDataTest = {
          success: false,
          receiptsCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      const diagnostics = {
        apiHealth: healthStatus,
        validationStats: this.getValidationStats(),
        sampleDataTest
      };

      return {
        success: healthStatus.isHealthy && sampleDataTest.success,
        message: healthStatus.isHealthy && sampleDataTest.success 
          ? 'Loyverse API connection successful'
          : 'Loyverse API connection issues detected',
        diagnostics
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        diagnostics: {
          apiHealth: { isHealthy: false, responseTime: 0, timestamp: new Date().toISOString() },
          validationStats: this.getValidationStats(),
          sampleDataTest: { success: false, receiptsCount: 0, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }
}

export default EnhancedLoyverseAPI;