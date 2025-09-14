/**
 * ⚠️ LOCKED FILE — Do not replace or refactor without Cam's written approval.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import React, { useEffect, useMemo, useState } from 'react';
import ManagerChecklistStatusCard from "@/components/ManagerChecklistStatusCard";

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

const fmt = (n: number) => n.toLocaleString();

// Sample data for display
const KPIS = [
  { label: "Total Orders", value: 1249, prefix: "" },
  { label: "Total Revenue", value: 89542, prefix: "฿" },
  { label: "Growth", value: "+12.5%", prefix: "" },
  { label: "Active Items", value: 32, prefix: "" }
];

const payments = [
  { method: "Cash", amount: 35420 },
  { method: "QR Code", amount: 28150 },
  { method: "Card", amount: 15970 },
  { method: "Grab/Food", amount: 10002 }
];

const best = [
  { name: "Classic Burger", qty: 45, price: 189 },
  { name: "Cheese Deluxe", qty: 38, price: 219 },
  { name: "BBQ Special", qty: 32, price: 249 }
];

export default function Overview() {
  const [period, setPeriod] = useState("This year");
  const payTotal = payments.reduce((a,b)=>a+b.amount,0);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main KPI Banner - Style Guide Primary */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white" style={{background: 'linear-gradient(to right, var(--primary), #1e4fa3)'}}>
        <div className="grid grid-cols-4 gap-8">
          {KPIS.map((k,i)=>(
            <div key={i} className="text-center">
              <div className="text-sm opacity-90 mb-1">{k.label}</div>
              <div className="text-2xl font-black tracking-tight">
                {typeof k.value === "number" ? `${k.prefix ?? ""}${fmt(k.value)}` : k.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Summary Revenue Chart */}
        <div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-medium text-gray-900">Summary Revenue</h3>
            <div className="text-xs text-gray-500">Last update last week</div>
          </div>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-gray-400">Chart placeholder</div>
          </div>
        </div>

        {/* Manager Checklist */}
        <ManagerChecklistStatusCard />
      </div>

      {/* Bottom row */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Warning Card - Style Guide Orange */}
        <div className="rounded-2xl text-white p-6" style={{background: 'linear-gradient(to bottom right, var(--warning), #b45309)'}}>
          <h3 className="text-xl font-medium mb-2">Need more information?</h3>
          <p className="text-sm text-orange-100 mb-4">Present information in a visually appealing way</p>
          <button className="btn-secondary rounded-lg bg-white/20 hover:bg-white/30 px-4 py-2 text-sm font-medium transition-all">
            See more →
          </button>
        </div>

        {/* Additional card placeholder */}
        <div className="rounded-2xl bg-white shadow-sm border p-6">
          <h3 className="text-xl font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="btn-secondary w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm transition-all">
              Daily Sales Form
            </button>
            <button className="btn-secondary w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm transition-all">
              Stock Management
            </button>
            <button className="btn-secondary w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm transition-all">
              Recipe Management
            </button>
          </div>
        </div>
      </div>

      {/* Best Seller */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium text-gray-900">Best Seller</h3>
          <button className="text-sm text-gray-500 hover:text-gray-700">→</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {best.slice(0, 3).map((b,i)=>(
            <div key={i} className="rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
              <div className="w-16 h-16 rounded-lg bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                <div className="w-8 h-8 bg-gray-300 rounded"></div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 truncate">{b.name}</div>
                <div className="text-xs text-gray-500 mt-1">{b.qty}x</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}