import React, { useEffect, useState } from "react";

type Task = { id: number; taskName: string; taskDetail?: string; zone: string; shiftPhase: string };

export default function ManagerChecklistModal({ shiftId, managerName, onComplete }: { shiftId: string; managerName: string; onComplete: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/checklists/random?zone=Kitchen&phase=End&count=4`)
      .then(r => r.json())
      .then(setTasks);
  }, []);

  const toggleTask = (id: number) => {
    setCompleted(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    await fetch("/api/checklists/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, managerName, tasksAssigned: tasks.map(t => t.id), tasksCompleted: completed })
    });
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Manager Checklist</h2>
        <ul className="space-y-2">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center">
              <input type="checkbox" checked={completed.includes(t.id)} onChange={() => toggleTask(t.id)} className="mr-2" />
              <span>{t.taskName}</span>
            </li>
          ))}
        </ul>
        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded" disabled={completed.length !== tasks.length} onClick={handleSubmit}>
          Confirm & Sign Off
        </button>
      </div>
    </div>
  );
}