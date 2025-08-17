import { useNavigate } from "react-router-dom";
import PageShell from "@/layouts/PageShell";

export default function NightlyChecklist() {
  const nav = useNavigate();
  
  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Nightly Checklist</h1>
        <div className="rounded-2xl border p-5 bg-white">
          <button 
            onClick={() => nav("/managers/nightly-checklist/run")}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            Start Checklist
          </button>
          <p className="text-sm text-neutral-500 mt-3">
            Randomized 5 tasks, photo on first, shift notes. Results go to Manager Summary email + Library.
          </p>
        </div>
      </div>
    </PageShell>
  );
}