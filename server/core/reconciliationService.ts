import { getShiftVerification } from './shiftVerificationService';
import { getStockStatus } from './stockVarianceService';

export async function getReconciliation(shiftDate: string) {
  const [shift, stock] = await Promise.all([getShiftVerification(shiftDate), getStockStatus(shiftDate)]);
  return { shiftDate, shift, stock };
}
