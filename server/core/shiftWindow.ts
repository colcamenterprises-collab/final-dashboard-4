export function getShiftDateForNow(now = new Date()): string {
  const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const y = bkk.getFullYear();
  const m = String(bkk.getMonth() + 1).padStart(2, '0');
  const d = String(bkk.getDate()).padStart(2, '0');
  const date = `${y}-${m}-${d}`;
  if (bkk.getHours() < 3) {
    const prev = new Date(bkk);
    prev.setDate(prev.getDate() - 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  }
  return date;
}

export const SHIFT_WINDOW = '17:00-03:00 Asia/Bangkok';
