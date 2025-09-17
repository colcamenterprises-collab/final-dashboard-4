import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

type DashboardDTO = {
  snapshot: {
    id: string;
    windowStartUTC: string;
    windowEndUTC: string;
    totalReceipts: number;
    totalSalesTHB: number;
    reconcileState: 'OK'|'MISMATCH'|'MISSING_DATA';
    reconcileNotes?: string | null;
    payments: { channel: 'CASH'|'QR'|'GRAB'|'CARD'|'OTHER'; count: number; totalTHB: number }[];
  } | null;
  expenses?: { totalTHB: number; linesCount: number };
  comparison?: {
    opening: { buns: number|null; meatGram: number|null; drinks: number|null };
    purchases: { buns: number; meatGram: number; drinks: number };
    usagePOS: { buns: number; meatGram: number; drinks: number };
    expectedClose: { buns: number; meatGram: number; drinks: number };
    staffClose: { buns: number|null; meatGram: number|null; drinks: number|null };
    variance: { buns: number|null; meatGram: number|null; drinks: number|null };
    state: 'OK'|'MISMATCH'|'MISSING_DATA';
  } | null;
  balance?: {
    staff: { closingCashTHB: number; cashBankedTHB: number; qrTransferTHB: number };
    pos: { cashTHB: number; qrTHB: number; grabTHB: number };
    diffs: { cashTHB: number; qrTHB: number };
  };
  topItems?: { itemName: string; qty: number; revenueTHB: number }[];
};

const currency = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(n);

const Card: React.FC<{title: string; right?: React.ReactNode; children: React.ReactNode}> = ({ title, right, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const Badge: React.FC<{state: 'OK'|'MISMATCH'|'MISSING_DATA'}> = ({ state }) => {
  const cls = state === 'OK' ? 'bg-emerald-100 text-emerald-700'
    : state === 'MISSING_DATA' ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{state}</span>;
};

function varianceClass(v: number | null, tol: number) {
  if (v == null) return 'text-gray-400';
  const a = Math.abs(v);
  if (a <= tol) return 'text-emerald-600';
  if (a <= tol * 2) return 'text-amber-600';
  return 'text-rose-600 font-semibold';
}
const withSign = (v: number | null) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('en-US'));
const int = (n?: number | null) => (n ?? 0).toLocaleString('en-US');

export default function Dashboard() {
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add stats query from operations (same as Analysis)
  const { data: stats } = useQuery({
    queryKey: ['analysisStats'],
    queryFn: () => axios.get('/api/operations/stats').then(res => res.data)
  });

  // Fort Knox balance data with 30-day range for home viewing
  const { data: balances } = useQuery({
    queryKey: ['loyverseBalances'], 
    queryFn: () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().slice(0,10);
      const endDate = new Date().toISOString().slice(0,10);
      return axios.get(`/api/loyverse/shifts?startDate=${startDate}&endDate=${endDate}`).then(res => res.data.balances || []);
    }
  });

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await fetch('/api/dashboard/latest', { headers: { Accept: 'application/json' }});
        if (!res.ok) throw new Error('Failed to load dashboard');
        const dto: DashboardDTO = await res.json();
        setData(dto);
      } catch (e:any) {
        setErr(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const windowStr = useMemo(() => {
    if (!data?.snapshot) return '';
    const start = new Date(data.snapshot.windowStartUTC);
    const end = new Date(data.snapshot.windowEndUTC);
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
    const day: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Bangkok' };
    return `${start.toLocaleDateString('en-GB', day)} • ${start.toLocaleTimeString('en-GB', opts)} → ${end.toLocaleTimeString('en-GB', opts)} (BKK)`;
  }, [data]);

  if (loading) return <div className="p-6"><div className="h-8 w-64 rounded bg-gray-200 animate-pulse" /></div>;
  if (err) return <div className="p-6"><div className="rounded border bg-rose-50 p-4 text-rose-700">{err}</div></div>;
  if (!data?.snapshot) return <div className="p-6"><div className="rounded border bg-amber-50 p-4 text-amber-700">No snapshots yet.</div></div>;

  const snap = data.snapshot;

  return (
    <div className="bg-app min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--heading)]">
          Restaurant Operations Hub
        </h1>
        <div className="text-xs text-[var(--muted)]">{windowStr}</div>
      </div>

      {/* Stats Cards from Operations (same as Analysis) */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card title="Net MTD">
            <div className="text-2xl font-bold text-emerald-600">{currency(stats.netMtd)}</div>
          </Card>
          <Card title="Gross Last">
            <div className="text-2xl font-bold text-blue-600">{currency(stats.grossLast)}</div>
          </Card>
          <Card title="Receipts Last">
            <div className="text-2xl font-bold text-purple-600">{stats.receiptsLast}</div>
          </Card>
          <Card title="Anomalies">
            <div className="text-2xl font-bold text-red-600">{stats.anomalies}</div>
          </Card>
        </div>
      )}

      {/* Top row */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card title="Last Shift Snapshot" right={<Badge state={snap.reconcileState} />}>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="text-gray-500 text-sm">Gross sales</div>
              <div className="text-lg tabular-nums">{currency(snap.totalSalesTHB)}</div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-gray-500 text-sm">Receipts</div>
              <div className="text-lg">{int(snap.totalReceipts)}</div>
            </div>
            {snap.reconcileNotes ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{snap.reconcileNotes}</div>
            ) : null}
          </div>
        </Card>

        <Card title="Payments">
          <div className="grid grid-cols-2 gap-2">
            {['CASH','QR','GRAB','CARD','OTHER'].map((k) => {
              const p = snap.payments.find(x => x.channel === k);
              return (
                <div key={k} className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">{k}</div>
                  <div className="text-base font-semibold tabular-nums">{p ? currency(p.totalTHB) : '—'}</div>
                  <div className="text-xs text-gray-400">{p ? `${int(p.count)} tx` : '—'}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Alerts">
          {snap.reconcileState === 'OK' ? (
            <div className="text-sm text-emerald-700">✅ All good. No variances beyond thresholds.</div>
          ) : snap.reconcileState === 'MISSING_DATA' ? (
            <div className="text-sm text-amber-700">⚠️ Missing staff counts and/or purchases. Add them, then Recompute.</div>
          ) : (
            <div className="text-sm text-rose-700">❗ Variances detected. Review Sales vs Staff and confirm purchases.</div>
          )}
          <div className="mt-3 flex gap-3">
            <a className="text-xs underline text-gray-600" href="/form-library">Open Form Library</a>
            <a className="text-xs underline text-gray-600" href="/purchasing">Purchasing</a>
            <a className="text-xs underline text-gray-600" href="/analysis">Open Analysis</a>
          </div>
        </Card>
      </div>

      {/* Middle row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Sales vs Staff (Purchases-aware)">
          {data.comparison ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Metric</th>
                    <th className="py-2">Buns</th>
                    <th className="py-2">Meat (g)</th>
                    <th className="py-2">Drinks</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr className="border-t"><td className="py-2 text-gray-500">Opening (prev shift)</td><td>{int(data.comparison.opening.buns)}</td><td>{int(data.comparison.opening.meatGram)}</td><td>{int(data.comparison.opening.drinks)}</td></tr>
                  <tr className="border-t"><td className="py-2 text-gray-500">+ Purchases</td><td>{int(data.comparison.purchases.buns)}</td><td>{int(data.comparison.purchases.meatGram)}</td><td>{int(data.comparison.purchases.drinks)}</td></tr>
                  <tr className="border-t"><td className="py-2 text-gray-500">− Usage (POS)</td><td>{int(data.comparison.usagePOS.buns)}</td><td>{int(data.comparison.usagePOS.meatGram)}</td><td>{int(data.comparison.usagePOS.drinks)}</td></tr>
                  <tr className="border-t"><td className="py-2 text-gray-500">= Expected Close</td><td className="font-medium">{int(data.comparison.expectedClose.buns)}</td><td className="font-medium">{int(data.comparison.expectedClose.meatGram)}</td><td className="font-medium">{int(data.comparison.expectedClose.drinks)}</td></tr>
                  <tr className="border-t"><td className="py-2 text-gray-500">Staff Closing</td><td>{int(data.comparison.staffClose.buns)}</td><td>{int(data.comparison.staffClose.meatGram)}</td><td>{int(data.comparison.staffClose.drinks)}</td></tr>
                  <tr className="border-t"><td className="py-2 text-gray-500">Variance</td>
                    <td className={varianceClass(data.comparison.variance.buns, 5)}>{withSign(data.comparison.variance.buns)}</td>
                    <td className={varianceClass(data.comparison.variance.meatGram, 500)}>{withSign(data.comparison.variance.meatGram)}</td>
                    <td className={varianceClass(data.comparison.variance.drinks, 3)}>{withSign(data.comparison.variance.drinks)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : <div className="text-sm text-gray-500">No comparison yet.</div>}
        </Card>

        <Card title="Shift Report Balance">
          <div className="grid grid-cols-2 gap-3 text-sm tabular-nums">
            <div>
              <div className="text-gray-500 mb-1">Staff</div>
              <div className="flex justify-between py-1"><span>Closing Cash</span><span>{currency(data.balance?.staff.closingCashTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>Cash Banked</span><span>{currency(data.balance?.staff.cashBankedTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>QR Transfer</span><span>{currency(data.balance?.staff.qrTransferTHB ?? 0)}</span></div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">POS</div>
              <div className="flex justify-between py-1"><span>CASH</span><span>{currency(data.balance?.pos.cashTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>QR</span><span>{currency(data.balance?.pos.qrTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>GRAB</span><span>{currency(data.balance?.pos.grabTHB ?? 0)}</span></div>
            </div>
          </div>
          <div className="mt-3 rounded border p-2">
            <div className="flex justify-between text-sm"><span>Diff (Cash Banked − POS CASH)</span>
              <span className={`${(data.balance?.diffs.cashTHB ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600 font-semibold'}`}>
                {currency(Math.abs(data.balance?.diffs.cashTHB ?? 0))}{(data.balance?.diffs.cashTHB ?? 0)===0 ? '' : (data.balance!.diffs.cashTHB>0?' (+)':' (−)')}
              </span>
            </div>
            <div className="flex justify-between text-sm"><span>Diff (QR Transfer − POS QR)</span>
              <span className={`${(data.balance?.diffs.qrTHB ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600 font-semibold'}`}>
                {currency(Math.abs(data.balance?.diffs.qrTHB ?? 0))}{(data.balance?.diffs.qrTHB ?? 0)===0 ? '' : (data.balance!.diffs.qrTHB>0?' (+)':' (−)')}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Expenses (Purchases in window)">
          <div className="flex items-baseline justify-between">
            <div className="text-gray-500 text-sm">Total</div>
            <div className="text-lg font-semibold tabular-nums">{currency(data.expenses?.totalTHB ?? 0)}</div>
          </div>
          <div className="mt-1 text-xs text-gray-500">{int(data.expenses?.linesCount)} lines</div>
          <div className="mt-3"><a className="text-xs underline text-gray-600" href="/purchasing">Open Purchasing</a></div>
        </Card>
      </div>

      {/* Bottom row */}
      {data.topItems && data.topItems.length ? (
        <Card title="Top Items (qty · revenue)">
          <div className="grid gap-2 md:grid-cols-2">
            {data.topItems.slice(0, 12).map((it) => (
              <div key={it.itemName} className="flex items-center justify-between rounded border p-3">
                <div className="text-sm text-gray-700 truncate">{it.itemName}</div>
                <div className="text-sm tabular-nums">
                  <span className="mr-3 text-gray-500">{int(it.qty)}x</span>
                  <span className="font-medium">{currency(it.revenueTHB)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Fort Knox Balance Visualization */}
      {balances && balances.length > 0 && (
        <Card title="Daily Register Balance">
          {/* Simple Bar Chart */}
          <div className="mb-4 space-y-2">
            {balances.slice(-10).map((b: any) => (
              <div key={b.date} className="flex items-center gap-2">
                <div className="w-20 text-xs text-gray-600">{b.date.slice(-5)}</div>
                <div className="flex-1 bg-gray-100 h-4 rounded relative overflow-hidden">
                  <div 
                    className={`h-full ${Math.abs(b.balance) <= 50 ? 'bg-green-500' : 'bg-red-500'}`} 
                    style={{ 
                      width: `${Math.min(Math.abs(b.balance) / 200 * 100, 100)}%`,
                      marginLeft: b.balance < 0 ? 'auto' : '0'
                    }}
                  />
                </div>
                <div className="w-16 text-xs text-right">{b.balance.toFixed(2)}</div>
              </div>
            ))}
          </div>
          
          {/* Balance Table */}
          <div className="space-y-1">
            {balances.slice(-5).map((b: any) => (
              <div key={b.date} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                <div className="text-sm">{b.date}</div>
                <div className="flex items-center gap-2">
                  <span 
                    className={`${Math.abs(b.balance) <= 50 ? 'bg-green-500' : 'bg-red-500'} text-white px-2 py-1 rounded text-xs font-medium`}
                  >
                    {b.balance.toFixed(2)} THB
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-sm mt-4 text-gray-500">
            Note: Green boxes indicate register difference within ±50 THB (acceptable range). Red boxes indicate difference exceeding ±50 THB (requires attention).
          </p>
        </Card>
      )}

      {/* Restaurant Hub Logo and Copyright */}
      <div className="flex flex-col items-end mt-8 mb-4">
        <a 
          href="https://www.customli.io" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
        >
          <img 
            src="/assets/restaurant-hub-logo.png" 
            alt="Restaurant Hub" 
            className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity mb-2 cursor-pointer"
          />
        </a>
        <p className="text-xs text-gray-500 text-right">
          Copyright 2025 - www.customli.io - Restaurant Marketing & Management
        </p>
      </div>
    </div>
  );
}