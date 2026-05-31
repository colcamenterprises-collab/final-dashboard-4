import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShiftRoster {
  id: number;
  shiftDate: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  maxStaff: number;
  status: string;
  notes?: string;
}

interface RostersResponse {
  rosters?: ShiftRoster[];
}

interface AssignmentsResponse {
  assignments?: Array<{
    id: number;
    staffMemberId: number;
    scheduledStartTime: string;
    scheduledEndTime: string;
    primaryStation?: string;
    isOffDay: boolean;
  }>;
}

const STATUS_COLOURS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  published: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }); }
  catch { return s; }
}

export default function Roster() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [from, setFrom] = useState(sevenDaysAgo);
  const [to, setTo] = useState(today);

  const { data, isLoading, isError } = useQuery<RostersResponse>({
    queryKey: ["/api/staff/rosters", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/staff/rosters?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const assignmentQuery = useQuery<AssignmentsResponse>({
    queryKey: ["/api/staff/rosters", expandedId, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/staff/rosters/${expandedId}/assignments`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!expandedId,
  });

  const rosters = data?.rosters ?? [];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Weekly Roster</h1>
          <p className="text-xs text-slate-500">{rosters.length} shifts in range</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">From</label>
          <input
            type="date"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">To</label>
          <input
            type="date"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading rosters...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load rosters.</div>}

      {!isLoading && !isError && rosters.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <CalendarDays className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-400">No rosters found for this period.</p>
          <p className="text-[10px] text-slate-400">Use Staff Settings to configure templates and auto-generate rosters.</p>
        </div>
      )}

      {rosters.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {rosters.map((roster) => {
            const isOpen = expandedId === roster.id;
            const assignments = isOpen ? (assignmentQuery.data?.assignments ?? []) : [];
            return (
              <div key={roster.id} className="bg-white dark:bg-slate-900">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  onClick={() => setExpandedId(isOpen ? null : roster.id)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">{fmtDate(roster.shiftDate)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400">{roster.shiftStartTime}–{roster.shiftEndTime}</span>
                      <span className="text-[10px] text-slate-400">· {roster.shiftName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">max {roster.maxStaff}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_COLOURS[roster.status] ?? STATUS_COLOURS.draft}`}>
                      {roster.status}
                    </Badge>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                    {assignmentQuery.isLoading && <p className="text-xs text-slate-400">Loading assignments...</p>}
                    {assignments.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-semibold">{assignments.length} assignments</p>
                        {assignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="font-mono">{a.scheduledStartTime}–{a.scheduledEndTime}</span>
                            {a.primaryStation && <span>· {a.primaryStation}</span>}
                            {a.isOffDay && <span className="text-amber-500">Off</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      !assignmentQuery.isLoading && <p className="text-xs text-slate-400">No assignments on this roster.</p>
                    )}
                    {roster.notes && <p className="text-[10px] text-slate-500">{roster.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
