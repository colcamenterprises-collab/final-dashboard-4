import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';

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

export default function AnalysisDetail() {
  const { id } = useParams();
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await fetch(`/api/analysis/snapshot/${id}`, { headers: { Accept: 'application/json' }});
        if (!res.ok) throw new Error('Failed to load analysis details');
        const dto: DashboardDTO = await res.json();
        setData(dto);
      } catch (e:any) {
        setErr(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
  if (!data?.snapshot) return <div className="p-6"><div className="rounded border bg-amber-50 p-4 text-amber-700">Snapshot not found.</div></div>;

  const snap = data.snapshot;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <a href="/analysis" className="hover:text-blue-600 underline">Analysis</a> &gt; Snapshot Detail
          </nav>
          <h1 className="text-2xl font-semibold">Shift Analysis</h1>
        </div>
        <div className="text-sm text-gray-500">{windowStr}</div>
      </div>

      {/* Top row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Shift Snapshot" right={<Badge state={snap.reconcileState} />}>
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

        <Card title="Payments Breakdown">
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

        <Card title="Expenses (Purchases in window)">
          <div className="flex items-baseline justify-between">
            <div className="text-gray-500 text-sm">Total</div>
            <div className="text-lg font-semibold tabular-nums">{currency(data.expenses?.totalTHB ?? 0)}</div>
          </div>
          <div className="mt-1 text-xs text-gray-500">{int(data.expenses?.linesCount)} expense lines</div>
          <div className="mt-3 text-xs text-gray-500">
            Includes all purchase transactions within the shift window
          </div>
        </Card>
      </div>

      {/* Middle row */}
      <div className="grid gap-4 md:grid-cols-2">
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
          ) : <div className="text-sm text-gray-500">No comparison data available.</div>}
        </Card>

        <Card title="Shift Report Balance">
          <div className="grid grid-cols-2 gap-3 text-sm tabular-nums">
            <div>
              <div className="text-gray-500 mb-1">Staff Reports</div>
              <div className="flex justify-between py-1"><span>Closing Cash</span><span>{currency(data.balance?.staff.closingCashTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>Cash Banked</span><span>{currency(data.balance?.staff.cashBankedTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>QR Transfer</span><span>{currency(data.balance?.staff.qrTransferTHB ?? 0)}</span></div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">POS Reports</div>
              <div className="flex justify-between py-1"><span>CASH</span><span>{currency(data.balance?.pos.cashTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>QR</span><span>{currency(data.balance?.pos.qrTHB ?? 0)}</span></div>
              <div className="flex justify-between py-1"><span>GRAB</span><span>{currency(data.balance?.pos.grabTHB ?? 0)}</span></div>
            </div>
          </div>
          <div className="mt-3 rounded border p-2 bg-gray-50">
            <div className="text-xs text-gray-600 mb-2">Variance Analysis</div>
            <div className="flex justify-between text-sm"><span>Cash Banked − POS CASH</span>
              <span className={`${(data.balance?.diffs.cashTHB ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600 font-semibold'}`}>
                {currency(Math.abs(data.balance?.diffs.cashTHB ?? 0))}{(data.balance?.diffs.cashTHB ?? 0)===0 ? '' : (data.balance!.diffs.cashTHB>0?' (+)':' (−)')}
              </span>
            </div>
            <div className="flex justify-between text-sm"><span>QR Transfer − POS QR</span>
              <span className={`${(data.balance?.diffs.qrTHB ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600 font-semibold'}`}>
                {currency(Math.abs(data.balance?.diffs.qrTHB ?? 0))}{(data.balance?.diffs.qrTHB ?? 0)===0 ? '' : (data.balance!.diffs.qrTHB>0?' (+)':' (−)')}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      {data.topItems && data.topItems.length ? (
        <Card title="Top Items (qty · revenue)">
          <div className="grid gap-2 md:grid-cols-3">
            {data.topItems.slice(0, 15).map((it) => (
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
    </div>
  );
}