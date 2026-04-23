import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, CalendarDays, ClipboardList, Layers, Clock, CheckCircle2,
  AlertCircle, Plus, ChevronRight, Settings
} from "lucide-react";

type StaffMember = { id: number; isActive: boolean };
type ShiftRoster = { id: number; shiftDate: string; shiftName: string; status: string; shiftStartTime: string; shiftEndTime: string };
type DeepCleanTask = { id: number; taskName: string; dueDate: string; status: string };
type CleaningTemplate = { id: number; isActive: boolean };

function todayBkk() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getWeekDates() {
  const today = new Date(todayBkk());
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-500",
};

export default function StaffOpsDashboard() {
  const today = todayBkk();
  const weekDates = getWeekDates();

  const { data: members = [] } = useQuery<StaffMember[]>({ queryKey: ["/api/operations/staff/members"] });
  const { data: rosters = [] } = useQuery<ShiftRoster[]>({
    queryKey: ["/api/operations/staff/rosters", weekDates[0], weekDates[6]],
    queryFn: () =>
      fetch(`/api/operations/staff/rosters?from=${weekDates[0]}&to=${weekDates[6]}`)
        .then(r => r.json()),
  });
  const { data: deepTasks = [] } = useQuery<DeepCleanTask[]>({ queryKey: ["/api/operations/staff/deep-cleaning"] });
  const { data: cleaningTemplates = [] } = useQuery<CleaningTemplate[]>({ queryKey: ["/api/operations/staff/cleaning/templates"] });

  const activeStaff = members.filter(m => m.isActive).length;
  const todayRosters = rosters.filter(r => r.shiftDate === today);
  const overdueDeep = deepTasks.filter(t => t.status !== "completed" && t.dueDate < today);
  const activeTemplates = cleaningTemplates.filter(t => t.isActive).length;

  const quickLinks = [
    { to: "/operations/staff/management", icon: Users, label: "Staff Management", color: "bg-blue-50 text-blue-600" },
    { to: "/operations/staff/roster", icon: CalendarDays, label: "Weekly Roster", color: "bg-violet-50 text-violet-600" },
    { to: "/operations/staff/attendance", icon: Clock, label: "Attendance", color: "bg-amber-50 text-amber-600" },
    { to: "/operations/staff/cleaning", icon: ClipboardList, label: "Daily Cleaning", color: "bg-teal-50 text-teal-600" },
    { to: "/operations/staff/deep-cleaning", icon: Layers, label: "Deep Cleaning", color: "bg-rose-50 text-rose-600" },
    { to: "/operations/staff/settings", icon: Settings, label: "Settings", color: "bg-slate-50 text-slate-600" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Staff Operations</h1>
          <p className="text-xs text-slate-500 mt-0.5">Overview for {new Date(today).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Link to="/operations/staff/roster"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New Roster
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Active Staff</p>
          <p className="text-2xl font-bold text-slate-900">{activeStaff}</p>
          <p className="text-xs text-slate-400 mt-0.5">{members.length} total registered</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Today's Rosters</p>
          <p className="text-2xl font-bold text-slate-900">{todayRosters.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{todayRosters.filter(r => r.status === "published").length} published</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Overdue Deep Cleans</p>
          <p className={`text-2xl font-bold ${overdueDeep.length > 0 ? "text-red-600" : "text-slate-900"}`}>{overdueDeep.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{deepTasks.filter(t => t.status !== "completed").length} total pending</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Cleaning Templates</p>
          <p className="text-2xl font-bold text-slate-900">{activeTemplates}</p>
          <p className="text-xs text-slate-400 mt-0.5">active daily tasks</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {quickLinks.map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to}
            className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-400 hover:shadow-sm transition-all">
            <div className={`w-9 h-9 rounded flex items-center justify-center ${color}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-medium text-slate-700 text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Today's Roster Preview */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Today's Rosters</h2>
          <Link to="/operations/staff/roster" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
            View week <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {todayRosters.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No rosters for today</p>
            <Link to="/operations/staff/roster"
              className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
              <Plus className="w-3 h-3" /> Create roster
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayRosters.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.shiftName}</p>
                  <p className="text-xs text-slate-500">{r.shiftStartTime} – {r.shiftEndTime}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Deep Cleaning Alert */}
      {overdueDeep.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">Overdue deep cleaning tasks</p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdueDeep.slice(0, 3).map(t => t.taskName).join(", ")}
              {overdueDeep.length > 3 && ` and ${overdueDeep.length - 3} more`}
            </p>
          </div>
          <Link to="/operations/staff/deep-cleaning"
            className="text-xs text-red-600 font-medium hover:underline whitespace-nowrap">
            View all
          </Link>
        </div>
      )}

      {/* This Week */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">This Week</h2>
          <span className="text-xs text-slate-400">{weekDates[0]} – {weekDates[6]}</span>
        </div>
        <div className="grid grid-cols-7 divide-x divide-slate-100">
          {weekDates.map(d => {
            const dayRosters = rosters.filter(r => r.shiftDate === d);
            const dayName = new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
            const isToday = d === today;
            return (
              <div key={d} className={`p-2 text-center min-h-[72px] ${isToday ? "bg-emerald-50" : ""}`}>
                <p className={`text-xs font-medium mb-1 ${isToday ? "text-emerald-700" : "text-slate-500"}`}>{dayName}</p>
                <p className={`text-xs ${isToday ? "text-emerald-600" : "text-slate-400"}`}>
                  {new Date(d + "T12:00:00").getDate()}
                </p>
                {dayRosters.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {dayRosters.map(r => (
                      <div key={r.id} className={`w-full h-1.5 rounded-full ${r.status === "published" ? "bg-emerald-400" : "bg-slate-200"}`} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 w-full h-1.5 rounded-full bg-slate-100" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
