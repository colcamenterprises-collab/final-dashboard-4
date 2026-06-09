import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays, ClipboardList, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface Blocker {
  code: string;
  message: string;
}

interface DashboardData {
  activeStaff?: number;
  recentRosters?: number;
  cleaningTemplates?: number;
  lastRosterDate?: string | null;
  error?: string;
  blockers?: Blocker[];
}

function StatCard({ icon: Icon, label, value, to, colour }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | undefined;
  to?: string;
  colour: string;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => to && navigate(to)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:shadow-sm transition-shadow w-full"
    >
      <div className={`w-8 h-8 rounded-lg ${colour} flex items-center justify-center mb-3`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value ?? "—"}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </button>
  );
}

export default function StaffDashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/staff/dashboard"],
  });

  const blockers = data?.blockers ?? [];

  const navItems = [
    { label: "Staff Members", description: "Manage your team", to: "/staff/members" },
    { label: "Weekly Roster", description: "View and edit rosters", to: "/staff/roster" },
    { label: "Cleaning Tasks", description: "Task templates and assignments", to: "/staff/cleaning" },
    { label: "Attendance", description: "Shift attendance logs", to: "/staff/attendance" },
    { label: "Settings", description: "Templates, work areas", to: "/staff/settings" },
  ];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Staff Operations</h1>
          <p className="text-xs text-slate-500">Smash Brothers Burgers — Location 1</p>
        </div>
      </div>

      {isError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Staff system unavailable</p>
            <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5">
              The staff operations tables may not be fully provisioned. Contact your administrator.
            </p>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-8 text-slate-400 text-xs">Loading...</div>}

      {!isLoading && !isError && blockers.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 rounded-lg">
          <p className="font-semibold">Data unavailable</p>
          {blockers.map((blocker) => (
            <p key={blocker.code}>{blocker.code}: {blocker.message}</p>
          ))}
        </div>
      )}

      {!isLoading && !isError && blockers.length === 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Users} label="Active Staff" value={data?.activeStaff} to="/staff/members" colour="bg-blue-500" />
          <StatCard icon={CalendarDays} label="Rosters (7d)" value={data?.recentRosters} to="/staff/roster" colour="bg-purple-500" />
          <StatCard icon={ClipboardList} label="Task Templates" value={data?.cleaningTemplates} to="/staff/cleaning" colour="bg-green-500" />
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {navItems.map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-white">{item.label}</p>
              <p className="text-[10px] text-slate-400">{item.description}</p>
            </div>
            <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
