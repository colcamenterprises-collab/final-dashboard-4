import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, UserX, Clock, AlertTriangle, LogOut, RefreshCw } from "lucide-react";
async function sapi(method: string, url: string, data?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}
import { useToast } from "@/hooks/use-toast";

type ShiftRoster = { id: number; shiftDate: string; shiftName: string; status: string; shiftStartTime: string; shiftEndTime: string };
type StaffMember = { id: number; fullName: string; isActive: boolean; primaryRole: string };
type ShiftAssignment = {
  id: number; shiftRosterId: number; staffMemberId: number;
  scheduledStartTime: string; scheduledEndTime: string;
  primaryStation: string | null; isPrepStarter: boolean;
};
type AttendanceLog = {
  id: number; shiftRosterId: number; shiftStaffAssignmentId: number; staffMemberId: number;
  attendanceStatus: string; replacementStaffId: number | null;
  latenessMinutes: number | null; clockInTime: string | null; clockOutTime: string | null;
  absenceReason: string | null; managerNotes: string | null;
};

function todayBkk() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); }

const STATUS_ICONS: Record<string, React.ReactNode> = {
  present: <UserCheck className="w-4 h-4 text-emerald-600" />,
  late: <Clock className="w-4 h-4 text-amber-500" />,
  sick: <AlertTriangle className="w-4 h-4 text-red-500" />,
  absent: <UserX className="w-4 h-4 text-red-600" />,
  left_early: <LogOut className="w-4 h-4 text-orange-500" />,
  replaced: <RefreshCw className="w-4 h-4 text-violet-500" />,
  expected: <Clock className="w-4 h-4 text-slate-400" />,
};

const STATUS_STYLE: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  late: "bg-amber-100 text-amber-700",
  sick: "bg-red-100 text-red-600",
  absent: "bg-red-200 text-red-700",
  left_early: "bg-orange-100 text-orange-700",
  replaced: "bg-violet-100 text-violet-700",
  expected: "bg-slate-100 text-slate-500",
};

const ATTENDANCE_STATUSES = [
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "sick", label: "Sick" },
  { key: "absent", label: "Absent" },
  { key: "left_early", label: "Left Early" },
];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type AttendanceModalState = {
  assignment: ShiftAssignment;
  existingLog?: AttendanceLog;
};

type ReplacementModalState = {
  log: AttendanceLog;
  assignment: ShiftAssignment;
};

export default function AttendanceLog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = todayBkk();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [attendanceModal, setAttendanceModal] = useState<AttendanceModalState | null>(null);
  const [replacementModal, setReplacementModal] = useState<ReplacementModalState | null>(null);

  // Local form state for attendance modal
  const [attStatus, setAttStatus] = useState("present");
  const [attClockIn, setAttClockIn] = useState("");
  const [attClockOut, setAttClockOut] = useState("");
  const [attLate, setAttLate] = useState("");
  const [attAbsenceReason, setAttAbsenceReason] = useState("");
  const [attNotes, setAttNotes] = useState("");
  const [replacementStaffId, setReplacementStaffId] = useState<number | null>(null);

  const { data: rosters = [], isLoading: loadingRosters } = useQuery<ShiftRoster[]>({
    queryKey: ["/api/operations/staff/rosters", selectedDate],
    queryFn: () => fetch(`/api/operations/staff/rosters?from=${selectedDate}&to=${selectedDate}`).then(r => r.json()),
  });
  const { data: members = [] } = useQuery<StaffMember[]>({ queryKey: ["/api/operations/staff/members"] });

  const { data: rosterDetail, isLoading: loadingDetail } = useQuery<{ assignments: ShiftAssignment[] }>({
    queryKey: ["/api/operations/staff/rosters", selectedRosterId, "detail"],
    queryFn: () => fetch(`/api/operations/staff/rosters/${selectedRosterId}`).then(r => r.json()),
    enabled: selectedRosterId !== null,
  });
  const { data: attendanceLogs = [] } = useQuery<AttendanceLog[]>({
    queryKey: ["/api/operations/staff/rosters", selectedRosterId, "attendance"],
    queryFn: () => fetch(`/api/operations/staff/rosters/${selectedRosterId}/attendance`).then(r => r.json()),
    enabled: selectedRosterId !== null,
  });

  const logAttendanceMut = useMutation({
    mutationFn: (d: object) => sapi("POST", `/api/operations/staff/rosters/${selectedRosterId}/attendance`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/operations/staff/rosters", selectedRosterId, "attendance"] });
      setAttendanceModal(null);
      toast({ title: "Attendance logged" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const updateLogMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      sapi("PATCH", `/api/operations/staff/attendance/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/operations/staff/rosters", selectedRosterId, "attendance"] });
      setAttendanceModal(null);
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const replaceMut = useMutation({
    mutationFn: ({ logId, replacementStaffId, notes }: { logId: number; replacementStaffId: number; notes?: string }) =>
      sapi("POST", `/api/operations/staff/attendance/${logId}/replace`, { replacementStaffId, notes: notes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/operations/staff/rosters", selectedRosterId, "attendance"] });
      setReplacementModal(null);
      toast({ title: "Replacement logged — original assignment preserved" });
    },
    onError: () => toast({ title: "Replace failed", variant: "destructive" }),
  });

  function openAttendanceModal(assignment: ShiftAssignment) {
    const existing = attendanceLogs.find(l => l.shiftStaffAssignmentId === assignment.id);
    setAttStatus(existing?.attendanceStatus ?? "present");
    setAttClockIn(existing?.clockInTime ?? assignment.scheduledStartTime);
    setAttClockOut(existing?.clockOutTime ?? assignment.scheduledEndTime);
    setAttLate(existing?.latenessMinutes?.toString() ?? "");
    setAttAbsenceReason(existing?.absenceReason ?? "");
    setAttNotes(existing?.managerNotes ?? "");
    setAttendanceModal({ assignment, existingLog: existing });
  }

  function submitAttendance() {
    const payload = {
      shiftStaffAssignmentId: attendanceModal!.assignment.id,
      staffMemberId: attendanceModal!.assignment.staffMemberId,
      attendanceStatus: attStatus,
      clockInTime: attClockIn || null,
      clockOutTime: attClockOut || null,
      latenessMinutes: attLate ? parseInt(attLate) : null,
      absenceReason: attAbsenceReason || null,
      managerNotes: attNotes || null,
    };
    if (attendanceModal!.existingLog) {
      updateLogMut.mutate({ id: attendanceModal!.existingLog.id, data: payload });
    } else {
      logAttendanceMut.mutate(payload);
    }
  }

  const assignments = rosterDetail?.assignments ?? [];
  const selectedRoster = rosters.find(r => r.id === selectedRosterId);

  const presentCount = attendanceLogs.filter(l => l.attendanceStatus === "present").length;
  const issueCount = attendanceLogs.filter(l => ["sick", "absent", "late"].includes(l.attendanceStatus)).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Attendance Log</h1>
        <p className="text-xs text-slate-500 mt-0.5">Mark attendance, lateness, sick leave and replacement workflows.</p>
      </div>

      {/* Date + Roster picker */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedRosterId(null); }}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        {loadingRosters ? (
          <span className="text-xs text-slate-400">Loading...</span>
        ) : rosters.length === 0 ? (
          <span className="text-xs text-slate-400">No rosters for this date</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {rosters.map(r => (
              <button key={r.id} onClick={() => setSelectedRosterId(r.id)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${selectedRosterId === r.id ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                {r.shiftName} ({r.shiftStartTime})
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRosterId === null ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Select a roster to manage attendance.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{assignments.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Assigned staff</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{presentCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Present</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold ${issueCount > 0 ? "text-red-600" : "text-slate-800"}`}>{issueCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Issues</p>
            </div>
          </div>

          {/* Attendance List */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-700">{selectedRoster?.shiftName} — Staff Attendance</p>
            </div>
            {loadingDetail ? (
              <div className="p-6 text-xs text-center text-slate-400">Loading...</div>
            ) : assignments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No staff assigned to this roster.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignments.map(a => {
                  const member = members.find(m => m.id === a.staffMemberId);
                  const log = attendanceLogs.find(l => l.shiftStaffAssignmentId === a.id);
                  const status = log?.attendanceStatus ?? "expected";
                  const needsReplacement = log && ["sick", "absent"].includes(log.attendanceStatus) && !log.replacementStaffId;
                  const replacedBy = log?.replacementStaffId ? members.find(m => m.id === log.replacementStaffId) : null;

                  return (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {member?.fullName.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-slate-800">{member?.fullName ?? `Staff #${a.staffMemberId}`}</p>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[status]}`}>
                              {STATUS_ICONS[status]} {status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {a.scheduledStartTime} – {a.scheduledEndTime}
                            {a.primaryStation && ` · ${a.primaryStation}`}
                            {log?.clockInTime && ` · In: ${log.clockInTime}`}
                            {log?.latenessMinutes && ` · ${log.latenessMinutes} min late`}
                          </p>
                          {replacedBy && (
                            <p className="text-xs text-violet-600 mt-0.5">Replaced by: {replacedBy.fullName}</p>
                          )}
                          {log?.absenceReason && (
                            <p className="text-xs text-slate-400 mt-0.5">Reason: {log.absenceReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openAttendanceModal(a)}
                            className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-600">
                            {log ? "Edit" : "Mark"}
                          </button>
                          {needsReplacement && (
                            <button onClick={() => { setReplacementModal({ log: log!, assignment: a }); setReplacementStaffId(null); }}
                              className="px-2.5 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700">
                              Find Cover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Attendance Modal */}
      {attendanceModal && (
        <Modal
          title={`Attendance — ${members.find(m => m.id === attendanceModal.assignment.staffMemberId)?.fullName ?? "Staff"}`}
          onClose={() => setAttendanceModal(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Status</p>
              <div className="grid grid-cols-3 gap-1.5">
                {ATTENDANCE_STATUSES.map(s => (
                  <button key={s.key} onClick={() => setAttStatus(s.key)}
                    className={`px-2 py-1.5 text-xs rounded border font-medium transition-colors ${attStatus === s.key ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Clock In</span>
                <input type="time" value={attClockIn} onChange={e => setAttClockIn(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Clock Out</span>
                <input type="time" value={attClockOut} onChange={e => setAttClockOut(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </label>
            </div>
            {["late"].includes(attStatus) && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Minutes late</span>
                <input type="number" value={attLate} onChange={e => setAttLate(e.target.value)} placeholder="0"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </label>
            )}
            {["sick", "absent"].includes(attStatus) && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Absence Reason</span>
                <input value={attAbsenceReason} onChange={e => setAttAbsenceReason(e.target.value)} placeholder="Optional"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </label>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Manager Notes</span>
              <input value={attNotes} onChange={e => setAttNotes(e.target.value)} placeholder="Optional"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAttendanceModal(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button onClick={submitAttendance} disabled={logAttendanceMut.isPending || updateLogMut.isPending}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {logAttendanceMut.isPending || updateLogMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Replacement Modal */}
      {replacementModal && (
        <Modal title="Find Replacement Cover" onClose={() => setReplacementModal(null)}>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800">
                <strong>{members.find(m => m.id === replacementModal.assignment.staffMemberId)?.fullName}</strong> is {replacementModal.log.attendanceStatus}.
                Select a replacement for {replacementModal.assignment.scheduledStartTime} – {replacementModal.assignment.scheduledEndTime}.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Select replacement staff</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {members.filter(m => m.isActive && m.id !== replacementModal.assignment.staffMemberId).map(m => (
                  <button key={m.id}
                    onClick={() => setReplacementStaffId(m.id)}
                    className={`w-full text-left px-3 py-2 text-xs rounded border transition-colors ${replacementStaffId === m.id ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
                    {m.fullName} <span className="text-slate-400">({m.primaryRole})</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setReplacementModal(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button
                disabled={!replacementStaffId || replaceMut.isPending}
                onClick={() => replacementStaffId && replaceMut.mutate({ logId: replacementModal.log.id, replacementStaffId })}
                className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50">
                {replaceMut.isPending ? "Logging..." : "Confirm Replacement"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
