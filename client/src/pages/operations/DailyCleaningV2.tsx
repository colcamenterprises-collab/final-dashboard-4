import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type CleaningTask = {
  taskId: string;
  taskName: string;
  standard: string[];
  photoRequired?: boolean;
};

type TaskState = {
  status: "" | "Pass" | "Requires Attention";
  comments: string;
  file: File | null;
  previewUrl?: string;
  imagePath?: string;
};

const emptyTask = (): TaskState => ({ status: "", comments: "", file: null });

async function readJson(response: Response | null) {
  if (!response) return null;
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: text || `Request failed (${response.status})` };
  }
}

export default function DailyCleaningV2() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shiftId = params.get("shift") || "";
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [rows, setRows] = useState<Record<string, TaskState>>({});
  const [shiftDate, setShiftDate] = useState("");
  const [manager, setManager] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      if (!shiftId) {
        setError("Form 1 record is missing. Open Form 2 from the Daily Sales Library.");
        setLoading(false);
        return;
      }

      try {
        const [salesResponse, taskResponse, savedResponse] = await Promise.all([
          fetch(`/api/forms/daily-sales/v2/${encodeURIComponent(shiftId)}`, { credentials: "include" }),
          fetch("/api/daily-cleaning/tasks", { credentials: "include" }),
          fetch(`/api/daily-cleaning?salesId=${encodeURIComponent(shiftId)}`, { credentials: "include" }),
        ]);
        const [salesData, taskData, savedData] = await Promise.all([
          readJson(salesResponse),
          readJson(taskResponse),
          readJson(savedResponse),
        ]);
        if (cancelled) return;

        if (!salesResponse.ok || !salesData?.ok || !salesData?.record) {
          throw new Error(salesData?.error || "Form 1 could not be loaded for this shift.");
        }
        if (!taskResponse.ok || !taskData?.ok) {
          const blocker = Array.isArray(taskData?.blockers) ? taskData.blockers[0]?.message : "";
          throw new Error(blocker || taskData?.error || "Daily cleaning tasks could not be loaded.");
        }

        const record = salesData.record;
        const payload = record.payload || {};
        setShiftDate(record.date || payload.shiftDate || new Date().toISOString().slice(0, 10));
        setManager(record.staff || payload.completedBy || "");

        const loadedTasks: CleaningTask[] = Array.isArray(taskData.data)
          ? taskData.data.map((task: any) => ({
              taskId: String(task.taskId),
              taskName: String(task.taskName || "Cleaning task"),
              standard: Array.isArray(task.standard) ? task.standard : [],
              photoRequired: Boolean(task.photoRequired),
            }))
          : [];
        if (!loadedTasks.length) throw new Error("No Daily Cleaning tasks have been configured.");
        setTasks(loadedTasks);

        const next: Record<string, TaskState> = {};
        for (const task of loadedTasks) next[task.taskId] = emptyTask();
        for (const saved of savedData?.rows || []) {
          next[String(saved.taskId)] = {
            status: saved.status === "Pass" || saved.status === "Requires Attention" ? saved.status : "",
            comments: saved.comments || "",
            file: null,
            imagePath: saved.imagePath || undefined,
          };
        }
        setRows(next);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Daily Cleaning could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  const missing = useMemo(() => tasks.filter((task) => {
    const row = rows[task.taskId];
    if (!row?.status) return true;
    if (task.photoRequired && !row.file && !row.imagePath) return true;
    if (row.status === "Requires Attention" && !row.comments.trim()) return true;
    return false;
  }), [rows, tasks]);

  const completed = tasks.length - missing.length;
  const score = tasks.length
    ? Math.round((tasks.filter((task) => rows[task.taskId]?.status === "Pass").length / tasks.length) * 100)
    : 0;

  function patch(taskId: string, value: Partial<TaskState>) {
    setRows((current) => ({
      ...current,
      [taskId]: { ...(current[taskId] || emptyTask()), ...value },
    }));
  }

  function selectPhoto(taskId: string, file: File | null) {
    const existing = rows[taskId];
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);
    patch(taskId, {
      file,
      previewUrl: file ? URL.createObjectURL(file) : undefined,
      imagePath: file ? undefined : existing?.imagePath,
    });
  }

  async function saveTask(task: CleaningTask) {
    const row = rows[task.taskId];
    const body = new FormData();
    body.append("salesId", shiftId);
    body.append("shiftDate", shiftDate);
    body.append("store", "SBB");
    body.append("manager", manager);
    body.append("taskId", task.taskId);
    body.append("status", row.status);
    body.append("comments", row.comments || "");
    body.append("followUpAction", row.status === "Requires Attention" ? row.comments : "");
    body.append("assignedTo", row.status === "Requires Attention" ? manager || "Kitchen" : "");
    body.append("followUpStatus", row.status === "Requires Attention" ? "Open" : "");
    if (row.imagePath) body.append("existingImagePath", row.imagePath);
    if (row.file) body.append("photo", row.file);

    const response = await fetch("/api/daily-cleaning/task", {
      method: "POST",
      credentials: "include",
      body,
    });
    const data = await readJson(response);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `Could not save ${task.taskName}.`);
    if (data.record?.imagePath) patch(task.taskId, { imagePath: data.record.imagePath, file: null });
  }

  async function submit() {
    if (submitting) return;
    setError("");
    setSuccess("");
    if (missing.length) {
      setError(`Complete the following before submitting: ${missing.map((task) => task.taskName).join(", ")}.`);
      return;
    }

    setSubmitting(true);
    try {
      for (const task of tasks) await saveTask(task);
      const response = await fetch("/api/daily-cleaning/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesId: shiftId }),
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Daily Cleaning could not be completed.");
      setSuccess("Form 2 saved. Opening Form 3 — Stock Reconciliation and Stock Count.");
      window.setTimeout(() => navigate(`/operations/daily-stock?shift=${encodeURIComponent(shiftId)}`), 700);
    } catch (err: any) {
      setError(err?.message || "Daily Cleaning could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-5 text-sm">Loading Form 2 — Daily Cleaning Requirements…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Form 2 of 3</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Daily Cleaning Requirements</h1>
        <p className="mt-1 text-sm text-slate-600">Complete and save this form before Stock Reconciliation and Stock Count.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
          <span><strong>Shift:</strong> {shiftDate || "—"}</span>
          <span><strong>Completed by:</strong> {manager || "—"}</span>
          <span><strong>Progress:</strong> {completed}/{tasks.length}</span>
          <span><strong>Score:</strong> {score}%</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

      {!error || tasks.length > 0 ? tasks.map((task) => {
        const row = rows[task.taskId] || emptyTask();
        const preview = row.previewUrl || row.imagePath;
        return (
          <section key={task.taskId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{task.taskName}</h2>
                {task.standard.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{task.standard.map((line) => <li key={line}>{line}</li>)}</ul>}
              </div>
              {task.photoRequired && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Photo required</span>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => patch(task.taskId, { status: "Pass", comments: "" })} className={`rounded-lg border px-3 py-3 text-sm font-semibold ${row.status === "Pass" ? "border-emerald-700 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>Meets Standard</button>
              <button type="button" onClick={() => patch(task.taskId, { status: "Requires Attention" })} className={`rounded-lg border px-3 py-3 text-sm font-semibold ${row.status === "Requires Attention" ? "border-red-700 bg-red-600 text-white" : "border-red-300 bg-red-50 text-red-800"}`}>Needs Attention</button>
            </div>

            {(task.photoRequired || preview) && <div className="mt-4">
              <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                {preview ? "Replace photo" : "Take or choose photo"}
                <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => selectPhoto(task.taskId, event.target.files?.[0] || null)} />
              </label>
              {preview && <img src={preview} alt={`${task.taskName} evidence`} className="mt-3 h-28 w-28 rounded-lg border object-cover" />}
            </div>}

            {row.status === "Requires Attention" && <label className="mt-4 block text-sm font-semibold text-slate-800">Corrective action / notes<textarea value={row.comments} onChange={(event) => patch(task.taskId, { comments: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal" /></label>}
          </section>
        );
      }) : null}

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <button type="button" onClick={() => navigate("/operations/daily-sales-v2/library")} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">Back to Library</button>
        <button type="button" disabled={submitting || tasks.length === 0} onClick={submit} className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "Saving…" : "Save Form 2 & Continue to Form 3"}</button>
      </div>
    </div>
  );
}
