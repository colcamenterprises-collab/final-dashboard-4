export function resolveShiftDate(timestamp: Date | string | number): Date {
  const input = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const bkk = new Date(input.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const hour = bkk.getHours();
  if (hour < 3) {
    bkk.setDate(bkk.getDate() - 1);
  }
  bkk.setHours(0, 0, 0, 0);
  return bkk;
}

export function toShiftDateKey(timestamp: Date | string | number): string {
  return resolveShiftDate(timestamp).toISOString().slice(0, 10);
}
