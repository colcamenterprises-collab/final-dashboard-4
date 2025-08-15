import { useState } from "react";
import ManagerChecklistStatusCard from "@/components/ManagerChecklistStatusCard";

const fmt = (n:number, d=0)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:d}).format(n);

const KPIS = [
  { label: "Total sales", value: 321000, prefix: "฿" },
  { label: "Orders", value: 22000 },
  { label: "Avg order", value: 789, prefix: "฿" },
  { label: "Status", value: "OK" },
];

const payments = [
  { method: "CASH", amount: 3457 },
  { method: "OTHER", amount: 4210 },
];

const best = [
  { name: "Ultimate Double", price: 2100, qty: 9 },
  { name: "Cheesy Bacon", price: 833, qty: 7 },
  { name: "Single Smash", price: 824, qty: 5 },
  { name: "Sweet Potato Fries", price: 396, qty: 4 },
  { name: "Classic Burger", price: 550, qty: 3 },
];

export default function DashboardModern() {
  const [period, setPeriod] = useState("This year");
  const payTotal = payments.reduce((a,b)=>a+b.amount,0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good morning Cam 👋</h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening with your restaurant today</p>
        </div>
        <div className="flex items-center gap-4">
          <select value={period} onChange={e=>setPeriod(e.target.value)} className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white">
            <option>This year</option><option>This month</option><option>Last 7 days</option><option>Yesterday</option>
          </select>
          <button className="rounded-lg bg-emerald-600 text-white text-sm px-4 py-2 font-medium">Download report</button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Your balance</span>
            <span className="text-emerald-700 font-semibold">฿566.55</span>
            <div className="w-8 h-8 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>

      {/* Main KPI Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white">
        <div className="grid grid-cols-4 gap-8">
          {KPIS.map((k,i)=>(
            <div key={i} className="text-center">
              <div className="text-sm opacity-90 mb-1">{k.label}</div>
              <div className="text-2xl font-bold">
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
            <h3 className="text-lg font-semibold text-gray-900">Summary Revenue</h3>
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
        {/* Orange promo */}
        <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 text-white p-6">
          <h3 className="text-lg font-semibold mb-2">Need more information?</h3>
          <p className="text-sm text-orange-100 mb-4">Present information in a visually appealing way</p>
          <button className="rounded-lg bg-white/20 hover:bg-white/30 px-4 py-2 text-sm font-medium">
            See more →
          </button>
        </div>

        {/* Additional card placeholder */}
        <div className="rounded-2xl bg-white shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm">
              Daily Sales Form
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm">
              Stock Management
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 text-sm">
              Recipe Management
            </button>
          </div>
        </div>
      </div>

      {/* Top 5 Menu Items */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top 5 Menu Items</h3>
          <button className="text-sm text-gray-500 hover:text-gray-700">→</button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="rounded-lg border border-gray-100 p-3 hover:shadow-sm transition-shadow">
              <div className="w-12 h-12 rounded-md bg-gray-100 mx-auto mb-2 flex items-center justify-center overflow-hidden">
                <img 
                  src={`https://picsum.photos/seed/menu${item}/100/100`} 
                  alt={`Menu item ${item}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-900 truncate">Item {item}</div>
                <div className="text-xs text-gray-500">#{item}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}