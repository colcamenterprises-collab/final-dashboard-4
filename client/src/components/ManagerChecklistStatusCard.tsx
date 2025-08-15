import { useEffect, useState } from "react";

export default function ManagerChecklistStatusCard(){
  const [data, setData] = useState<{completed:boolean; completedAtISO:string|null; notesPresent:boolean} | null>(null);

  useEffect(()=> {
    const date = new Date().toISOString().split('T')[0];
    fetch(`/api/manager-checklist/status?date=${date}`)
      .then(r=>r.json())
      .then(setData)
      .catch(()=>setData(null));
  }, []);

  if (!data) return null;

  return (
    <div className="rounded-2xl bg-white shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Manager Checklist</h3>
        <div className={`w-3 h-3 rounded-full ${data.completed ? 'bg-emerald-500' : 'bg-orange-400'}`} />
      </div>
      
      <div className="mb-4">
        {data.completed ? (
          <div>
            <div className="text-sm text-emerald-700 font-medium">✅ Completed</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.completedAtISO && new Date(data.completedAtISO).toLocaleTimeString()}
            </div>
            {data.notesPresent && (
              <div className="text-xs text-gray-500">+ Anonymous notes included</div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-sm text-orange-700 font-medium">⏳ Pending</div>
            <div className="text-xs text-gray-500 mt-1">Not completed yet</div>
          </div>
        )}
      </div>
      
      <button 
        onClick={() => window.location.href = '/managers/checklist'}
        className="w-full rounded-lg bg-emerald-600 text-white text-sm py-2 font-medium hover:bg-emerald-700"
      >
        {data.completed ? "View checklist" : "Complete checklist"}
      </button>
    </div>
  );
}