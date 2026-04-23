import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, CheckCircle2, RotateCcw, AlertCircle, CalendarDays } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DeepCleaningTask = {
  id: number; taskName: string; areaName: string; frequency: string; dueDate: string;
  assignedStaffId: number | null; status: string; completedAt: string | null;
  rolloverCount: number; notes: string | null; isActive: boolean;
};
type StaffMember = { id: number; fullName: string; isActive: boolean };

function todayBkk() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); }
function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const inputCls = "w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const taskSchema = z.object({
  taskName: z.string().min(1, "Required"),
  areaName: z.string().min(1, "Required"),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Required"),
  assignedStaffId: z.coerce.number().nullable().optional(),
  notes: z.string().optional(),
});

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </label>
  );
}

const FREQ_COLORS: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-700",
  fortnightly: "bg-violet-100 text-violet-700",
  monthly: "bg-amber-100 text-amber-700",
  quarterly: "bg-rose-100 text-rose-700",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export default function DeepCleaningSchedule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = todayBkk();
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "overdue" | "completed">("all");
  const [completeModal, setCompleteModal] = useState<DeepCleaningTask | null>(null);
  const [rolloverNote, setRolloverNote] = useState("");

  const { data: tasks = [], isLoading } = useQuery<DeepCleaningTask[]>({
    queryKey: ["/api/operations/staff/deep-cleaning"],
  });
  const { data: members = [] } = useQuery<StaffMember[]>({ queryKey: ["/api/operations/staff/members"] });

  const form = useForm({ resolver: zodResolver(taskSchema), defaultValues: {
    taskName: "", areaName: "", frequency: "monthly" as const, dueDate: "",
    assignedStaffId: null as number | null, notes: "",
  }});

  const createMut = useMutation({
    mutationFn: (d: z.infer<typeof taskSchema>) => apiRequest("POST", `/api/operations/staff/deep-cleaning`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/deep-cleaning"] }); setShowModal(false); form.reset(); toast({ title: "Task created" }); },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });

  const completeMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      apiRequest("POST", `/api/operations/staff/deep-cleaning/${id}/complete`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/deep-cleaning"] }); setCompleteModal(null); toast({ title: "Task completed — next due date scheduled" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const rolloverMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      apiRequest("POST", `/api/operations/staff/deep-cleaning/${id}/rollover`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/deep-cleaning"] }); setCompleteModal(null); toast({ title: "Rolled over — due date extended" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const filtered = tasks.filter(t => {
    if (!t.isActive) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return t.status !== "completed" && t.dueDate < today;
    if (statusFilter === "pending") return t.status === "pending";
    if (statusFilter === "completed") return t.status === "completed";
    return true;
  });

  const overdueCount = tasks.filter(t => t.isActive && t.status !== "completed" && t.dueDate < today).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Deep Cleaning Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scheduled deep cleans with due dates, rollover tracking and auto-reschedule.</p>
        </div>
        <button onClick={() => { form.reset({ taskName: "", areaName: "", frequency: "monthly", dueDate: today, assignedStaffId: null, notes: "" }); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700">
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{overdueCount} task{overdueCount > 1 ? "s are" : " is"} overdue</p>
          <button onClick={() => setStatusFilter("overdue")} className="ml-auto text-xs text-red-600 hover:underline">View</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {([
          ["all", "All"],
          ["overdue", `Overdue (${overdueCount})`],
          ["pending", "Pending"],
          ["completed", "Completed"],
        ] as [typeof statusFilter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === f ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-400 p-4">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No deep cleaning tasks.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Task</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Area</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Frequency</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Due Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Assigned</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(task => {
                const isOverdue = task.status !== "completed" && task.dueDate < today;
                const assignedMember = members.find(m => m.id === task.assignedStaffId);
                return (
                  <tr key={task.id} className={isOverdue ? "bg-red-50" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <div>
                          <p className={`font-medium ${isOverdue ? "text-red-700" : "text-slate-800"}`}>{task.taskName}</p>
                          {task.rolloverCount > 0 && (
                            <p className="text-xs text-amber-600 mt-0.5">Rolled over {task.rolloverCount}×</p>
                          )}
                        </div>
                        {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{task.areaName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FREQ_COLORS[task.frequency] ?? "bg-slate-100 text-slate-600"}`}>
                        {task.frequency}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                      {fmtDate(task.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {assignedMember ? assignedMember.fullName : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[task.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {task.status === "completed" ? "Done" : task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.status !== "completed" && (
                        <button onClick={() => { setCompleteModal(task); setRolloverNote(""); }}
                          className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">
                          Action
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <Modal title="Add Deep Cleaning Task" onClose={() => setShowModal(false)}>
          <form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-4">
            <Field label="Task Name *" error={form.formState.errors.taskName?.message}>
              <input {...form.register("taskName")} className={inputCls} placeholder="e.g. Degrease hood filters" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area *" error={form.formState.errors.areaName?.message}>
                <input {...form.register("areaName")} className={inputCls} placeholder="e.g. Kitchen" />
              </Field>
              <Field label="Frequency">
                <select {...form.register("frequency")} className={inputCls}>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date *" error={form.formState.errors.dueDate?.message}>
                <input type="date" {...form.register("dueDate")} className={inputCls} />
              </Field>
              <Field label="Assigned Staff">
                <select {...form.register("assignedStaffId")} className={inputCls}>
                  <option value="">Unassigned</option>
                  {members.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea {...form.register("notes")} rows={2} className={inputCls} placeholder="Optional" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={createMut.isPending} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {createMut.isPending ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Complete / Rollover Modal */}
      {completeModal && (
        <Modal title={`Action — ${completeModal.taskName}`} onClose={() => setCompleteModal(null)}>
          <div className="space-y-4">
            <p className="text-xs text-slate-600">Due: <strong>{fmtDate(completeModal.dueDate)}</strong> · Area: <strong>{completeModal.areaName}</strong></p>
            <div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
                <textarea value={rolloverNote} onChange={e => setRolloverNote(e.target.value)} rows={2}
                  className={inputCls} placeholder="Any notes about this task..." />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => rolloverMut.mutate({ id: completeModal.id, notes: rolloverNote })}
                disabled={rolloverMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-amber-400 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Rollover (extend due date)
              </button>
              <button onClick={() => completeMut.mutate({ id: completeModal.id, notes: rolloverNote })}
                disabled={completeMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
