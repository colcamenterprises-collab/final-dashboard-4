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
    <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-emerald-900">Manager Checklist</h3>
          <p className="text-sm text-emerald-700 mt-1">Tonight's status</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${data.completed ? 'bg-emerald-500' : 'bg-orange-400'}`} />
      </div>
      
      <div className="mt-3">
        {data.completed ? (
          <div>
            <div className="text-sm text-emerald-800 font-medium">✅ Completed</div>
            <div className="text-xs text-emerald-600 mt-1">
              {data.completedAtISO && new Date(data.completedAtISO).toLocaleTimeString()}
            </div>
            {data.notesPresent && (
              <div className="text-xs text-emerald-600">+ Anonymous notes included</div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-sm text-orange-800 font-medium">⏳ Pending</div>
            <div className="text-xs text-orange-600 mt-1">Not completed yet</div>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <a 
          href="/managers/checklist" 
          className="text-sm text-emerald-700 hover:text-emerald-800 underline font-medium"
        >
          {data.completed ? "View checklist" : "Complete checklist"}
        </a>
      </div>
    </div>
  );
}