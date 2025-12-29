export function getShiftWindow(date: string) {
  return {
    start: `${date} 17:00:00+07`,
    end: `${date} 27:00:00+07`
  };
}

export function getShiftWindowUTC(date: string): { start: Date; end: Date } {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  return { start, end };
}
