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
    <div className="rounded-3xl p-6 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm">
      <div className="text-lg font-semibold">Manager Checklist</div>
      <div className="text-sm text-emerald-50 mt-1">
        {data.completed ? "Completed for tonight" : "Pending completion"}
      </div>
      {data.completed && data.notesPresent && (
        <div className="text-sm text-emerald-50">Anonymous notes included</div>
      )}
      <button 
        onClick={() => window.location.href = '/managers/checklist'}
        className="mt-5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 px-5 py-2 text-sm"
      >
        {data.completed ? "View checklist" : "Complete checklist"}
      </button>
    </div>
  );
}