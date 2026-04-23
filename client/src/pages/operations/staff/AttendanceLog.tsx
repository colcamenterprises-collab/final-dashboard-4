import { UserCheck } from "lucide-react";

export default function AttendanceLog() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <UserCheck className="w-6 h-6 text-slate-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance Log</h1>
          <p className="text-xs text-slate-500">Mark present, late, sick, absent, early departure and replacement flows</p>
        </div>
      </div>
      <div className="border border-slate-200 rounded-lg bg-white p-6 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-600 mb-1">Attendance Board — Phase 2</p>
        <p className="text-xs">Backend ready: <code className="bg-slate-100 px-1 rounded">POST /api/operations/staff/attendance/:id/mark-present</code></p>
      </div>
    </div>
  );
}
