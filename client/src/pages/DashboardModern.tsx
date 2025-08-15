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
];

export default function DashboardModern() {
  const [period, setPeriod] = useState("This year");
  const payTotal = payments.reduce((a,b)=>a+b.amount,0);

  return (
    <div className="px-5 sm:px-8 py-6" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Good morning, Cam</h1>
          <p className="text-sm text-gray-500">Real-time operational insights from Smash Brothers Burgers</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={period} onChange={e=>setPeriod(e.target.value)} className="border rounded-full px-4 py-2 text-sm bg-white">
              <option>This year</option><option>This month</option><option>Last 7 days</option><option>Yesterday</option>
            </select>
            <button className="rounded-full bg-emerald-600 text-white text-sm px-5 py-2">Download report</button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-600">Your balance</span>
            <span className="text-emerald-700 font-semibold">฿566.55</span>
            <div className="w-8 h-8 rounded-full bg-gray-300" />
          </div>
        </div>
      </div>

      {/* KPI row (rounded banner look) */}
      <div className="mt-6 rounded-3xl bg-white shadow-sm border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {KPIS.map(k => (
            <div key={k.label} className="rounded-2xl bg-emerald-600 text-white px-5 py-4">
              <div className="text-emerald-100 text-xs">{k.label.toUpperCase()}</div>
              <div className="text-3xl font-semibold tabular-nums mt-1">
                {typeof k.value === "number" ? `${k.prefix ?? ""}${fmt(k.value)}` : k.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Manager Checklist Status */}
        <ManagerChecklistStatusCard />
        
        {/* Payments */}
        <div className="rounded-3xl bg-white shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Summary Revenue</h3>
            <div className="text-xs text-gray-500">Last update last week</div>
          </div>
          <div className="mt-4 rounded-2xl border p-4">
            <div className="text-sm text-gray-600 mb-2">Payment Breakdown</div>
            <div className="space-y-4">
              {payments.map(p=>(
                <div key={p.method}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{p.method}</span>
                    <span className="font-semibold">฿{fmt(p.amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-emerald-600" style={{ width: `${payTotal?(p.amount/payTotal)*100:0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orange promo */}
        <div className="rounded-3xl p-6 bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-sm">
          <div className="text-lg font-semibold">Need more information?</div>
          <div className="text-sm text-orange-50 mt-1">Present information in a visually appealing way</div>
          <button className="mt-5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 px-5 py-2 text-sm">See more</button>
        </div>

        {/* Best seller */}
        <div className="rounded-3xl bg-white shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Best Seller</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-4">
            {best.map((b,i)=>(
              <div key={i} className="rounded-2xl border p-3">
                <div className="relative rounded-xl bg-[#ccfbf1] h-24 mb-3 overflow-hidden">
                  <img src={`https://picsum.photos/seed/sbb${i}/300/200`} alt="" className="w-full h-full object-cover mix-blend-multiply opacity-80"/>
                  <span className="absolute top-2 left-2 bg-white/90 text-emerald-700 text-xs font-semibold rounded-md px-2 py-1">
                    {b.qty}x
                  </span>
                </div>
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-xs text-gray-500">Qty: {b.qty}</div>
                <div className="text-emerald-700 font-semibold mt-1">฿{fmt(b.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}