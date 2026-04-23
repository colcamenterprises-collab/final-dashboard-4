import { Settings2 } from "lucide-react";

export default function StaffOpsSettings() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Settings2 className="w-6 h-6 text-slate-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operations Settings</h1>
          <p className="text-xs text-slate-500">Operating hours, break rules, shift templates, work areas</p>
        </div>
      </div>
      <div className="border border-slate-200 rounded-lg bg-white p-6 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-600 mb-1">Settings UI — Phase 2</p>
        <p className="text-xs">Backend ready: <code className="bg-slate-100 px-1 rounded">GET /api/operations/staff/settings</code></p>
      </div>
    </div>
  );
}
