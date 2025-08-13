import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Smash Brothers Burgers — Modern Dashboard
 * - Tailwind CSS with teal/orange design
 * - Poppins font, white base, rounded cards
 * - Fully responsive (mobile/tablet/desktop)
 * - Real API data integration
 * - No emojis per user preference
 */

type DashboardDTO = {
  snapshot: {
    id: string;
    windowStartUTC: string;
    windowEndUTC: string;
    totalReceipts: number;
    totalSalesTHB: number;
    reconcileState: 'OK'|'MISMATCH'|'MISSING_DATA';
    payments: { channel: string; count: number; totalTHB: number }[];
  } | null;
  expenses?: { totalTHB: number; linesCount: number };
  topItems?: { itemName: string; qty: number; revenueTHB: number }[];
  balance?: {
    staff: { closingCashTHB: number; cashBankedTHB: number; qrTransferTHB: number };
    pos: { cashTHB: number; qrTHB: number; grabTHB: number };
  };
};

// Helpers
const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
const currency = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);

function StatCard({label, value, unit, format}: {label: string; value: number; unit?: string; format?: (n: number) => string}) {
  const v = format ? format(value) : fmt(value);
  return (
    <div className="rounded-2xl bg-teal-600 text-white px-5 py-4 shadow-md flex-1 min-w-[180px]">
      <div className="text-teal-100 text-xs tracking-wide uppercase">{label}</div>
      <div className="text-3xl md:text-4xl font-semibold tabular-nums mt-1">{unit ? `${v}${unit === '฿' ? '' : ' ' + unit}` : v}</div>
    </div>
  );
}

function MiniCard({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-gray-900 font-semibold mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</div>
      {children}
    </div>
  );
}

function StatusBadge({state}: {state: 'OK'|'MISMATCH'|'MISSING_DATA'}) {
  const cls = state === 'OK' ? 'bg-emerald-100 text-emerald-700'
    : state === 'MISSING_DATA' ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{state}</span>;
}

// Simple revenue visualization
function RevenueChart({payments}: {payments?: Array<{channel: string; totalTHB: number}>}) {
  if (!payments || payments.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-500">
        <div>No payment data available</div>
      </div>
    );
  }

  const total = payments.reduce((sum, p) => sum + p.totalTHB, 0);
  
  return (
    <div className="space-y-3">
      {payments.map((payment, i) => {
        const percentage = total > 0 ? (payment.totalTHB / total) * 100 : 0;
        return (
          <div key={payment.channel} className="flex items-center justify-between">
            <div className="text-sm font-medium">{payment.channel}</div>
            <div className="flex items-center gap-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-teal-600 h-2 rounded-full" 
                  style={{width: `${percentage}%`}}
                />
              </div>
              <div className="text-sm text-gray-600">{currency(payment.totalTHB)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardModern() {
  const [period, setPeriod] = useState("Latest Shift");

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/latest'],
    queryFn: () => fetch('/api/dashboard/latest').then(res => res.json()) as Promise<DashboardDTO>,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    if (!data?.snapshot) return [];
    
    const snapshot = data.snapshot;
    const totalPayments = snapshot.payments?.reduce((sum, p) => sum + p.totalTHB, 0) || 0;
    const totalOrders = snapshot.totalReceipts || 0;
    const avgOrderValue = totalOrders > 0 ? totalPayments / totalOrders : 0;
    
    return [
      { label: "Total Sales", value: totalPayments, unit: "฿" },
      { label: "Orders", value: totalOrders },
      { label: "Avg Order", value: avgOrderValue, format: (n: number) => currency(n).replace('THB', '฿') },
      { label: "Status", value: 0, format: () => snapshot.reconcileState },
    ];
  }, [data]);

  // Process top items for display
  const bestSellers = useMemo(() => {
    if (!data?.topItems) return [];
    return data.topItems.slice(0, 4).map(item => ({
      name: item.itemName,
      quantity: item.qty,
      revenue: item.revenueTHB,
      price: item.qty > 0 ? item.revenueTHB / item.qty : 0
    }));
  }, [data]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f7f8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold">Failed to load dashboard</div>
          <div className="text-gray-500 text-sm mt-1">Check your connection and try again</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8]" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <main className="p-4 md:p-6">
        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold tracking-tight">Good morning, Cam</div>
            <div className="text-gray-500 text-sm">Real-time operational insights from Smash Brothers Burgers</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <select 
                value={period} 
                onChange={e => setPeriod(e.target.value)} 
                className="border rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option>Latest Shift</option>
                <option>Previous Shift</option>
                <option>This Week</option>
                <option>This Month</option>
              </select>
              <button className="rounded-xl bg-teal-600 text-white text-sm px-4 py-2 hover:bg-teal-700 transition">
                Download Report
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Balance</div>
              <div className="text-teal-700 font-semibold">
                {data?.balance ? currency(data.balance.staff.closingCashTHB) : 'Loading...'}
              </div>
              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                C
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl bg-gray-200 animate-pulse h-24"></div>
            ))}
          </div>
        )}

        {/* Metrics row */}
        {!isLoading && metrics.length > 0 && (
          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {metrics.map(m => (
              <StatCard 
                key={m.label} 
                label={m.label} 
                value={m.value} 
                unit={m.unit} 
                format={m.format} 
              />
            ))}
          </section>
        )}

        {/* Revenue + Promo + Best Seller */}
        {!isLoading && (
          <section className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
            <MiniCard title="Payment Breakdown">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <div>Current shift data</div>
                {data?.snapshot && (
                  <StatusBadge state={data.snapshot.reconcileState} />
                )}
              </div>
              <div className="rounded-2xl border bg-white p-3">
                <RevenueChart payments={data?.snapshot?.payments} />
              </div>
            </MiniCard>

            <div className="xl:col-span-1">
              <div className="rounded-2xl p-5 h-full bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow">
                <div className="text-lg font-semibold">Live POS Integration</div>
                <div className="text-sm text-orange-50 mt-1">
                  Real-time data from Loyverse POS system with automated reconciliation
                </div>
                <button className="mt-4 bg-white/10 hover:bg-white/20 transition rounded-xl px-4 py-2 text-sm border border-white/30">
                  View Details
                </button>
              </div>
            </div>

            <MiniCard title="Top Sellers">
              {bestSellers.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {bestSellers.map((item) => (
                    <div key={item.name} className="rounded-xl border p-3 bg-white">
                      <div className="rounded-md bg-gradient-to-br from-teal-100 to-teal-200 h-16 mb-2 flex items-center justify-center">
                        <div className="text-teal-700 text-xs font-medium">
                          {item.quantity}x
                        </div>
                      </div>
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-gray-500">Qty: {fmt(item.quantity)}</div>
                      <div className="text-teal-700 font-semibold mt-1">{currency(item.revenue)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-sm">No sales data available</div>
                  <div className="text-xs text-gray-400 mt-1">Data will appear when orders are processed</div>
                </div>
              )}
            </MiniCard>
          </section>
        )}

        {/* System Status */}
        {data?.snapshot && (
          <section className="mt-6">
            <MiniCard title="System Status">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-teal-600">{data.snapshot.totalReceipts}</div>
                  <div className="text-sm text-gray-600">Total Receipts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-teal-600">
                    {currency(data.snapshot.totalSalesTHB)}
                  </div>
                  <div className="text-sm text-gray-600">Revenue (POS)</div>
                </div>
                <div className="text-center">
                  <StatusBadge state={data.snapshot.reconcileState} />
                  <div className="text-sm text-gray-600 mt-1">Reconciliation</div>
                </div>
              </div>
            </MiniCard>
          </section>
        )}
      </main>
    </div>
  );
}