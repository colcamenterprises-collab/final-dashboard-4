import { getPosStatus } from './posStatusService';
import { getShiftVerification } from './shiftVerificationService';
import { CoreAlert } from './types';
import { getShiftDateForNow } from './shiftWindow';

export async function getAlerts() {
  const shiftDate = getShiftDateForNow();
  const [pos, shift] = await Promise.all([getPosStatus(), getShiftVerification(shiftDate)]);
  const alerts: CoreAlert[] = [];
  if (!pos.connected) alerts.push({ code: 'POS_DISCONNECTED', message: 'POS disconnected', severity: 'critical', category: 'POS', where: '/api/system/pos-status' });
  if (shift.dailySalesFormStatus === 'missing') alerts.push({ code: 'SALES_FORM_MISSING', message: 'Daily Sales form missing', severity: 'warning', category: 'Forms', where: 'daily_sales_v2' });
  if (shift.dailyStockFormStatus === 'missing') alerts.push({ code: 'STOCK_FORM_MISSING', message: 'Daily Stock form missing', severity: 'warning', category: 'Forms', where: 'daily_stock_sales' });
  return { shiftDate, count: alerts.length, alerts };
}
