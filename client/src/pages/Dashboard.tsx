import React, { useEffect, useMemo, useState } from 'react';

type Payment = { channel: 'CASH'|'QR'|'GRAB'|'CARD'|'OTHER'; count: number; totalSatang: number };
type Snapshot = {
  id: string;
  windowStartUTC: string;
  windowEndUTC: string;
  totalReceipts: number;
  totalSalesSatang: string;
  reconcileState: 'OK'|'MISMATCH'|'MISSING_DATA';
  reconcileNotes?: string | null;
  payments?: Payment[]; // if your /api/snapshots returns it inline
};
type Comparison = {
  opening: { buns: number|null; meatGram: number|null; drinks: number|null };
  purchases: { buns: number; meatGram: number; drinks: number };
  usagePOS: { buns: number; meatGram: number; drinks: number };
  expectedClose: { buns: number; meatGram: number; drinks: number };
  staffClose: { buns: number|null; meatGram: number|null; drinks: number|null };
  variance: { buns: number|null; meatGram: number|null; drinks: number|null };
  state: 'OK'|'MISMATCH'|'MISSING_DATA';
};
type TopItem = { itemName: string; qty: number; revenueSatang: string };

const fTHB = (s: number | bigint | string) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 })
    .format(Number(s) / 100);

const fInt = (n?: number | null) => (n ?? 0).toLocaleString('en-US');

const badge = (state: Snapshot['reconcileState']) => {
  const cls = state === 'OK' ? 'bg-emerald-100 text-emerald-700'
            : state === 'MISSING_DATA' ? 'bg-amber-100 text-amber-700'
            : 'bg-rose-100 text-rose-700';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{state}</span>;
};

const Card: React.FC<{title: string; right?: React.ReactNode; children: React.ReactNode}> = ({ title, right, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const Row: React.FC<{label: string; value: React.ReactNode; sub?: string}> = ({ label, value, sub }) => (
  <div className="flex items-baseline justify-between py-2 border-b last:border-b-0">
    <div className="text-gray-500 text-sm">{label}{sub ? <span className="ml-2 text-xs text-gray-400">{sub}</span> : null}</div>
    <div className="font-medium">{value}</div>
  </div>
);

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [comp, setComp] = useState<Comparison | null>(null);
  const [items, setItems] = useState<TopItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) fetch snapshots (latest first)
        const sRes = await fetch('/api/snapshots', { headers: { Accept: 'application/json' }});
        if (!sRes.ok) throw new Error('Failed to load snapshots');
        const sData: Snapshot[] = await sRes.json();

        if (!mounted) return;
        setSnapshots(sData);
        const latestSnap = sData?.[0] ?? null;
        setLatest(latestSnap);

        if (!latestSnap) { setLoading(false); return; }

        // 2) purchases-aware comparison for latest
        const cRes = await fetch(`/api/snapshots/${latestSnap.id}/comparison`, { headers: { Accept: 'application/json' }});
        if (cRes.ok) {
          const cData: Comparison = await cRes.json();
          if (!mounted) return;
          setComp(cData);
        }

        // 3) top items (optional route; hide panel if 404)
        try {
          const iRes = await fetch(`/api/snapshots/${latestSnap.id}/items`, { headers: { Accept: 'application/json' }});
          if (iRes.ok) {
            const iData: TopItem[] = await iRes.json();
            if (!mounted) return;
            setItems(iData);
          } else {
            setItems(null);
          }
        } catch {
          setItems(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message || 'Error loading dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const windowStr = useMemo(() => {
    if (!latest) return '';
    const start = new Date(latest.windowStartUTC);
    const end = new Date(latest.windowEndUTC);
    // Display in BKK
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
    const day: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Bangkok' };
    return `${start.toLocaleDateString('en-GB', day)} • ${start.toLocaleTimeString('en-GB', opts)} → ${end.toLocaleTimeString('en-GB', opts)} (BKK)`;
  }, [latest]);

  const payments = useMemo<Payment[]>(() => latest?.payments ?? [], [latest]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_,i) => <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <div className="font-semibold">Dashboard error</div>
          <div className="text-sm mt-1">{err}</div>
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No snapshots yet. Run the snapshot worker after a shift ends to populate this dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Restaurant Operations Hub</h1>
        <div className="text-sm text-gray-500">{windowStr}</div>
      </div>

      {/* Top row: Last shift + Payments + Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Last Shift Snapshot"
          right={badge(latest.reconcileState)}
        >
          <Row label="Gross sales" value={<span className="text-lg">{fTHB(latest.totalSalesSatang)}</span>} />
          <Row label="Receipts" value={<span className="text-lg">{fInt(latest.totalReceipts)}</span>} />
          {latest.reconcileNotes ? (
            <div className="mt-3 rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
              {latest.reconcileNotes}
            </div>
          ) : null}
        </Card>

        <Card title="Payments">
          {payments?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {['CASH','QR','GRAB','CARD','OTHER'].map(k => {
                const p = payments.find(x => x.channel === k);
                if (!p) return (
                  <div key={k} className="rounded-lg border p-3 text-sm text-gray-500">
                    <div className="font-medium">{k}</div>
                    <div className="text-gray-400">—</div>
                  </div>
                );
                return (
                  <div key={k} className="rounded-lg border p-3">
                    <div className="text-xs text-gray-500">{k}</div>
                    <div className="text-base font-semibold">{fTHB(p.totalSatang)}</div>
                    <div className="text-xs text-gray-400">{fInt(p.count)} tx</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No payment data attached to snapshot.</div>
          )}
        </Card>

        <Card title="Alerts">
          {latest.reconcileState === 'OK' ? (
            <div className="text-sm text-emerald-700">✅ All good. No variances beyond thresholds.</div>
          ) : latest.reconcileState === 'MISSING_DATA' ? (
            <div className="text-sm text-amber-700">
              ⚠️ Missing staff counts and/or purchases. Add Daily Stock + Purchases, then Recompute.
            </div>
          ) : (
            <div className="text-sm text-rose-700">
              ❗ Variances detected. Review Sales vs Staff below and confirm purchases.
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <a href={`/form-library`} className="text-xs underline text-gray-600">Open Form Library</a>
            <a href={`/purchasing`} className="text-xs underline text-gray-600">Purchasing</a>
          </div>
        </Card>
      </div>

      {/* Purchases-aware: Sales vs Staff */}
      <Card title="Sales vs Staff (Purchases-aware)">
        {comp ? (
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
              <tbody>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">Opening (prev shift)</td>
                  <td className="py-2">{fInt(comp.opening.buns)}</td>
                  <td className="py-2">{fInt(comp.opening.meatGram)}</td>
                  <td className="py-2">{fInt(comp.opening.drinks)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">+ Purchases (in window)</td>
                  <td className="py-2">{fInt(comp.purchases.buns)}</td>
                  <td className="py-2">{fInt(comp.purchases.meatGram)}</td>
                  <td className="py-2">{fInt(comp.purchases.drinks)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">− Usage (POS)</td>
                  <td className="py-2">{fInt(comp.usagePOS.buns)}</td>
                  <td className="py-2">{fInt(comp.usagePOS.meatGram)}</td>
                  <td className="py-2">{fInt(comp.usagePOS.drinks)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">= Expected Close</td>
                  <td className="py-2 font-medium">{fInt(comp.expectedClose.buns)}</td>
                  <td className="py-2 font-medium">{fInt(comp.expectedClose.meatGram)}</td>
                  <td className="py-2 font-medium">{fInt(comp.expectedClose.drinks)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">Staff Closing</td>
                  <td className="py-2">{fInt(comp.staffClose.buns)}</td>
                  <td className="py-2">{fInt(comp.staffClose.meatGram)}</td>
                  <td className="py-2">{fInt(comp.staffClose.drinks)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 text-gray-500">Variance</td>
                  <td className={`py-2 ${varianceClass(comp.variance.buns, 5)}`}>{numWithSign(comp.variance.buns)}</td>
                  <td className={`py-2 ${varianceClass(comp.variance.meatGram, 500)}`}>{numWithSign(comp.variance.meatGram)}</td>
                  <td className={`py-2 ${varianceClass(comp.variance.drinks, 3)}`}>{numWithSign(comp.variance.drinks)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No comparison data yet.</div>
        )}
      </Card>

      {/* Top Items */}
      {items && items.length ? (
        <Card title="Top Items (qty · revenue)">
          <div className="grid gap-2 md:grid-cols-2">
            {items.slice(0, 12).map((it) => (
              <div key={it.itemName} className="flex items-center justify-between rounded border p-3">
                <div className="text-sm text-gray-700 truncate">{it.itemName}</div>
                <div className="text-sm tabular-nums">
                  <span className="mr-3 text-gray-500">{it.qty}x</span>
                  <span className="font-medium">{fTHB(it.revenueSatang)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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

/** helpers */
function varianceClass(v: number | null, tol: number) {
  if (v == null) return 'text-gray-400';
  const a = Math.abs(v);
  if (a <= tol) return 'text-emerald-600';
  if (a <= tol * 2) return 'text-amber-600';
  return 'text-rose-600 font-semibold';
}
function numWithSign(v: number | null) {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toLocaleString('en-US');
}