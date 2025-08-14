import React, { useMemo, useState } from "react";

type Summary = {
  dateLocal: string;
  summary: {
    kpis: any;
    paymentBreakdown: Record<string, number>;
    topItems: { itemName: string; qty: number; gross: number }[];
    allItems: { itemName: string; qty: number; gross: number }[];
  };
  daily: any | null;
  discrepancies: { level: "ok"|"info"|"warn"; field: string; message: string }[];
};

const THB = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(n||0);

export default function ShiftSummary(){
  const [files, setFiles] = useState<FileList | null>(null);
  const [date, setDate] = useState<string>("");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const onUpload = async ()=>{
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f=> fd.append("files", f));
    if (date) fd.append("date", date);
    setLoading(true);
    const resp = await fetch(`/api/analysis/shift-summary/upload${date?`?date=${date}`:""}`, { method: "POST", body: fd });
    const json = await resp.json();
    setLoading(false);
    if (!resp.ok) return alert(json.error || "Upload failed");
    setData(json);
  };

  const k = data?.summary?.kpis;
  const pay = data?.summary?.paymentBreakdown || {};

  return (
    <div className="bg-gray-50 min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily:"Poppins, sans-serif" }}>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900">Shift Summary</h1>
          <p className="text-gray-600 mt-1">Upload Loyverse CSV exports to analyze shift performance and cross-check with daily forms</p>
        </div>
        <div className="flex gap-3">
          <input type="date" className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 text-sm" value={date} onChange={e=>setDate(e.target.value)} />
          <input type="file" multiple accept=".csv" onChange={e=>setFiles(e.target.files)} className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 text-sm" />
          <button onClick={onUpload} disabled={loading || !files?.length} className="bg-teal-600 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Processing…" : "Upload & Analyze"}
          </button>
        </div>
      </div>

      {/* Instructions Card */}
      {!data && (
        <div className="bg-white border border-blue-200 rounded-2xl p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Use Shift Summary</h3>
              <div className="text-gray-700 space-y-2">
                <p>1. <strong>Export from Loyverse:</strong> Go to Reports → Sales → Export as CSV</p>
                <p>2. <strong>Select Date:</strong> Choose the shift date you want to analyze</p>
                <p>3. <strong>Upload Files:</strong> Select one or more CSV files from Loyverse</p>
                <p>4. <strong>Review Analysis:</strong> Get KPIs, payment breakdown, top items, and cross-checking results</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      {k && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[
            ["Gross Sales", THB(k.grossSales)],
            ["Net Sales", THB(k.netSales)],
            ["Refunds", THB(k.refunds)],
            ["Receipts", (k.totalReceipts||0).toString()],
            ["Members", (k.members||0).toString()],
            ["Grab Sales", THB(k.grabSales)],
            ["Aroi Dee Sales", THB(k.aroiDeeSales)],
            ["Burgers Sold", (k.burgersSold||0).toString()],
          ].map(([label,value])=>(
            <div key={label as string} className="rounded-2xl bg-white border p-5">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Payment breakdown */}
      {data && (
        <div className="card mt-6">
          <div className="card-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold">Payment Breakdown</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(pay).map(([label, amt])=>(
                <div key={label} className="border rounded-xl p-3 bg-white">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{label}</span>
                    <span className="text-gray-900 font-semibold">{THB(amt||0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden mt-2">
                    <div className="h-full bg-teal-600" style={{ width: `${Math.min(100, Math.max(0,(amt||0) / Math.max(1,(k?.grossSales||1)) * 100))}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top items */}
      {data?.summary?.topItems?.length ? (
        <div className="card mt-6">
          <div className="card-inner">
            <h3 className="text-[18px] font-semibold">Top 5 Items Sold</h3>
            <div className="mt-3 overflow-auto">
              <table className="min-w-[560px] w-full">
                <thead><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Gross</th></tr></thead>
                <tbody>
                  {data.summary.topItems.map((r,i)=>(
                    <tr key={i} className={i%2?"bg-gray-50/50":""}>
                      <td className="p-2">{r.itemName}</td>
                      <td className="p-2 text-right tabular-nums">{r.qty}</td>
                      <td className="p-2 text-right tabular-nums">{THB(r.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full items table */}
      {data?.summary?.allItems?.length ? (
        <div className="card mt-6">
          <div className="card-inner">
            <h3 className="text-[18px] font-semibold">All Items Sold</h3>
            <div className="mt-3 overflow-auto">
              <table className="min-w-[720px] w-full">
                <thead><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Gross</th></tr></thead>
                <tbody>
                  {data.summary.allItems.map((r,i)=>(
                    <tr key={i} className={i%2?"bg-gray-50/50":""}>
                      <td className="p-2">{r.itemName}</td>
                      <td className="p-2 text-right tabular-nums">{r.qty}</td>
                      <td className="p-2 text-right tabular-nums">{THB(r.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Discrepancies */}
      {data?.discrepancies?.length ? (
        <div className="card mt-6">
          <div className="card-inner">
            <h3 className="text-[18px] font-semibold">Discrepancies vs Daily Sales</h3>
            <ul className="mt-2 space-y-2">
              {data.discrepancies.map((d,idx)=>(
                <li key={idx} className={`p-3 rounded-xl border ${d.level==="warn"?"border-amber-300 bg-amber-50": d.level==="ok"?"border-green-300 bg-green-50":"border-gray-200 bg-white"}`}>
                  <div className="text-sm"><strong>{d.field}:</strong> {d.message}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Sample data showcase when no files uploaded */}
      {!data && (
        <div className="mt-6 space-y-6">
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Analysis Results</h3>
            <p className="text-gray-600 mb-4">Here's what you'll see after uploading your Loyverse CSV files:</p>
            
            {/* Sample KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {[
                ["Gross Sales", "₿15,007"],
                ["Net Sales", "₿14,767"],
                ["Total Receipts", "41"],
                ["Refunds", "₿240"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-gray-50 border p-4">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-xl font-semibold mt-1 text-gray-800">{value}</div>
                </div>
              ))}
            </div>

            {/* Sample top items */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Top Selling Items</h4>
              <div className="space-y-2">
                {[
                  ["Super Double Bacon and Cheese", "14 sold", "₿3,120"],
                  ["Single Smash Burger", "9 sold", "₿1,640"],
                  ["Single Meal Set", "9 sold", "₿2,191"],
                  ["Super Double Bacon & Cheese Set", "7 sold", "₿2,273"],
                  ["Sweet Potato Fries", "6 sold", "₿594"],
                ].map(([name, qty, sales]) => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="font-medium text-gray-700 text-sm">{name}</span>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{qty}</div>
                      <div className="text-xs text-gray-500">{sales}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample payment breakdown */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Payment Methods</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  ["GRAB", "₿10,310", 70],
                  ["Cash", "₿4,118", 28],
                  ["QR Code", "₿579", 2],
                ].map(([method, amount, percentage]) => (
                  <div key={method} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{method}</span>
                      <span className="text-gray-900 font-semibold">{amount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden mt-2">
                      <div className="h-full bg-teal-500" style={{ width: `${percentage}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Upload your Loyverse CSV exports (item sales, payment types, receipts, shifts) 
                to see real analysis with cross-checking against Daily Sales forms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}