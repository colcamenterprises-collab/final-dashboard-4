import React, { useState, useMemo } from 'react';
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

  // Calculate metrics from real data matching your design
  const metrics = useMemo(() => {
    if (!data?.snapshot) return [
      { key: "totalSales", label: "TOTAL SALES", value: 0, prefix: "฿" },
      { key: "orders", label: "ORDERS", value: 0 },
      { key: "avgOrder", label: "AVG ORDER", value: 0, prefix: "฿" },
      { key: "status", label: "STATUS", value: "NO DATA" },
    ];
    
    const snapshot = data.snapshot;
    const totalSales = snapshot.payments?.reduce((sum, p) => sum + p.totalTHB, 0) || 0;
    const totalOrders = snapshot.totalReceipts || 0;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    return [
      { key: "totalSales", label: "TOTAL SALES", value: Math.round(totalSales), prefix: "฿" },
      { key: "orders", label: "ORDERS", value: totalOrders },
      { key: "avgOrder", label: "AVG ORDER", value: Math.round(avgOrderValue), prefix: "฿" },
      { key: "status", label: "STATUS", value: snapshot.reconcileState },
    ];
  }, [data]);

  // Process top items for display matching your design format
  const sellers = useMemo(() => {
    if (!data?.topItems) return [
      { qty: 0, name: "No data", price: 0 },
      { qty: 0, name: "No data", price: 0 },
      { qty: 0, name: "No data", price: 0 },
      { qty: 0, name: "No data", price: 0 },
    ];
    return data.topItems.slice(0, 4).map(item => ({
      qty: item.qty,
      name: item.itemName,
      price: item.revenueTHB
    }));
  }, [data]);

  // Process payment data for your design
  const payments = useMemo(() => {
    if (!data?.snapshot?.payments) return [
      { method: "CASH", amount: 0 },
      { method: "OTHER", amount: 0 },
    ];
    
    const cashPayment = data.snapshot.payments.find(p => p.channel === 'CASH');
    const otherPayments = data.snapshot.payments.filter(p => p.channel !== 'CASH');
    const otherTotal = otherPayments.reduce((sum, p) => sum + p.totalTHB, 0);
    
    return [
      { method: "CASH", amount: cashPayment?.totalTHB || 0 },
      { method: "OTHER", amount: otherTotal },
    ];
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

        {/* Metric Pills - Your Design */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(m => (
            <div key={m.key} className="rounded-2xl bg-teal-600 text-white px-6 py-5 shadow-md flex items-center justify-between">
              <div>
                <div className="text-teal-100 text-xs tracking-wide">{m.label}</div>
                {m.key !== "status" ? (
                  <div className="text-3xl font-semibold tabular-nums mt-1">{m.prefix || ""}{fmt(m.value)}</div>
                ) : (
                  <div className="text-3xl font-extrabold mt-1">{m.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid: Payments | Orange Promo | Top Sellers - Your Exact Design */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Payment Breakdown */}
          <div className="rounded-2xl bg-white border p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Payment Breakdown</h3>
              <StatusBadge state={data?.snapshot?.reconcileState || 'MISSING_DATA'} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Current shift data</p>
            <div className="mt-4 space-y-4">
              {payments.map(p => {
                const total = payments.reduce((a,b) => a + b.amount, 0);
                const pct = total > 0 ? (p.amount / total) * 100 : 0;
                return (
                  <div key={p.method} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{p.method}</span>
                      <span className="text-gray-900 font-semibold">฿{fmt(p.amount)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${Math.max(0, Math.min(100, pct))}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Orange Promo */}
          <div className="rounded-2xl p-6 bg-gradient-to-r from-orange-400 to-orange-500 text-white">
            <div className="text-xl font-semibold">Live POS Integration</div>
            <p className="text-sm text-orange-50 mt-1">Real-time data from Loyverse POS system with automated reconciliation</p>
            <button className="mt-5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 px-4 py-2 text-sm">View Details</button>
          </div>

          {/* Top Sellers */}
          <div className="rounded-2xl bg-white border p-5">
            <h3 className="font-semibold text-gray-900">Top Sellers</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {sellers.map((s, idx) => (
                <div key={idx} className="rounded-2xl border bg-white p-3">
                  <div className="relative rounded-xl bg-[#ccfbf1] h-28 mb-3 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                      <div className="text-teal-700 text-sm font-medium">SBB</div>
                    </div>
                    <span className="absolute top-2 left-2 bg-white/90 text-teal-700 text-xs font-semibold rounded-md px-2 py-1">{s.qty}x</span>
                  </div>
                  <div className="text-sm font-medium truncate" title={s.name}>{s.name}</div>
                  <div className="text-xs text-gray-500">Qty: {s.qty}</div>
                  <div className="text-teal-700 font-semibold mt-1">฿{fmt(s.price)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Status Row - Your Exact Design */}
        <div className="mt-6 rounded-2xl bg-white border p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-teal-700 text-2xl font-semibold tabular-nums">{fmt(metrics[1].value)}</div>
              <div className="text-sm text-gray-500">Total Receipts</div>
            </div>
            <div>
              <div className="text-teal-700 text-2xl font-semibold tabular-nums">฿{fmt(metrics[0].value)}</div>
              <div className="text-sm text-gray-500">Revenue (POS)</div>
            </div>
            <div>
              <StatusBadge state={data?.snapshot?.reconcileState || 'MISSING_DATA'} />
              <div className="text-sm text-gray-500 mt-1">Reconciliation</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}