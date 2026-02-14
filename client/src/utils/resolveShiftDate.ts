function getBangkokDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
  };
}

export function resolveShiftDate(now: Date = new Date()): string {
  const { year, month, day, hour } = getBangkokDateParts(now);
  const bangkokDateUtcRef = new Date(Date.UTC(year, month - 1, day));

  if (hour < 3) {
    bangkokDateUtcRef.setUTCDate(bangkokDateUtcRef.getUTCDate() - 1);
  }

  return bangkokDateUtcRef.toISOString().slice(0, 10);
}
