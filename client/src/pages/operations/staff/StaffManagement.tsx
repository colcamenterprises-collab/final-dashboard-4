import { Users } from "lucide-react";

export default function StaffManagement() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-slate-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-xs text-slate-500">Team directory, roles, capabilities and availability</p>
        </div>
      </div>
      <div className="border border-slate-200 rounded-lg bg-white p-6 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-600 mb-1">Staff Directory UI — Phase 2</p>
        <p className="text-xs">Backend ready: <code className="bg-slate-100 px-1 rounded">GET /api/operations/staff/members</code></p>
      </div>
    </div>
  );
}
