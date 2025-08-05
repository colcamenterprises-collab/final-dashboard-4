import { validateDailySalesForm } from '../middleware/validateDailySalesForm';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  validatedData?: any;
}

/**
 * Utility function for validating daily sales form data
 * Returns validation result in object format for easy checking
 */
export function validateFormData(formData: any): ValidationResult {
  let valid = true;
  let errors: string[] = [];
  let validatedData = null;

  // Mock request/response objects for middleware
  const mockReq = { body: formData } as any;
  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => {
        valid = false;
        if (data.error) {
          errors.push(data.error);
        }
        if (data.fields) {
          errors.push(`Missing fields: ${data.fields.join(', ')}`);
        }
        if (data.message) {
          errors.push(data.message);
        }
      }
    })
  } as any;

  let nextCalled = false;
  const mockNext = () => {
    nextCalled = true;
    validatedData = mockReq.body;
  };

  try {
    validateDailySalesForm(mockReq, mockRes, mockNext);
    
    if (nextCalled) {
      valid = true;
      validatedData = mockReq.body;
    }
  } catch (error) {
    valid = false;
    errors.push(error instanceof Error ? error.message : 'Validation error');
  }

  return {
    valid,
    errors: errors.length > 0 ? errors : undefined,
    validatedData: valid ? validatedData : undefined
  };
}

/**
 * Express middleware wrapper that provides validation result object
 */
export function getValidationResult(req: any): ValidationResult {
  return validateFormData(req.body);
}