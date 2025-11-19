import React, { useEffect, useMemo, useState } from 'react';
import { formatDateDDMMYYYY } from '@/lib/format';

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
type ShiftModifier = {
  sku: string | null;
  name: string;
  category: string;
  qty: number;
};
type ShiftResp = {
  ok: boolean;
  sourceUsed: 'live'|'cache';
  shiftDate: string;
  fromISO: string;
  toISO: string;
  items: ShiftItem[];
  modifiers?: ShiftModifier[];
  metrics?: {
    receiptCount: number;
    totalSales: number;
    payments: {
      Cash: number;
      Grab: number;
      QR: number;
      Other: number;
    };
    topByCategory: Record<string, Array<{name: string; qty: number}>>;
  };
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

// Helper to get the last shift date (yesterday in Bangkok time)
const getDefaultShiftDate = (): string => {
  const now = new Date();
  // Bangkok is UTC+7, subtract 1 day to get yesterday's shift
  now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0,10);
};

export default function ShiftAnalyticsMM() {
  const [date, setDate] = useState<string>(() => getDefaultShiftDate());
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [modifiers, setModifiers] = useState<ShiftModifier[]>([]);
  const [sourceUsed, setSourceUsed] = useState<"live"|"cache"|"">("");
  const [rolls, setRolls] = useState<RollsRow|null>(null);
  const [rollsHistory, setRollsHistory] = useState<RollsRow[]>([]);
  const [fresh, setFresh] = useState<Freshness>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [metrics, setMetrics] = useState<ShiftResp['metrics']>(undefined);

  async function loadAll() {
    setLoading(true); setError("");
    const ymd = toYMD(date);
    try {
      const a:ShiftResp = await fetch(`/api/analysis/shift/items?date=${ymd}`).then(r=>r.json());
      setItems(a?.items ?? []); 
      setModifiers(a?.modifiers ?? []);
      setSourceUsed(a?.sourceUsed ?? "");
      setMetrics(a?.metrics);

      const b = await fetch(`/api/analysis/rolls-ledger?date=${ymd}`).then(r=>r.json());
      setRolls(b?.row ?? null);

      const f = await fetch(`/api/analysis/freshness?date=${ymd}`).then(r=>r.json());
      setFresh(f?.freshness ?? null);
    } catch (e:any) {
      setError(e?.message ?? "Failed to load"); setItems([]); setModifiers([]); setRolls(null); setFresh(null); setMetrics(undefined);
    } finally { setLoading(false); }
  }

  async function loadRollsHistory() {
    try {
      const resp = await fetch('/api/analysis/rolls-ledger/history').then(r => r.json());
      setRollsHistory(resp?.rows ?? []);
    } catch (e) {
      console.error('Failed to load rolls history:', e);
    }
  }

  useEffect(() => { loadAll(); loadRollsHistory(); }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map(x => x.category));
    return ["all", ...Array.from(cats).sort()];
  }, [items]);

  const [tab, setTab] = useState<string>('all');
  const filtered = useMemo(() => tab === 'all' ? items : items.filter(i => i.category === tab), [items, tab]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, item) => ({
      qty: acc.qty + (item.qty || 0),
      patties: acc.patties + (item.patties || 0),
      beef: acc.beef + ((item.red_meat_g ?? item.redMeatGrams ?? 0) as number),
      chicken: acc.chicken + ((item.chicken_g ?? item.chickenGrams ?? 0) as number),
      rolls: acc.rolls + (item.rolls || 0)
    }), { qty: 0, patties: 0, beef: 0, chicken: 0, rolls: 0 });
  }, [filtered]);

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
          <input type="date" value={keyDate} onChange={e => setDate(e.target.value)} className="border rounded-[4px] p-2 text-xs" />
        </div>
        <button className="px-4 py-2 rounded-[4px] bg-emerald-600 text-white text-xs disabled:opacity-50" onClick={loadAll} disabled={loading} data-testid="button-load-shift">
          {loading ? 'Loading…' : 'Load Shift'}
        </button>
        <button className="px-4 py-2 rounded-[4px] bg-slate-200 text-xs" onClick={exportCSV} data-testid="button-export-csv">Export CSV</button>
      </div>

      {metrics && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="p-3 border border-slate-200 rounded-[4px] bg-white">
            <div className="text-slate-600">Receipts</div>
            <div className="font-bold text-slate-900 mt-1 text-lg">{metrics.receiptCount}</div>
          </div>
          <div className="p-3 border border-slate-200 rounded-[4px] bg-white">
            <div className="text-slate-600">Cash</div>
            <div className="font-bold text-slate-900 mt-1 text-lg">{metrics.payments.Cash}</div>
          </div>
          <div className="p-3 border border-slate-200 rounded-[4px] bg-white">
            <div className="text-slate-600">Grab</div>
            <div className="font-bold text-slate-900 mt-1 text-lg">{metrics.payments.Grab}</div>
          </div>
          <div className="p-3 border border-slate-200 rounded-[4px] bg-white">
            <div className="text-slate-600">QR</div>
            <div className="font-bold text-slate-900 mt-1 text-lg">{metrics.payments.QR}</div>
          </div>
          <div className="p-3 border border-slate-200 rounded-[4px] bg-white">
            <div className="text-slate-600">Other</div>
            <div className="font-bold text-slate-900 mt-1 text-lg">{metrics.payments.Other}</div>
          </div>
        </div>
      )}

      {metrics && Object.keys(metrics.topByCategory).length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Top 5 Items by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(metrics.topByCategory).map(([category, topItems]) => (
              <div key={category} className="p-3 border border-slate-200 rounded-[4px] bg-white">
                <h3 className="text-xs font-bold text-emerald-600 mb-2">{category}</h3>
                <div className="space-y-1">
                  {topItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-700 truncate flex-1">{item.name}</span>
                      <span className="font-bold text-slate-900 ml-2">{item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
          <div className="text-slate-600">QTY</div>
          <div className="font-bold text-slate-900 mt-1">{totals.qty}</div>
        </div>
        <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
          <div className="text-slate-600">Patties</div>
          <div className="font-bold text-slate-900 mt-1">{totals.patties}</div>
        </div>
        <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
          <div className="text-slate-600">Beef (g)</div>
          <div className="font-bold text-slate-900 mt-1">{totals.beef}</div>
        </div>
        <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
          <div className="text-slate-600">Chicken (g)</div>
          <div className="font-bold text-slate-900 mt-1">{totals.chicken}</div>
        </div>
        <div className="p-2 border border-slate-200 rounded-[4px] bg-white">
          <div className="text-slate-600">Rolls</div>
          <div className="font-bold text-slate-900 mt-1">{totals.rolls}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} className={`px-3 py-1 rounded-[4px] border border-slate-200 text-xs font-medium ${tab===c ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700'}`} onClick={() => setTab(c)} data-testid={`button-tab-${c}`}>
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs bg-white rounded-[4px] border border-slate-200">
          <thead>
            <tr className="text-left border-b border-slate-200 bg-slate-50">
              <th className="px-1 py-2 font-medium text-slate-700 hidden sm:table-cell">SKU</th>
              <th className="px-1 py-2 font-medium text-slate-700">Item</th>
              <th className="px-1 py-2 font-medium text-slate-700 hidden md:table-cell">Category</th>
              <th className="px-1 py-2 text-right font-medium text-slate-700">Qty</th>
              <th className="px-1 py-2 text-right font-medium text-slate-700">Patties</th>
              <th className="px-1 py-2 text-right font-medium text-slate-700">Beef (g)</th>
              <th className="px-1 py-2 text-right font-medium text-slate-700">Chicken (g)</th>
              <th className="px-1 py-2 text-right font-medium text-slate-700">Rolls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, i) => (
              <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-1 py-2 text-slate-700 hidden sm:table-cell">{it.sku ?? ''}</td>
                <td className="px-1 py-2 text-slate-900">{it.name}</td>
                <td className="px-1 py-2 text-slate-700 hidden md:table-cell">{it.category}</td>
                <td className="px-1 py-2 text-right text-slate-900">{it.qty}</td>
                <td className="px-1 py-2 text-right text-slate-700">{it.patties ?? 0}</td>
                <td className="px-1 py-2 text-right text-slate-700">{(it.red_meat_g ?? it.redMeatGrams ?? 0) as number}</td>
                <td className="px-1 py-2 text-right text-slate-700">{(it.chicken_g ?? it.chickenGrams ?? 0) as number}</td>
                <td className="px-1 py-2 text-right text-slate-700">{it.rolls ?? 0}</td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-1 py-2 text-slate-700 hidden sm:table-cell" colSpan={1}></td>
                <td className="px-1 py-2 text-slate-700 sm:hidden">TOTAL</td>
                <td className="px-1 py-2 text-slate-700 hidden sm:table-cell">TOTAL</td>
                <td className="px-1 py-2 text-slate-700 hidden md:table-cell"></td>
                <td className="px-1 py-2 text-right text-slate-900">{totals.qty}</td>
                <td className="px-1 py-2 text-right text-slate-900">{totals.patties}</td>
                <td className="px-1 py-2 text-right text-slate-900">{totals.beef}</td>
                <td className="px-1 py-2 text-right text-slate-900">{totals.chicken}</td>
                <td className="px-1 py-2 text-right text-slate-900">{totals.rolls}</td>
              </tr>
            )}
            {!filtered.length && <tr><td colSpan={8} className="px-1 py-3 text-slate-500 text-center">No items</td></tr>}
          </tbody>
        </table>
      </div>

      {modifiers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Modifiers & Extras</h2>
          <div className="bg-white rounded-[4px] border border-slate-200 p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <th className="px-1 py-2 font-medium text-slate-700">Modifier</th>
                  <th className="px-1 py-2 text-right font-medium text-slate-700">Qty</th>
                </tr>
              </thead>
              <tbody>
                {modifiers.map((mod, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="px-1 py-2 text-slate-900">{mod.name}</td>
                    <td className="px-1 py-2 text-right text-slate-900">{mod.qty}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-1 py-2 text-slate-700">TOTAL MODIFIERS</td>
                  <td className="px-1 py-2 text-right text-slate-900">{modifiers.reduce((sum, m) => sum + m.qty, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rollsHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rolls Ledger (14 Days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs bg-white rounded-[4px] border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Start</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Purchased</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Burgers Sold</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Est. End</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Actual End</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Variance</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {rollsHistory.map((row) => (
                  <tr key={row.shift_date} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900">{formatDateDDMMYYYY(row.shift_date)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.rolls_start}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.rolls_purchased}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.burgers_sold}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.estimated_rolls_end}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.actual_rolls_end ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {row.actual_rolls_end !== null ? (
                        <span className={row.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {row.variance >= 0 ? '+' : ''}{row.variance}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded-[4px] text-xs font-medium ${
                        row.status === 'OK' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : row.status === 'ALERT' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <div className="mt-3 text-red-700 text-sm">{error}</div>}
    </div>
  );
}
