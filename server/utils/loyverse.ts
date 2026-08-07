export async function loyverseGet(_endpoint: string, _params = {}) {
  throw new Error('Loyverse live API is retired. SBB POS is the live source of truth.');
}

export function getShiftUtcRange(shiftDate: string) {
  const startBkk = new Date(`${shiftDate}T17:00:00+07:00`);
  const endBkk = new Date(startBkk.getTime() + 10 * 60 * 60 * 1000);
  const buffer = 60 * 60 * 1000;
  const minUtc = startBkk.getTime() - buffer;
  const maxUtc = endBkk.getTime() + buffer;
  return {
    min: new Date(minUtc).toISOString(),
    max: new Date(maxUtc).toISOString(),
    exactStart: startBkk.toISOString(),
    exactEnd: endBkk.toISOString()
  };
}

export function filterByExactShift(data: any[], exactStart: string, exactEnd: string, dateKey = 'created_at') {
  const startMs = new Date(exactStart).getTime();
  const endMs = new Date(exactEnd).getTime();
  return data.filter(item => {
    const itemMs = new Date(item[dateKey]).getTime();
    return itemMs >= startMs && itemMs < endMs;
  });
}

export async function getShiftReport(_args: { date: string; storeId?: string }) {
  return loyverseGet('shifts');
}

export async function getLoyverseReceipts(_args: { date: string; storeId?: string }) {
  return loyverseGet('receipts');
}
