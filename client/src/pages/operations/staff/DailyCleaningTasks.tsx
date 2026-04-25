import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Circle,
  RefreshCw,
  ClipboardList,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

async function sapi(method: string, url: string, data?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

type ShiftRoster = {
  id: number;
  shiftDate: string;
  shiftName: string;
  status: string;
  shiftStartTime: string;
  shiftEndTime: string;
};
type StaffMember = { id: number; fullName: string; isActive: boolean };
type CleaningTask = {
  id: number;
  shiftRosterId: number;
  cleaningTaskTemplateId: number;
  assignedStaffId: number | null;
  status: string;
  completedAt: string | null;
  notes: string | null;
  template?: {
    taskName: string;
    areaName: string;
    estimatedMinutes: number;
    timing: string | null;
    role: string | null;
    required: boolean;
  };
};

function todayBkk() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

const TIMING_ORDER = ['start_shift', 'during_shift', 'end_shift'] as const;
const TIMING_LABELS: Record<string, string> = {
  start_shift: 'Start of Shift',
  during_shift: 'During Shift',
  end_shift: 'End of Shift',
};
const TIMING_COLORS: Record<string, { header: string; dot: string }> = {
  start_shift: { header: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500' },
  during_shift: { header: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
  end_shift: { header: 'bg-slate-50 border-slate-200 text-slate-700', dot: 'bg-slate-400' },
};
const ROLE_LABELS: Record<string, string> = {
  manager: 'Mgr',
  cashier: 'Cash',
  kitchen: 'Kitchen',
  all: 'All',
};
const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-purple-100 text-purple-700',
  cashier: 'bg-sky-100 text-sky-700',
  kitchen: 'bg-orange-100 text-orange-700',
  all: 'bg-slate-100 text-slate-600',
};

export default function DailyCleaningTasks() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = todayBkk();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [assignModal, setAssignModal] = useState<CleaningTask | null>(null);

  const { data: rosters = [], isLoading: loadingRosters } = useQuery<ShiftRoster[]>({
    queryKey: ['/api/operations/staff/rosters', selectedDate],
    queryFn: () =>
      fetch(`/api/operations/staff/rosters?from=${selectedDate}&to=${selectedDate}`).then((r) =>
        r.json()
      ),
  });

  const { data: members = [] } = useQuery<StaffMember[]>({
    queryKey: ['/api/operations/staff/members'],
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<CleaningTask[]>({
    queryKey: ['/api/operations/staff/rosters', selectedRosterId, 'cleaning'],
    queryFn: () =>
      fetch(`/api/operations/staff/rosters/${selectedRosterId}/cleaning`).then((r) => r.json()),
    enabled: selectedRosterId !== null,
  });

  const generateMut = useMutation({
    mutationFn: (rosterId: number) =>
      sapi('POST', `/api/operations/staff/rosters/${rosterId}/cleaning/generate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/operations/staff/rosters', selectedRosterId, 'cleaning'],
      });
      toast({ title: 'Shift tasks generated' });
    },
    onError: () => toast({ title: 'Generate failed', variant: 'destructive' }),
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      sapi('PATCH', `/api/operations/staff/cleaning/tasks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/operations/staff/rosters', selectedRosterId, 'cleaning'],
      });
      setAssignModal(null);
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const selectedRoster = rosters.find((r) => r.id === selectedRosterId);

  // Group tasks by timing
  const grouped = TIMING_ORDER.reduce<Record<string, CleaningTask[]>>((acc, timing) => {
    acc[timing] = tasks.filter((t) => (t.template?.timing ?? 'end_shift') === timing);
    return acc;
  }, {} as Record<string, CleaningTask[]>);

  // Stats
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const skippedCount = tasks.filter((t) => t.status === 'skipped').length;
  const requiredIncomplete = tasks.filter(
    (t) => t.template?.required && t.status !== 'completed'
  ).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Shift Tasks</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Assignable shift tasks grouped by Start · During · End of Shift.
        </p>
      </div>

      {/* Date + Roster Picker */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedRosterId(null);
          }}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {loadingRosters ? (
          <span className="text-xs text-slate-400">Loading rosters...</span>
        ) : rosters.length === 0 ? (
          <span className="text-xs text-slate-400">No rosters for this date</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {rosters.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRosterId(r.id)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  selectedRosterId === r.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {r.shiftName} ({r.shiftStartTime})
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRosterId === null ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Select a roster to view shift tasks.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{totalCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total tasks</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{completedCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Completed</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Pending</p>
            </div>
            {requiredIncomplete > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-600">{requiredIncomplete}</p>
                <p className="text-xs text-red-500 mt-0.5">Required outstanding</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-slate-500">{skippedCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Incomplete</p>
              </div>
            )}
          </div>

          {/* Task sections by timing */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-700">
                {selectedRoster?.shiftName} — Shift Tasks
              </p>
              <button
                onClick={() => generateMut.mutate(selectedRosterId!)}
                disabled={generateMut.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-300 text-xs rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${generateMut.isPending ? 'animate-spin' : ''}`}
                />
                {tasks.length > 0 ? 'Regenerate' : 'Generate Tasks'}
              </button>
            </div>

            {loadingTasks ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="p-10 text-center">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">No shift tasks generated yet.</p>
                <button
                  onClick={() => generateMut.mutate(selectedRosterId!)}
                  disabled={generateMut.isPending}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  Generate from Templates
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {TIMING_ORDER.map((timing) => {
                  const sectionTasks = grouped[timing];
                  if (sectionTasks.length === 0) return null;
                  const colors = TIMING_COLORS[timing];
                  const sectionCompleted = sectionTasks.filter((t) => t.status === 'completed').length;
                  return (
                    <div key={timing}>
                      {/* Section header */}
                      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${colors.header}`}>
                        <span className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
                        <span className="text-xs font-semibold flex-1">
                          {TIMING_LABELS[timing]}
                        </span>
                        <span className="text-xs font-medium">
                          {sectionCompleted}/{sectionTasks.length}
                        </span>
                      </div>
                      {/* Tasks in this section */}
                      {sectionTasks.map((task) => {
                        const assignedMember = members.find((m) => m.id === task.assignedStaffId);
                        const isDone = task.status === 'completed';
                        const isSkipped = task.status === 'skipped';
                        const role = task.template?.role ?? 'all';
                        const isRequired = task.template?.required ?? false;
                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 ${
                              isDone ? 'bg-emerald-50/30' : isSkipped ? 'bg-red-50/30' : ''
                            }`}
                          >
                            {/* Status toggle */}
                            <button
                              onClick={() =>
                                updateTaskMut.mutate({
                                  id: task.id,
                                  data: { status: isDone ? 'pending' : 'completed' },
                                })
                              }
                              className={`shrink-0 mt-0.5 transition-colors ${
                                isDone
                                  ? 'text-emerald-500 hover:text-slate-300'
                                  : 'text-slate-300 hover:text-emerald-400'
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </button>

                            {/* Task info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p
                                  className={`text-xs font-medium ${
                                    isDone
                                      ? 'line-through text-slate-400'
                                      : isSkipped
                                      ? 'text-slate-400'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {task.template?.taskName ?? `Task #${task.id}`}
                                </p>
                                {isRequired && !isDone && (
                                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" title="Required" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-400">
                                  {task.template?.areaName}
                                </span>
                                {task.template?.estimatedMinutes && (
                                  <span className="text-xs text-slate-400">
                                    · ~{task.template.estimatedMinutes} min
                                  </span>
                                )}
                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role]}`}>
                                  {ROLE_LABELS[role]}
                                </span>
                              </div>
                            </div>

                            {/* Right side controls */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {/* Incomplete button (only show if not already completed/skipped) */}
                              <div className="flex items-center gap-1">
                                {!isDone && (
                                  <button
                                    onClick={() =>
                                      updateTaskMut.mutate({
                                        id: task.id,
                                        data: { status: isSkipped ? 'pending' : 'skipped' },
                                      })
                                    }
                                    className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors ${
                                      isSkipped
                                        ? 'border-red-400 bg-red-50 text-red-600'
                                        : 'border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400'
                                    }`}
                                  >
                                    <XCircle className="w-3 h-3" />
                                    {isSkipped ? 'Marked incomplete' : 'Incomplete'}
                                  </button>
                                )}
                                <button
                                  onClick={() => setAssignModal(task)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                                >
                                  <Users className="w-3 h-3" />
                                  {assignedMember ? assignedMember.fullName : 'Assign'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Assign Staff Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Assign Staff</h3>
              <button
                onClick={() => setAssignModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-600 mb-3">
                Task:{' '}
                <strong>{assignModal.template?.taskName ?? `Task #${assignModal.id}`}</strong>
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                <button
                  onClick={() =>
                    updateTaskMut.mutate({ id: assignModal.id, data: { assignedStaffId: null } })
                  }
                  className={`w-full text-left px-3 py-2 text-xs rounded border ${
                    assignModal.assignedStaffId === null
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  — Unassigned
                </button>
                {members
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        updateTaskMut.mutate({
                          id: assignModal.id,
                          data: { assignedStaffId: m.id },
                        })
                      }
                      className={`w-full text-left px-3 py-2 text-xs rounded border ${
                        assignModal.assignedStaffId === m.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {m.fullName}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
