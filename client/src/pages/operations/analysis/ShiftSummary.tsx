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
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900">Shift Summary</h1>
        <div className="flex gap-3">
          <input type="date" className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 text-sm" value={date} onChange={e=>setDate(e.target.value)} />
          <input type="file" multiple accept=".csv" onChange={e=>setFiles(e.target.files)} className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 text-sm" />
          <button onClick={onUpload} disabled={loading || !files?.length} className="bg-teal-600 text-white rounded-xl px-4 py-2 text-sm">
            {loading ? "Processing…" : "Upload & Analyze"}
          </button>
        </div>
      </div>

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
    </div>
  );
}