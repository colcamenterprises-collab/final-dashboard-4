import { DateTime } from 'luxon';

export interface ShiftTimeWindow {
  shiftStart: string;
  shiftEnd: string;
  shiftDate: string;
}

/**
 * Calculate shift time window for Bangkok timezone (5 PM to 3 AM)
 * If current time is before 3 AM, it belongs to previous day's shift
 */
export function calculateShiftTimeWindow(): ShiftTimeWindow {
  // Get current datetime in Bangkok timezone
  const nowBangkok = DateTime.now().setZone('Asia/Bangkok');
  
  // Determine shift date based on whether we're before or after 3 AM
  let shiftDate: DateTime;
  if (nowBangkok.hour < 3) {
    // Before 3 AM - belongs to previous day's shift
    shiftDate = nowBangkok.minus({ days: 1 });
  } else {
    // After 3 AM - current day's shift
    shiftDate = nowBangkok;
  }
  
  // Define shift start (5 PM) and end (3 AM next day)
  const shiftStart = shiftDate.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const shiftEnd = shiftStart.plus({ hours: 10 }); // Ends at 3 AM next day
  
  return {
    shiftStart: shiftStart.toISO()!,
    shiftEnd: shiftEnd.toISO()!,
    shiftDate: shiftDate.toISODate()!
  };
}

/**
 * Get shift time window for a specific date
 */
export function getShiftTimeWindowForDate(dateString: string): ShiftTimeWindow {
  const date = DateTime.fromISO(dateString).setZone('Asia/Bangkok');
  
  const shiftStart = date.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const shiftEnd = shiftStart.plus({ hours: 10 });
  
  return {
    shiftStart: shiftStart.toISO()!,
    shiftEnd: shiftEnd.toISO()!,
    shiftDate: date.toISODate()!
  };
}