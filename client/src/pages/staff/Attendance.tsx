import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AttendanceLog {
  id: number;
  staffMemberId: number;
  shiftDate: string;
  status?: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

interface AttendanceResponse {
  logs?: AttendanceLog[];
}

const STATUS_COLOURS: Record<string, string> = {
  present: "bg-green-100 text-green-700 border-green-200",
  absent: "bg-red-100 text-red-600 border-red-200",
  late: "bg-amber-100 text-amber-700 border-amber-200",
  excused: "bg-blue-100 text-blue-700 border-blue-200",
};

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }); }
  catch { return s; }
}

export default function Attendance() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const { data, isLoading, isError } = useQuery<AttendanceResponse>({
    queryKey: ["/api/staff/attendance", date],
    queryFn: async () => {
      const res = await fetch(`/api/staff/attendance?date=${date}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <UserCheck className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Attendance</h1>
          <p className="text-xs text-slate-500">Shift check-in/check-out logs</p>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-slate-500 block mb-1">Filter by Date</label>
        <input
          type="date"
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading attendance...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load attendance.</div>}
      {!isLoading && !isError && logs.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-xs">No attendance records for {fmtDate(date)}.</div>
      )}

      {logs.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900">
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-white">Staff #{log.staffMemberId}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                  {log.checkInTime && <span>In: {log.checkInTime}</span>}
                  {log.checkOutTime && <span>Out: {log.checkOutTime}</span>}
                </div>
                {log.notes && <p className="text-[10px] text-slate-400 mt-0.5">{log.notes}</p>}
              </div>
              {log.status && (
                <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_COLOURS[log.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {log.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
