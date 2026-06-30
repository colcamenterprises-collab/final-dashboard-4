import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type CleaningTask = { taskId: string; taskName: string; standard: string[]; photoRequired: boolean };
type CompletionSummary = { completedAt: string; manager: string; tasksCompleted: number; overallStatus: string; cleaningScore: number };

function displayStatus(status: string) {
  if (status === "Pass") return "Meets Standard";
  if (status === "Requires Attention") return "Needs Attention";
  return status;
}
type TaskState = {
  status: string;
  comments: string;
  followUpAction: string;
  assignedTo: string;
  followUpStatus: string;
  file: File | null;
  previewUrl?: string;
  saved?: boolean;
  error?: string;
  imagePath?: string;
};

const blankTaskState: TaskState = { status: "", comments: "", followUpAction: "", assignedTo: "", followUpStatus: "", file: null };

export default function DailyCleaning() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shiftId = params.get("shift") || "";
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [manager, setManager] = useState("");
  const [state, setState] = useState<Record<string, TaskState>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [taskLoadError, setTaskLoadError] = useState("");
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [taskRes, salesRes, cleaningRes] = await Promise.all([
        fetch("/api/daily-cleaning/tasks"),
        shiftId ? fetch(`/api/forms/daily-sales/v2/${shiftId}`) : Promise.resolve(null),
        shiftId ? fetch(`/api/daily-cleaning?salesId=${encodeURIComponent(shiftId)}`) : Promise.resolve(null),
      ]);
      const taskJson = await taskRes.json();
      const salesJson = salesRes ? await salesRes.json() : null;
      const cleaningJson = cleaningRes ? await cleaningRes.json() : null;
      const loadedTasks = taskJson.ok && Array.isArray(taskJson.data) ? taskJson.data.map((task: CleaningTask) => ({ ...task, standard: Array.isArray(task.standard) ? task.standard : [] })) : [];
      setTasks(loadedTasks);
      if (taskJson.ok && loadedTasks.length === 0) {
        setTaskLoadError("No cleaning tasks have been configured. Please contact an administrator.");
      } else if (!taskJson.ok) {
        const hasInfrastructureBlocker = Array.isArray(taskJson.blockers) && taskJson.blockers.some((blocker: any) => blocker?.code === "DAILY_CLEANING_INFRASTRUCTURE_MISSING");
        setTaskLoadError(hasInfrastructureBlocker
          ? "Daily Cleaning infrastructure is not available. Please contact an administrator."
          : "Daily Cleaning tasks could not be loaded. Please contact an administrator.");
      } else {
        setTaskLoadError("");
      }
      let workflowContext: any = null;
      try {
        const rawContext = localStorage.getItem("daily_shift_workflow_context");
        workflowContext = rawContext ? JSON.parse(rawContext) : null;
      } catch {}
      if (salesJson?.ok) {
        setShiftDate(salesJson.record?.date || workflowContext?.shiftDate || new Date().toISOString().slice(0, 10));
        setManager(salesJson.record?.staff || workflowContext?.staffName || "");
      } else if (workflowContext?.shiftId === shiftId || workflowContext?.salesId === shiftId) {
        setShiftDate(workflowContext.shiftDate || new Date().toISOString().slice(0, 10));
        setManager(workflowContext.staffName || "");
      }
      const next: Record<string, TaskState> = {};
      for (const row of cleaningJson?.rows || []) {
        next[row.taskId] = {
          status: row.status,
          comments: row.comments || "",
          followUpAction: row.followUpAction || "",
          assignedTo: row.assignedTo || "",
          followUpStatus: row.followUpStatus || "",
          file: null,
          saved: true,
          imagePath: row.imagePath,
        };
      }
      setState(next);
      setLoading(false);
    }
    load().catch(() => {
      setTaskLoadError("Daily Cleaning tasks could not be loaded. Please contact an administrator.");
      setMessage("Unable to load cleaning form.");
      setLoading(false);
    });
  }, [shiftId]);

  const completedCount = useMemo(() => tasks.filter((task) => {
    const row = state[task.taskId];
    return Boolean(row?.status && (row.file || row.imagePath) && (row.status !== "Requires Attention" || (row.comments.trim() && row.followUpAction.trim() && row.assignedTo.trim() && row.followUpStatus)));
  }).length, [tasks, state]);

  const cleaningScore = useMemo(() => {
    if (tasks.length === 0) return 0;
    const passCount = tasks.filter((task) => state[task.taskId]?.status === "Pass").length;
    return Math.round((passCount / tasks.length) * 100);
  }, [tasks, state]);

  function missingReasons(_task: CleaningTask, row: TaskState | undefined) {
    const reasons: string[] = [];
    if (!row?.status) reasons.push("status missing");
    if (!row?.file && !row?.imagePath) reasons.push("photo missing");
    if (row?.status === "Requires Attention") {
      if (!row.comments.trim()) reasons.push("issue comments missing");
      if (!row.followUpAction.trim()) reasons.push("follow-up note missing");
      if (!row.assignedTo.trim()) reasons.push("assigned person missing");
      if (!row.followUpStatus) reasons.push("follow-up status missing");
    }
    if (row?.status && (row.file || row.imagePath) && row.saved !== true) reasons.push("task not saved");
    return reasons;
  }

  const missing = useMemo(() => tasks
    .map((task) => ({ task, reasons: missingReasons(task, state[task.taskId]) }))
    .filter((item) => item.reasons.length > 0), [tasks, state]);

  function showMessage(text: string) {
    setMessage(text);
    setPopupMessage(text);
  }

  function validateTaskForSave(_task: CleaningTask, row: TaskState | undefined) {
    if (!row?.status) return "Please select Meets Standard or Needs Attention before saving this task.";
    if (!row.file && !row.imagePath) return "Please add a photo before saving this task.";
    if (row.status === "Requires Attention") {
      if (!row.comments.trim() || !row.followUpAction.trim() || !row.assignedTo.trim() || !row.followUpStatus) {
        return "Please add notes before saving this task.";
      }
    }
    return "";
  }

  function update(taskId: string, patch: Partial<TaskState>) {
    const current = state[taskId] || blankTaskState;
    setState((prev) => ({ ...prev, [taskId]: { ...current, ...patch, saved: false, error: undefined } }));
  }

  function setPhoto(taskId: string, file: File | null) {
    const current = state[taskId];
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    update(taskId, { file, previewUrl: file ? URL.createObjectURL(file) : undefined, imagePath: file ? undefined : current?.imagePath });
  }

  async function saveTask(task: CleaningTask, options: { showSuccess?: boolean } = { showSuccess: true }) {
    const row = state[task.taskId];
    const validationError = validateTaskForSave(task, row);
    if (validationError) {
      update(task.taskId, { error: validationError });
      showMessage(validationError);
      return false;
    }
    if (!row) {
      showMessage("Please complete all required fields before saving this task.");
      return false;
    }
    setSavingTaskId(task.taskId);
    setMessage("");
    const formData = new FormData();
    formData.append("salesId", shiftId);
    formData.append("shiftDate", shiftDate);
    formData.append("store", "SBB");
    formData.append("manager", manager);
    formData.append("taskId", task.taskId);
    formData.append("status", row.status);
    formData.append("comments", row.comments || "");
    formData.append("followUpAction", row.followUpAction || "");
    formData.append("assignedTo", row.assignedTo || "");
    formData.append("followUpStatus", row.followUpStatus || "");
    if (row.imagePath) formData.append("existingImagePath", row.imagePath);
    if (row.file) formData.append("photo", row.file);
    try {
      const res = await fetch("/api/daily-cleaning/task", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const text = "This task could not be saved. Please try again or contact an administrator.";
        update(task.taskId, { error: text });
        showMessage(text);
        return false;
      }
      setState((prev) => ({ ...prev, [task.taskId]: { ...prev[task.taskId], saved: true, imagePath: data.record.imagePath, error: undefined } }));
      if (options.showSuccess !== false) showMessage("Task saved.");
      return true;
    } catch {
      const text = "This task could not be saved. Please try again or contact an administrator.";
      update(task.taskId, { error: text });
      showMessage(text);
      return false;
    } finally {
      setSavingTaskId(null);
    }
  }

  async function continueToStock() {
    setMessage("");
    setCompletion(null);
    setSubmitting(true);
    if (tasks.length === 0) {
      showMessage("No cleaning tasks have been configured. Please contact an administrator.");
      setSubmitting(false);
      return;
    }
    if (missing.length > 0) {
      const missingLines = missing.map(({ task, reasons }) => `- ${task.taskName}: ${reasons.join(", ")}`).join("\n");
      showMessage(`Daily Cleaning is not ready to submit. Please complete these tasks first:\n${missingLines}`);
      setSubmitting(false);
      return;
    }
    for (const task of tasks) {
      const saved = await saveTask(task, { showSuccess: false });
      if (!saved) { setSubmitting(false); return; }
    }
    try {
      const res = await fetch("/api/daily-cleaning/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salesId: shiftId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showMessage("Daily Cleaning could not be submitted. Please try again or contact an administrator.");
        return;
      }
      setCompletion({ completedAt: data.completedAt, manager: data.manager || manager, tasksCompleted: data.tasksCompleted, overallStatus: data.overallStatus, cleaningScore: data.cleaningScore });
      showMessage("Daily Cleaning submitted.");
      setTimeout(() => navigate(`/operations/daily-stock?shift=${shiftId}`), 500);
    } catch {
      showMessage("Daily Cleaning could not be submitted. Please try again or contact an administrator.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-4 text-xs">Loading cleaning form...</div>;
  if (!shiftId) return <div className="p-4 text-xs">Daily Sales must be completed before Daily Cleaning & Operations.</div>;

  if (completion) {
    return <div className="p-4 space-y-4 text-xs max-w-4xl">
      <div className="rounded border border-green-200 bg-green-50 p-4 text-green-900">
        <h1 className="text-lg font-semibold">Daily Cleaning Complete</h1>
        <table className="mt-3 w-full text-xs"><tbody>
          <tr><td className="py-1 font-semibold">Completed time</td><td>{new Date(completion.completedAt).toLocaleString()}</td></tr>
          <tr><td className="py-1 font-semibold">Manager</td><td>{completion.manager || "Not recorded"}</td></tr>
          <tr><td className="py-1 font-semibold">Tasks completed</td><td>{completion.tasksCompleted} / {tasks.length}</td></tr>
          <tr><td className="py-1 font-semibold">Overall status</td><td>{displayStatus(completion.overallStatus)}</td></tr>
          <tr><td className="py-1 font-semibold">Cleaning Score</td><td>{completion.cleaningScore}%</td></tr>
        </tbody></table>
        <a className="mt-4 inline-flex rounded bg-emerald-600 px-4 py-2 font-medium text-white" href={`/operations/daily-stock?shift=${shiftId}`}>Continue to Daily Stock</a>
      </div>
    </div>;
  }

  return <div className="p-4 space-y-4 text-xs max-w-4xl">
    {popupMessage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="daily-cleaning-message-title">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-white p-4 shadow-lg">
        <h2 id="daily-cleaning-message-title" className="text-base font-semibold">Daily Cleaning</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{popupMessage}</p>
        <button type="button" className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={() => setPopupMessage("")}>OK</button>
      </div>
    </div>}

    <div>
      <h1 className="text-lg font-semibold">Daily Cleaning & Operations</h1>
      <p className="mt-1 text-slate-600">Cleaning verification is required before Daily Stock. Shift date: {shiftDate}</p>
    </div>

    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Cleaning Progress</h2>
          <p className="text-slate-600">{completedCount} / {tasks.length} Tasks Complete</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Cleaning Score</p>
          <p className="text-lg">{cleaningScore}%</p>
        </div>
      </div>
      <div className="mt-3 h-3 w-full rounded bg-slate-100">
        <div className="h-3 rounded bg-emerald-600" style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }} />
      </div>
    </div>

    {message && <div role="alert" aria-live="assertive" className={`whitespace-pre-line rounded border p-3 ${message === "Task saved." ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>{message}</div>}
    {taskLoadError && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-900">{taskLoadError}</div>}
    {tasks.map((task) => {
      const row = state[task.taskId] || blankTaskState;
      const previewSrc = row.previewUrl || row.imagePath;
      return <section key={task.taskId} className="rounded border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{task.taskName}</h2>
          <ul className="mt-2 space-y-1 text-slate-700">{task.standard.map((item) => <li key={item}>✓ {item}</li>)}</ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={`min-h-14 rounded border px-4 py-3 text-base font-semibold ${row.status === "Pass" ? "border-emerald-700 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} onClick={() => update(task.taskId, { status: "Pass", comments: "", followUpAction: "", assignedTo: "", followUpStatus: "" })}>Meets Standard</button>
          <button type="button" className={`min-h-14 rounded border px-4 py-3 text-base font-semibold ${row.status === "Requires Attention" ? "border-red-700 bg-red-600 text-white" : "border-red-300 bg-red-50 text-red-900"}`} onClick={() => update(task.taskId, { status: "Requires Attention", followUpStatus: row.followUpStatus || "Open" })}>Needs Attention</button>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">Photo</p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white">
              Take Photo
              <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} />
            </label>
            <label className="inline-flex cursor-pointer rounded border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800">
              Choose from Gallery
              <input className="hidden" type="file" accept="image/*" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} />
            </label>
          </div>
          {previewSrc && <div className="mt-3 flex items-center gap-3">
            <img src={previewSrc} alt={`${task.taskName} cleaning evidence`} className="h-24 w-24 rounded border object-cover" />
            <label className="inline-flex cursor-pointer rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800">
              Replace Photo
              <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} />
            </label>
          </div>}
        </div>

        {row.status === "Requires Attention" && <div className="rounded border border-red-200 bg-red-50 p-3 space-y-3">
          <label className="block">Issue / Comments
            <textarea className="mt-1 block w-full rounded border p-2" value={row.comments} onChange={(e) => update(task.taskId, { comments: e.target.value })} />
          </label>
          <label className="block">Follow-up Action
            <textarea className="mt-1 block w-full rounded border p-2" value={row.followUpAction} onChange={(e) => update(task.taskId, { followUpAction: e.target.value })} />
          </label>
          <label className="block">Assigned To
            <input className="mt-1 block w-full rounded border p-2" value={row.assignedTo} onChange={(e) => update(task.taskId, { assignedTo: e.target.value })} placeholder="Kitchen" />
          </label>
          <label className="block">Follow-up Status
            <select className="mt-1 block w-full rounded border p-2" value={row.followUpStatus} onChange={(e) => update(task.taskId, { followUpStatus: e.target.value })}>
              <option value="">Select status</option><option>Open</option><option>Closed</option>
            </select>
          </label>
        </div>}

        {row.error && <p className="text-red-700">{row.error}</p>}
        <button type="button" className="rounded bg-slate-800 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={savingTaskId === task.taskId} onClick={() => saveTask(task)}>{savingTaskId === task.taskId ? "Saving..." : "Save Task"}</button>
        {row.saved && <span className="ml-3 text-green-700">Saved</span>}
      </section>;
    })}
    {missing.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">Daily Cleaning has incomplete tasks. Press Submit Daily Cleaning to see the exact task list.</div>}
    <button type="button" className="rounded bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={submitting} onClick={continueToStock}>{submitting ? "Submitting..." : "Submit Daily Cleaning"}</button>
  </div>;
}
