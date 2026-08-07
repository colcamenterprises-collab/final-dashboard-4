export async function loyverseGet(_endpoint, _params = {}) {
  throw new Error('Loyverse live API is retired. SBB POS is the live source of truth.');
}

export function getShiftUtcRange(shiftDate) {
  const startBkk = new Date(`${shiftDate}T17:00:00+07:00`);
  const endBkk = new Date(startBkk.getTime() + 10 * 60 * 60 * 1000);
  const buffer = 60 * 60 * 1000;
  return {
    min: new Date(startBkk.getTime() - buffer).toISOString(),
    max: new Date(endBkk.getTime() + buffer).toISOString(),
    exactStart: startBkk.toISOString(),
    exactEnd: endBkk.toISOString()
  };
}

export function filterByExactShift(data, exactStart, exactEnd, dateKey = 'created_at') {
  const startMs = new Date(exactStart).getTime();
  const endMs = new Date(exactEnd).getTime();
  return data.filter(item => {
    const itemMs = new Date(item[dateKey]).getTime();
    return itemMs >= startMs && itemMs < endMs;
  });
}

export async function getShiftReport(_args) {
  return loyverseGet('shifts');
}

export async function getLoyverseReceipts(_args) {
  return loyverseGet('receipts');
}
