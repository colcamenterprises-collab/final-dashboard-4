import React, { useEffect, useState } from "react";

const THB = (n: number) => new Intl.NumberFormat("th-TH", {style: "currency", currency: "THB", maximumFractionDigits: 0}).format(n || 0);

export default function DailySalesLibrary() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [staff, setStaff] = useState<string>("");
  const [varianceOnly, setVarianceOnly] = useState(false);
  const [hasAttach, setHasAttach] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (staff) params.append("staff", staff);
    if (varianceOnly) params.append("variance", "only");
    if (hasAttach) params.append("hasAttach", "1");
    const r = await fetch(`/api/daily-sales?${params.toString()}`);
    const j = await r.json();
    setRows(j.rows || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  return (
    <div className="bg-gray-50 min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900">Daily Sales Library</h1>
        <div className="flex gap-2">
          <input 
            type="date" 
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm" 
            value={from} 
            onChange={e => setFrom(e.target.value)} 
          />
          <span className="text-sm self-center">to</span>
          <input 
            type="date" 
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm" 
            value={to} 
            onChange={e => setTo(e.target.value)} 
          />
          <input 
            type="text" 
            placeholder="Staff…" 
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm" 
            value={staff} 
            onChange={e => setStaff(e.target.value)} 
          />
          <label className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={varianceOnly} 
              onChange={e => setVarianceOnly(e.target.checked)}
            /> 
            Variance only
          </label>
          <label className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={hasAttach} 
              onChange={e => setHasAttach(e.target.checked)}
            /> 
            With attachments
          </label>
          <button 
            className="bg-teal-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-teal-700" 
            onClick={fetchRows}
          >
            {loading ? "Loading…" : "Apply"}
          </button>
          <a 
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm hover:bg-gray-50" 
            href={`/api/daily-sales/export.csv?from=${from}&to=${to}`}
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-0 overflow-auto">
        <table className="min-w-[1100px] w-full">
          <thead className="sticky top-0 bg-white">
            <tr>
              {["Date", "Completed By", "Cash Start", "Total Sales", "Total Expenses", "Ending Cash", "Cash Banked", "QR Transferred", "Variance", "Email", "Actions"].map(h => (
                <th key={h} className="p-3 text-left text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="p-3">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</td>
                <td className="p-3">{r.completedBy}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.startingCash)}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.totalSales)}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.totalExpenses)}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.closingCash)}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.cashBanked)}</td>
                <td className="p-3 text-right tabular-nums">{THB(r.qrTransferred)}</td>
                <td className="p-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${Math.abs(r.variance) > 20 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                    {THB(r.variance)}
                  </span>
                </td>
                <td className="p-3">
                  <button 
                    className="text-sm text-teal-600 hover:text-teal-800 underline" 
                    onClick={async () => {
                      await fetch(`/api/daily-sales/${r.id}/resend-email`, {method: "POST"});
                      alert("Email sent");
                    }}
                  >
                    Resend
                  </button>
                </td>
                <td className="p-3">
                  <a className="text-sm text-teal-600 hover:text-teal-800 underline mr-2" href={`/operations/daily-sales/view?id=${r.id}`}>View</a>
                  <a className="text-sm text-teal-600 hover:text-teal-800 underline mr-2" href={`/operations/analysis/shift-summary?date=${r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : ''}`}>Shift Summary</a>
                  <a className="text-sm text-teal-600 hover:text-teal-800 underline" href={`/operations/stock?shiftId=${r.id}`}>Stock</a>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-6 text-center text-sm text-gray-500" colSpan={11}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}