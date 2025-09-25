// Simple base-unit map. Extend if you add more UOMs.
export const UOM: Record<string, number> = {
  each: 1,
  pc: 1,
  g: 0.001,
  kg: 1,
  ml: 0.001,
  l: 1,
  L: 1,
};

export function toBase(qty: number | null | undefined, unit: string | null | undefined) {
  const q = Number(qty ?? 0);
  const u = String(unit ?? 'each').toLowerCase();
  const f = UOM[u] ?? 1;
  return q * f;
}