import { Users, CalendarDays, ClipboardList, Layers, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const cards = [
  { to: "/operations/staff/management", icon: Users, label: "Staff Management", desc: "Manage team members, roles & capabilities" },
  { to: "/operations/staff/roster", icon: CalendarDays, label: "Weekly Roster", desc: "Plan and publish shift rosters" },
  { to: "/operations/staff/cleaning", icon: ClipboardList, label: "Daily Cleaning", desc: "Per-shift cleaning task allocation" },
  { to: "/operations/staff/deep-cleaning", icon: Layers, label: "Deep Cleaning", desc: "Scheduled deep cleaning tracker" },
  { to: "/operations/staff/attendance", icon: Sparkles, label: "Attendance Log", desc: "Mark attendance, lateness & replacements" },
  { to: "/operations/staff/settings", icon: ClipboardList, label: "Settings", desc: "Operating hours, break rules & shift templates" },
];

export default function StaffOpsDashboard() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff Operations</h1>
        <p className="text-sm text-slate-500 mt-1">Configure and manage your team, rosters, cleaning schedules and attendance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to}
            className="block border border-slate-200 rounded-lg p-5 hover:border-emerald-400 hover:shadow-sm transition-all bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-[4px] bg-slate-100 flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-xs text-amber-800">
        <strong>Phase 1 — Architecture Build.</strong> Backend, routes and navigation are live. Full UI is built in Phase 2.
      </div>
    </div>
  );
}
