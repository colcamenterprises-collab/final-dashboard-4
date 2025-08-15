import { useEffect, useState } from "react";
type Role = "kitchen" | "cashier";

export default function ChecklistHistory(){
  const [role, setRole] = useState<Role>("kitchen");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const r = await fetch(`/api/manager/history?role=${role}&limit=30`);
        const data = await r.json();
        setRows(data.list || []);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    })();
  },[role]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Checklist History</h1>
        <select value={role} onChange={e=>setRole(e.target.value as Role)} className="border rounded-lg px-3 py-2">
          <option value="kitchen">Kitchen</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>
      <div className="rounded-2xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading history...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Date (TH)</th>
                <th className="px-3 py-2 text-left">Manager</th>
                <th className="px-3 py-2 text-left">Completed</th>
                <th className="px-3 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r:any)=>(
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.dateISO}</td>
                  <td className="px-3 py-2">{r.managerName}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      r.items.filter((i:any)=>i.done).length === r.items.length 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {r.items.filter((i:any)=>i.done).length}/{r.items.length}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(r.completedAt).toLocaleString('en-GB', {
                      timeZone: 'Asia/Bangkok',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
              {rows.length===0 && (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No submissions</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}