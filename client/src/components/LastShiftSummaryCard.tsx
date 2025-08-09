import React, { useEffect, useMemo, useState } from 'react';

type Summary = {
  window: { startUTC: string; endUTC: string };
  receipts: number;
  grossCents: number;
  discountsCents: number;
  netCents: number;
  grossProfitCents?: number | null;
  payments: Record<string, number>; // method -> cents
  topItems?: Array<{ name: string; qty: number; revenueCents: number }>;
  source: 'analytics' | 'window';
};

function cents(c: number | null | undefined) {
  if (!c) return '฿0.00';
  return `฿${(c / 100).toFixed(2)}`;
}

// Compute yesterday 18:00 → today 03:00 in BKK, return UTC ISO bounds
function lastShiftBkkBounds(): { startUTC: string; endUTC: string } {
  const BKK_OFFSET_MS = 7 * 3600_000; // UTC+7
  const nowUTC = Date.now();
  const nowBkk = new Date(nowUTC + BKK_OFFSET_MS);

  // end = today 03:00 BKK
  const endBkk = new Date(nowBkk);
  endBkk.setHours(3, 0, 0, 0);
  // if it's before 03:00 BKK now, "today 03:00" is earlier today; else still fine

  // start = yesterday 18:00 BKK
  const startBkk = new Date(endBkk);
  startBkk.setDate(startBkk.getDate() - 1);
  startBkk.setHours(18, 0, 0, 0);

  const startUTC = new Date(startBkk.getTime() - BKK_OFFSET_MS).toISOString();
  const endUTC = new Date(endBkk.getTime() - BKK_OFFSET_MS).toISOString();
  return { startUTC, endUTC };
}

export default function LastShiftSummaryCard({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bounds = useMemo(() => lastShiftBkkBounds(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        // 1) Try analytics_daily (fast path)
        const a = await fetch(`/api/analytics/latest?restaurantId=${encodeURIComponent(restaurantId)}`);
        if (a.ok) {
          const ja = await a.json();
          if (ja && ja.analytics) {
            const ad = ja.analytics;
            const ds = ja.dailySales || {}; // if your endpoint returns both
            const payments: Record<string, number> = {
              CASH: ds.cash ?? 0,
              CARD: ds.card ?? 0,
              QR: ds.qr ?? 0,
              DELIVERY_PARTNER: ds.delivery ?? 0,
              OTHER: ds.other ?? 0,
            };
            const summary: Summary = {
              window: bounds,
              receipts: ds.receiptsCount ?? 0,
              grossCents: ds.totalSales ?? 0,
              discountsCents: 0, // fill if you store it; else 0
              netCents: ds.totalSales ?? 0,
              grossProfitCents: null, // unless you've added COGS
              payments,
              topItems: ad.top5ByRevenue?.map((x: any) => ({
                name: x.skuOrName,
                qty: 0,
                revenueCents: x.revenue || 0,
              })),
              source: 'analytics',
            };
            if (!cancelled) setData(summary);
            return;
          }
        }

        // 2) Fallback: raw window summary
        const q = new URLSearchParams({
          restaurantId,
          from: bounds.startUTC,
          to: bounds.endUTC,
        }).toString();
        const r = await fetch(`/api/receipts/window?${q}`);
        if (!r.ok) throw new Error(`window endpoint ${r.status}`);
        const jw = await r.json();
        const summary: Summary = {
          window: bounds,
          receipts: jw.count ?? 0,
          grossCents: jw.grossCents ?? 0,
          discountsCents: jw.discountsCents ?? 0,
          netCents: jw.netCents ?? jw.grossCents ?? 0,
          grossProfitCents: jw.grossProfitCents ?? null,
          payments: jw.payments || {},
          topItems: jw.topItems || [],
          source: 'window',
        };
        if (!cancelled) setData(summary);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Load failed');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, bounds]);

  if (error) {
    return (
      <div className="rounded-2xl border p-4 bg-red-50 text-red-800">
        <div className="font-semibold">Last Shift (BKK 18:00→03:00)</div>
        <div className="text-sm">Error: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border p-4">
        <div className="font-semibold">Last Shift (BKK 18:00→03:00)</div>
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  const payments = Object.entries(data.payments || {});
  const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '0%');

  return (
    <div className="rounded-2xl border p-5 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg dark:text-white">Last Shift — BKK 18:00 → 03:00</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(data.window.startUTC).toLocaleString()} → {new Date(data.window.endUTC).toLocaleString()} UTC
          <span className="ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{data.source}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        <Metric label="Gross sales" value={cents(data.grossCents)} />
        <Metric label="Discounts" value={cents(data.discountsCents)} />
        <Metric label="Net sales" value={cents(data.netCents)} />
        <Metric label="Gross profit" value={data.grossProfitCents == null ? '—' : cents(data.grossProfitCents)} />
        <Metric label="Receipts" value={String(data.receipts)} />
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium mb-1 dark:text-white">Payments</div>
        <div className="flex flex-wrap gap-2 text-sm text-gray-700 dark:text-gray-300">
          {payments.length === 0 && <span className="text-gray-400">No payments</span>}
          {payments.map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
              {k}: {cents(v)} ({pct(v as number, data.grossCents)})
            </span>
          ))}
        </div>
      </div>

      {data.topItems && data.topItems.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-1 dark:text-white">Top sellers</div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            {data.topItems.slice(0, 5).map((t, i) => (
              <li key={i}>
                {t.name} — {t.qty ? `${t.qty}x, ` : ''}{cents(t.revenueCents)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold dark:text-white">{value}</div>
    </div>
  );
}