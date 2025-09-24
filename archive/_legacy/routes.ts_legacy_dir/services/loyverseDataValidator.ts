import { z } from 'zod';
import winston from 'winston';

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
    new winston.transports.File({ filename: 'logs/loyverse-data-validation.log' })
  ]
});

// Enhanced Zod schemas for strict Loyverse data validation
export const loyverseReceiptSchema = z.object({
  id: z.string().min(1, "Receipt ID is required"),
  receipt_number: z.string().min(1, "Receipt number is required"),
  receipt_date: z.string().datetime("Invalid receipt date format"),
  receipt_type: z.enum(['SALE', 'REFUND']).default('SALE'),
  total_money: z.number().min(0, "Total amount must be positive"),
  total_tax: z.number().min(0, "Tax amount must be positive").optional(),
  total_discount: z.number().min(0, "Discount amount must be positive").optional(),
  customer_id: z.string().optional(),
  employee_id: z.string().optional(),
  store_id: z.string().min(1, "Store ID is required"),
  pos_device_id: z.string().optional(),
  source: z.string().optional(),
  dining_option: z.string().optional(),
  line_items: z.array(z.object({
    id: z.string(),
    item_id: z.string(),
    variant_id: z.string().optional(),
    item_name: z.string().min(1, "Item name is required"),
    quantity: z.number().min(0, "Quantity must be positive"),
    cost: z.number().min(0, "Cost must be positive"),
    price: z.number().min(0, "Price must be positive"),
    line_total: z.number().min(0, "Line total must be positive"),
    line_tax: z.number().min(0, "Line tax must be positive").optional(),
    modifiers_cost: z.number().min(0, "Modifiers cost must be positive").optional(),
    modifiers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      cost: z.number().min(0, "Modifier cost must be positive")
    })).optional().default([])
  })),
  payments: z.array(z.object({
    id: z.string(),
    payment_type_id: z.string(),
    amount: z.number().min(0, "Payment amount must be positive")
  })),
  created_at: z.string().datetime("Invalid created_at format"),
  updated_at: z.string().datetime("Invalid updated_at format")
});

export const loyverseShiftSchema = z.object({
  id: z.string().min(1, "Shift ID is required"),
  store_id: z.string().min(1, "Store ID is required"),
  employee_id: z.string().min(1, "Employee ID is required"),
  opened_at: z.string().datetime("Invalid opened_at format"),
  closed_at: z.string().datetime("Invalid closed_at format").optional(),
  opening_cash: z.number().min(0, "Opening cash must be positive").optional(),
  closing_cash: z.number().min(0, "Closing cash must be positive").optional(),
  expected_cash: z.number().min(0, "Expected cash must be positive").optional(),
  cash_difference: z.number().optional(),
  total_sales: z.number().min(0, "Total sales must be positive").optional(),
  total_receipts: z.number().min(0, "Total receipts must be positive").optional(),
  created_at: z.string().datetime("Invalid created_at format"),
  updated_at: z.string().datetime("Invalid updated_at format")
});

export type ValidatedLoyverseReceipt = z.infer<typeof loyverseReceiptSchema>;
export type ValidatedLoyverseShift = z.infer<typeof loyverseShiftSchema>;

// Data validator class with comprehensive error handling
export class LoyverseDataValidator {
  private static instance: LoyverseDataValidator;
  private validationStats = {
    receiptsValidated: 0,
    receiptsRejected: 0,
    shiftsValidated: 0,
    shiftsRejected: 0,
    lastValidationRun: new Date()
  };

  private constructor() {}

  static getInstance(): LoyverseDataValidator {
    if (!LoyverseDataValidator.instance) {
      LoyverseDataValidator.instance = new LoyverseDataValidator();
    }
    return LoyverseDataValidator.instance;
  }

  // Validate receipt data with detailed error logging
  validateReceipt(data: any): ValidatedLoyverseReceipt | null {
    try {
      const validatedData = loyverseReceiptSchema.parse(data);
      this.validationStats.receiptsValidated++;
      
      // Additional business logic validation
      if (validatedData.total_money === 0 && validatedData.receipt_type === 'SALE') {
        logger.warn(`Zero-value sale receipt detected: ${validatedData.receipt_number}`);
      }
      
      if (validatedData.line_items.length === 0) {
        logger.warn(`Receipt with no line items: ${validatedData.receipt_number}`);
      }

      return validatedData;
    } catch (error) {
      this.validationStats.receiptsRejected++;
      logger.error(`Receipt validation failed for ${data?.receipt_number || 'unknown'}:`, {
        error: error instanceof z.ZodError ? error.errors : error,
        rawData: data
      });
      return null;
    }
  }

  // Validate shift data with detailed error logging
  validateShift(data: any): ValidatedLoyverseShift | null {
    try {
      const validatedData = loyverseShiftSchema.parse(data);
      this.validationStats.shiftsValidated++;
      
      // Additional business logic validation
      if (validatedData.closed_at && validatedData.cash_difference && Math.abs(validatedData.cash_difference) > 100) {
        logger.warn(`Large cash difference detected in shift ${validatedData.id}: ${validatedData.cash_difference}`);
      }

      return validatedData;
    } catch (error) {
      this.validationStats.shiftsRejected++;
      logger.error(`Shift validation failed for ${data?.id || 'unknown'}:`, {
        error: error instanceof z.ZodError ? error.errors : error,
        rawData: data
      });
      return null;
    }
  }

  // Validate API response structure
  validateAPIResponse(response: any, expectedType: 'receipts' | 'shifts'): boolean {
    if (!response || typeof response !== 'object') {
      logger.error(`Invalid API response structure: expected object, got ${typeof response}`);
      return false;
    }

    if (expectedType === 'receipts') {
      if (!Array.isArray(response.receipts)) {
        logger.error(`Invalid receipts response: expected array, got ${typeof response.receipts}`);
        return false;
      }
    } else if (expectedType === 'shifts') {
      if (!Array.isArray(response.shifts)) {
        logger.error(`Invalid shifts response: expected array, got ${typeof response.shifts}`);
        return false;
      }
    }

    return true;
  }

  // Check for data consistency between receipts and shifts
  validateDataConsistency(receipts: ValidatedLoyverseReceipt[], shifts: ValidatedLoyverseShift[]): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if receipt dates fall within shift periods
    for (const receipt of receipts) {
      const receiptDate = new Date(receipt.receipt_date);
      const matchingShift = shifts.find(shift => {
        const shiftStart = new Date(shift.opened_at);
        const shiftEnd = shift.closed_at ? new Date(shift.closed_at) : new Date();
        return receiptDate >= shiftStart && receiptDate <= shiftEnd;
      });

      if (!matchingShift) {
        issues.push(`Receipt ${receipt.receipt_number} (${receipt.receipt_date}) has no matching shift`);
      }
    }

    // Check for duplicate receipts
    const receiptNumbers = receipts.map(r => r.receipt_number);
    const duplicates = receiptNumbers.filter((item, index) => receiptNumbers.indexOf(item) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate receipt numbers detected: ${duplicates.join(', ')}`);
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  // Get validation statistics
  getValidationStats() {
    return {
      ...this.validationStats,
      lastValidationRun: this.validationStats.lastValidationRun.toISOString()
    };
  }

  // Reset validation statistics
  resetValidationStats() {
    this.validationStats = {
      receiptsValidated: 0,
      receiptsRejected: 0,
      shiftsValidated: 0,
      shiftsRejected: 0,
      lastValidationRun: new Date()
    };
  }
}

export default LoyverseDataValidator;