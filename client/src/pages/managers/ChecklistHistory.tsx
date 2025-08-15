import { useEffect, useState } from "react";

export default function ChecklistHistoryPage(){
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(()=>{
    (async()=>{
      const r = await fetch("/api/manager-checklist/history?limit=30");
      const data = await r.json();
      setRows(data.rows || []);
      setLoading(false);
    })();
  },[]);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Checklist History</h1>
      
      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Manager</th>
              <th className="px-4 py-3 text-left">Completed</th>
              <th className="px-4 py-3 text-left">Answers</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{r.dateISO}</td>
                <td className="px-4 py-3 font-medium">{r.managerName}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    ✓ Yes
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">
                    {r.answers?.filter((a:any)=>a.value).length || 0} yes, {r.answers?.filter((a:any)=>!a.value).length || 0} no
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.shiftNotes ? (
                    <span className="text-xs text-blue-600">+ Notes</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {r.completedAt && new Date(r.completedAt).toLocaleString('en-GB', {
                    timeZone: 'Asia/Bangkok',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={6}>No submissions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}