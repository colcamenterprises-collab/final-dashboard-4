import React, { useEffect, useState } from "react";

type Task = { id: number; taskName: string; taskDetail?: string; zone: string; shiftPhase: string };

export default function ManagerChecklistModal({ shiftId, managerName, onComplete }: { shiftId: string; managerName: string; onComplete: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Fort Knox: Fetch tasks with server-side assignment binding
    fetch(`/api/checklists/random?zone=Kitchen&phase=End&count=4&shiftId=${shiftId}&managerName=${encodeURIComponent(managerName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setTasks(data.tasks || []);
        setAssignmentId(data.assignmentId || "");
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load tasks");
        setLoading(false);
      });
  }, [shiftId, managerName]);

  const toggleTask = (id: number) => {
    setCompleted(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      setError("No assignment ID available");
      return;
    }
    
    try {
      const response = await fetch("/api/checklists/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, tasksCompleted: completed.map(id => ({ id })) })
      });
      
      const result = await response.json();
      if (result.error) {
        setError(result.error);
        return;
      }
      
      onComplete();
    } catch (err) {
      setError("Failed to submit checklist");
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Manager Checklist</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="text-xs text-gray-500 mb-2">
          Assignment ID: {assignmentId}
        </div>
        
        <ul className="space-y-2">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center">
              <input type="checkbox" checked={completed.includes(t.id)} onChange={() => toggleTask(t.id)} className="mr-2" />
              <span>{t.taskName}</span>
            </li>
          ))}
        </ul>
        
        <button 
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400" 
          disabled={completed.length !== tasks.length || !assignmentId || !!error} 
          onClick={handleSubmit}
        >
          Confirm & Sign Off ({completed.length}/{tasks.length})
        </button>
      </div>
    </div>
  );
}