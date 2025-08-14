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
    <div className="min-h-screen bg-[#f5f7f8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="px-8 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Daily Sales Library</h1>
          <p className="text-sm text-gray-600">Comprehensive management of all daily sales submissions</p>
        </div>

        {/* Filters Section */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
              <input 
                type="date" 
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                value={from} 
                onChange={e => setFrom(e.target.value)} 
              />
              <span className="text-sm text-gray-500">to</span>
              <input 
                type="date" 
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                value={to} 
                onChange={e => setTo(e.target.value)} 
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Staff:</label>
              <input 
                type="text" 
                placeholder="Search by staff name..." 
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                value={staff} 
                onChange={e => setStaff(e.target.value)} 
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={varianceOnly} 
                  onChange={e => setVarianceOnly(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                /> 
                <span className="text-gray-700">Variance only</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={hasAttach} 
                  onChange={e => setHasAttach(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                /> 
                <span className="text-gray-700">With attachments</span>
              </label>
            </div>

            <button 
              className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors" 
              onClick={fetchRows}
            >
              {loading ? "Loading..." : "Apply Filters"}
            </button>
            
            <a 
              className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors text-gray-700" 
              href={`/api/daily-sales/export.csv?from=${from}&to=${to}`}
            >
              Export CSV
            </a>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Date", "Completed By", "Cash Start", "Total Sales", "Total Expenses", "Ending Cash", "Cash Banked", "QR Transferred", "Variance", "Email", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.completedBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.startingCash)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.totalSales)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.totalExpenses)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.closingCash)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.cashBanked)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{THB(r.qrTransferred)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${Math.abs(r.variance) > 20 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                        {THB(r.variance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        className="text-sm text-teal-600 hover:text-teal-900 font-medium" 
                        onClick={async () => {
                          await fetch(`/api/daily-sales/${r.id}/resend-email`, {method: "POST"});
                          alert("Email sent");
                        }}
                      >
                        Resend
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <a className="text-sm text-teal-600 hover:text-teal-900 font-medium" href={`/operations/daily-sales/view?id=${r.id}`}>View</a>
                        <a className="text-sm text-teal-600 hover:text-teal-900 font-medium" href={`/operations/analysis/shift-summary?date=${r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : ''}`}>Shift Summary</a>
                        <a className="text-sm text-teal-600 hover:text-teal-900 font-medium" href={`/operations/stock?shiftId=${r.id}`}>Stock</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={11}>
                      No daily sales records found. Try adjusting your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}