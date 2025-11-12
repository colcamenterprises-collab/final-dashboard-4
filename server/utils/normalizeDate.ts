export function normalizeDateParam(input?: string): string {
  if (!input) throw new Error('Missing date');
  const s = input.trim();
  // DD/MM/YYYY -> YYYY-MM-DD
  const m1 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // YYYY-MM-DD pass-through
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try native Date if someone sends ISO
  const d = new Date(s);
  if (!Number.isNaN(d.valueOf())) return d.toISOString().slice(0,10);
  throw new Error(`Bad date format: ${s}`);
}
