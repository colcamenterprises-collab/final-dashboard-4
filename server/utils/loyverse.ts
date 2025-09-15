import axios from 'axios';

const LOYVERSE_BASE = 'https://api.loyverse.com/v1.0';
const token = process.env.LOYVERSE_TOKEN;

export async function loyverseGet(endpoint: string, params = {}) {
  try {
    const res = await axios.get(`${LOYVERSE_BASE}/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ...params, limit: 250 }
    });
    return res.data;
  } catch (e: any) {
    if (e.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return loyverseGet(endpoint, params);
    }
    throw new Error(`Loyverse error: ${e.message}`);
  }
}

export function getShiftUtcRange(shiftDate: string) {
  const startBkk = new Date(`${shiftDate}T17:00:00+07:00`);
  const endBkk = new Date(startBkk.getTime() + 10 * 60 * 60 * 1000); // 10h later
  const buffer = 60 * 60 * 1000; // 1h buffer each side
  const minUtc = new Date(startBkk.toUTCString()).getTime() - buffer;
  const maxUtc = new Date(endBkk.toUTCString()).getTime() + buffer;
  return {
    min: new Date(minUtc).toISOString(),
    max: new Date(maxUtc).toISOString(),
    exactStart: new Date(startBkk.toUTCString()).toISOString(),
    exactEnd: new Date(endBkk.toUTCString()).toISOString()
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