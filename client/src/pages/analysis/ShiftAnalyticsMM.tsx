import React, { useEffect, useMemo, useState } from 'react';

type ShiftItem = {
  sku: string | null;
  name: string;
  category: string;
  qty: number;
  patties?: number;
  red_meat_g?: number; redMeatGrams?: number;
  chicken_g?: number;  chickenGrams?: number;
  rolls?: number;
};
type ShiftResp = {
  ok: boolean;
  sourceUsed: 'live'|'cache';
  shiftDate: string;
  fromISO: string;
  toISO: string;
  items: ShiftItem[];
};
type RollsRow = {
  shift_date: string;
  rolls_start: number;
  rolls_purchased: number;
  burgers_sold: number;
  estimated_rolls_end: number;
  actual_rolls_end: number | null;
  variance: number;
  status: 'PENDING'|'OK'|'ALERT';
};
type Freshness = null | {
  source: string;
  receipts_count: number;
  line_items_count: number;
  modifiers_count: number;
  status: string;
  created_at: string;
};

const toYMD = (v: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  try { return new Date(v).toISOString().slice(0,10); } catch { return v; }
};

export default function ShiftAnalyticsMM() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [sourceUsed, setSourceUsed] = useState<"live"|"cache"|"">("");
  const [rolls, setRolls] = useState<RollsRow|null>(null);
  const [fresh, setFresh] = useState<Freshness>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function loadAll() {
    setLoading(true); setError("");
    const ymd = toYMD(date);
    try {
      const a:ShiftResp = await fetch(`/api/analysis/shift/items?date=${ymd}`).then(r=>r.json());
      setItems(a?.items ?? []); setSourceUsed(a?.sourceUsed ?? "");

      const b = await fetch(`/api/analysis/rolls-ledger?date=${ymd}`).then(r=>r.json());
      setRolls(b?.row ?? null);

      const f = await fetch(`/api/analysis/freshness?date=${ymd}`).then(r=>r.json());
      setFresh(f?.freshness ?? null);
    } catch (e:any) {
      setError(e?.message ?? "Failed to load"); setItems([]); setRolls(null); setFresh(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map(x => x.category));
    return ["all", ...Array.from(cats).sort()];
  }, [items]);

  const [tab, setTab] = useState<string>('all');
  const filtered = useMemo(() => tab === 'all' ? items : items.filter(i => i.category === tab), [items, tab]);

  function exportCSV() {
    const ymd = toYMD(date);
    window.location.href = `/api/analysis/shift/items.csv?date=${ymd}`;
  }
  const keyDate = toYMD(date);

  return (
    <div className="p-4">
      <h1 className="text-3xl font-extrabold">F&B Analysis</h1>
      <div className="text-sm text-slate-600">Window: 5 PM → 3 AM (Bangkok)
        <span className="ml-2 inline-block rounded bg-emerald-100 text-emerald-800 px-2 py-0.5">
          {sourceUsed ? (sourceUsed === 'live' ? 'Live Data' : 'Cached') : ''}
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-1">Key: {keyDate}</div>
      {fresh && (
        <div className="mt-2 text-xs text-slate-600">
          Data Freshness: <b>{fresh.source}</b>
          {' · '}r:{fresh.receipts_count} i:{fresh.line_items_count} m:{fresh.modifiers_count}
          {' · '}{new Date(fresh.created_at).toLocaleString()}
        </div>
      )}

      <div className="mt-4 flex items-end gap-3">
        <div>
          <label className="block text-sm mb-1">Shift date</label>
          <input type="date" value={keyDate} onChange={e => setDate(e.target.value)} className="border rounded p-2" />
        </div>
        <button className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" onClick={loadAll} disabled={loading} data-testid="button-load-shift">
          {loading ? 'Loading…' : 'Load Shift'}
        </button>
        <button className="px-4 py-2 rounded bg-slate-200" onClick={exportCSV} data-testid="button-export-csv">Export CSV</button>
      </div>

      {rolls && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="p-2 border rounded">Start<br/><b>{rolls.rolls_start}</b></div>
          <div className="p-2 border rounded">Purchased<br/><b>{rolls.rolls_purchased}</b></div>
          <div className="p-2 border rounded">Burgers Sold<br/><b>{rolls.burgers_sold}</b></div>
          <div className="p-2 border rounded">Estimated End<br/><b>{rolls.estimated_rolls_end}</b></div>
          <div className="p-2 border rounded">Actual End<br/><b>{rolls.actual_rolls_end ?? '—'}</b></div>
          <div className={`p-2 border rounded font-bold text-center ${
            rolls.status === 'OK' ? 'bg-emerald-100 text-emerald-800' :
            rolls.status === 'ALERT' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
            {rolls.status}{rolls.actual_rolls_end !== null ? ` (${rolls.variance >= 0 ? '+' : ''}${rolls.variance})` : ''}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {categories.map(c => (
          <button key={c} className={`px-3 py-1 rounded border ${tab===c ? 'bg-emerald-600 text-white' : 'bg-white'}`} onClick={() => setTab(c)} data-testid={`button-tab-${c}`}>
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[950px] w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">SKU</th>
              <th className="p-2">Item</th>
              <th className="p-2">Category</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Patties</th>
              <th className="p-2">Beef (g)</th>
              <th className="p-2">Chicken (g)</th>
              <th className="p-2">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{it.sku ?? ''}</td>
                <td className="p-2">{it.name}</td>
                <td className="p-2">{it.category}</td>
                <td className="p-2">{it.qty}</td>
                <td className="p-2">{it.patties ?? 0}</td>
                <td className="p-2">{(it.red_meat_g ?? it.redMeatGrams ?? 0) as number}</td>
                <td className="p-2">{(it.chicken_g ?? it.chickenGrams ?? 0) as number}</td>
                <td className="p-2">{it.rolls ?? 0}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="p-3 text-slate-500">No items</td></tr>}
          </tbody>
        </table>
      </div>
      {error && <div className="mt-3 text-red-700 text-sm">{error}</div>}
    </div>
  );
}
