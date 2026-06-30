import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type CleaningTask = { taskId: string; taskName: string; standard: string[]; photoRequired: boolean };

type TaskState = {
  status: string;
  comments: string;
  file: File | null;
  previewUrl?: string;
  error?: string;
  imagePath?: string;
};

const blankTaskState: TaskState = { status: "", comments: "", file: null };

const labels = {
  en: {
    title: "Daily Cleaning & Operations",
    subtitle: "Cleaning verification is required before Daily Stock.",
    directWarning: "Daily Sales must be completed before Daily Cleaning & Operations.",
    loading: "Loading cleaning form...",
    progress: "Cleaning Progress",
    complete: "Tasks Complete",
    score: "Cleaning Score",
    standard: "Inspection Standard",
    meets: "Meets Standard",
    needs: "Needs Attention",
    photo: "Photo required",
    takePhoto: "Take Photo",
    choosePhoto: "Choose from Gallery",
    replacePhoto: "Replace Photo",
    notes: "Notes required when Needs Attention is selected",
    submit: "Submit Daily Cleaning",
    submitting: "Submitting...",
    submitted: "Daily Cleaning submitted.",
    noTasks: "No cleaning tasks have been configured. Please contact an administrator.",
    loadError: "Daily Cleaning tasks could not be loaded. Please contact an administrator.",
    infraError: "Daily Cleaning infrastructure is not available. Please contact an administrator.",
    notReady: "Daily Cleaning is not ready to submit. Please complete these tasks first:",
    saveError: "Daily Cleaning could not be submitted. Please try again or contact an administrator.",
    ok: "OK",
  },
  th: {
    title: "การทำความสะอาดประจำวัน",
    subtitle: "ต้องตรวจสอบความสะอาดก่อนทำ Daily Stock",
    directWarning: "ต้องส่ง Daily Sales ก่อนทำ Daily Cleaning & Operations",
    loading: "กำลังโหลดแบบฟอร์มทำความสะอาด...",
    progress: "ความคืบหน้า",
    complete: "งานเสร็จแล้ว",
    score: "คะแนนความสะอาด",
    standard: "มาตรฐานการตรวจ",
    meets: "ผ่านมาตรฐาน",
    needs: "ต้องแก้ไข",
    photo: "ต้องแนบรูปถ่าย",
    takePhoto: "ถ่ายรูป",
    choosePhoto: "เลือกจากแกลเลอรี",
    replacePhoto: "เปลี่ยนรูป",
    notes: "ต้องใส่หมายเหตุเมื่อเลือกต้องแก้ไข",
    submit: "ส่ง Daily Cleaning",
    submitting: "กำลังส่ง...",
    submitted: "Daily Cleaning submitted.",
    noTasks: "ยังไม่มีการตั้งค่างานทำความสะอาด กรุณาติดต่อผู้ดูแลระบบ",
    loadError: "ไม่สามารถโหลดงานทำความสะอาด กรุณาติดต่อผู้ดูแลระบบ",
    infraError: "ระบบ Daily Cleaning ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    notReady: "Daily Cleaning ยังไม่พร้อมส่ง กรุณากรอกงานต่อไปนี้ให้ครบ:",
    saveError: "ไม่สามารถส่ง Daily Cleaning ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ",
    ok: "ตกลง",
  },
};

function LanguageToggle({ lang, setLang }: { lang: "en" | "th"; setLang: (lang: "en" | "th") => void }) {
  return <div className="flex items-center gap-2 text-xs">
    <span className={lang === "en" ? "font-semibold text-emerald-700" : "text-slate-500"}>EN</span>
    <button type="button" className="relative h-6 w-12 rounded-full bg-emerald-600" onClick={() => setLang(lang === "en" ? "th" : "en")} aria-label="Toggle language">
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${lang === "en" ? "left-0.5" : "left-6"}`} />
    </button>
    <span className={lang === "th" ? "font-semibold text-emerald-700" : "text-slate-500"}>ไทย</span>
  </div>;
}

export default function DailyCleaning() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shiftId = params.get("shift") || "";
  const [lang, setLang] = useState<"en" | "th">("en");
  const L = labels[lang];
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [manager, setManager] = useState("");
  const [state, setState] = useState<Record<string, TaskState>>({});
  const [loading, setLoading] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [allowed, setAllowed] = useState(false);

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
      let workflowContext: any = null;
      try { workflowContext = JSON.parse(localStorage.getItem("daily_shift_workflow_context") || "null"); } catch {}
      const hasCompletedSales = Boolean(shiftId && (salesJson?.ok || workflowContext?.shiftId === shiftId || workflowContext?.salesId === shiftId));
      setAllowed(hasCompletedSales);
      if (salesJson?.ok) {
        setShiftDate(salesJson.record?.date || workflowContext?.shiftDate || new Date().toISOString().slice(0, 10));
        setManager(salesJson.record?.staff || workflowContext?.staffName || "");
      } else if (hasCompletedSales) {
        setShiftDate(workflowContext?.shiftDate || new Date().toISOString().slice(0, 10));
        setManager(workflowContext?.staffName || "");
      }
      const loadedTasks = taskJson.ok && Array.isArray(taskJson.data) ? taskJson.data.map((task: CleaningTask) => ({ ...task, standard: Array.isArray(task.standard) ? task.standard : [] })) : [];
      setTasks(loadedTasks);
      if (taskJson.ok && loadedTasks.length === 0) setTaskLoadError(L.noTasks);
      else if (!taskJson.ok) {
        const infra = Array.isArray(taskJson.blockers) && taskJson.blockers.some((b: any) => b?.code === "DAILY_CLEANING_INFRASTRUCTURE_MISSING");
        setTaskLoadError(infra ? L.infraError : L.loadError);
      } else setTaskLoadError("");
      const next: Record<string, TaskState> = {};
      for (const row of cleaningJson?.rows || []) next[row.taskId] = { status: row.status, comments: row.comments || "", file: null, imagePath: row.imagePath };
      setState(next);
      setLoading(false);
    }
    load().catch(() => { setTaskLoadError(L.loadError); setLoading(false); });
  }, [shiftId, L.infraError, L.loadError, L.noTasks]);

  const completedCount = useMemo(() => tasks.filter((task) => {
    const row = state[task.taskId];
    return Boolean(row?.status && (row.file || row.imagePath) && (row.status !== "Requires Attention" || row.comments.trim()));
  }).length, [tasks, state]);
  const cleaningScore = useMemo(() => tasks.length ? Math.round((tasks.filter((task) => state[task.taskId]?.status === "Pass").length / tasks.length) * 100) : 0, [tasks, state]);

  function missingReasons(row: TaskState | undefined) {
    const reasons: string[] = [];
    if (!row?.status) reasons.push("status missing");
    if (!row?.file && !row?.imagePath) reasons.push("photo missing");
    if (row?.status === "Requires Attention" && !row.comments.trim()) reasons.push("notes missing");
    return reasons;
  }
  const missing = useMemo(() => tasks.map((task) => ({ task, reasons: missingReasons(state[task.taskId]) })).filter((item) => item.reasons.length > 0), [tasks, state]);

  function update(taskId: string, patch: Partial<TaskState>) {
    const current = state[taskId] || blankTaskState;
    setState((prev) => ({ ...prev, [taskId]: { ...current, ...patch, error: undefined } }));
  }
  function setPhoto(taskId: string, file: File | null) {
    const current = state[taskId];
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    update(taskId, { file, previewUrl: file ? URL.createObjectURL(file) : undefined, imagePath: file ? undefined : current?.imagePath });
  }
  async function saveTask(task: CleaningTask) {
    const row = state[task.taskId];
    if (!row) return false;
    const formData = new FormData();
    formData.append("salesId", shiftId);
    formData.append("shiftDate", shiftDate);
    formData.append("store", "SBB");
    formData.append("manager", manager);
    formData.append("taskId", task.taskId);
    formData.append("status", row.status);
    formData.append("comments", row.comments || "");
    formData.append("followUpAction", row.status === "Requires Attention" ? row.comments : "");
    formData.append("assignedTo", row.status === "Requires Attention" ? manager || "Kitchen" : "");
    formData.append("followUpStatus", row.status === "Requires Attention" ? "Open" : "");
    if (row.imagePath) formData.append("existingImagePath", row.imagePath);
    if (row.file) formData.append("photo", row.file);
    const res = await fetch("/api/daily-cleaning/task", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return false;
    setState((prev) => ({ ...prev, [task.taskId]: { ...prev[task.taskId], imagePath: data.record.imagePath, error: undefined } }));
    return true;
  }
  async function submitCleaning() {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (tasks.length === 0) throw new Error(L.noTasks);
      if (missing.length > 0) throw new Error(`${L.notReady}\n${missing.map(({ task, reasons }) => `- ${task.taskName}: ${reasons.join(", ")}`).join("\n")}`);
      for (const task of tasks) {
        const ok = await saveTask(task);
        if (!ok) throw new Error(L.saveError);
      }
      const res = await fetch("/api/daily-cleaning/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salesId: shiftId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(L.saveError);
      setPopupMessage(L.submitted);
      setTimeout(() => navigate(`/operations/daily-stock?shift=${shiftId}`), 600);
    } catch (error: any) {
      setPopupMessage(error?.message || L.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-4 text-xs">{L.loading}</div>;
  if (!allowed) return <div className="p-4 text-xs">{L.directWarning}</div>;

  return <div className="max-w-4xl space-y-3 p-4 text-xs">
    {popupMessage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-sm rounded border border-slate-200 bg-white p-4 shadow-lg"><h2 className="text-sm font-semibold">Daily Cleaning</h2><p className="mt-2 whitespace-pre-line text-sm text-slate-800">{popupMessage}</p><button type="button" className="mt-4 rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white" onClick={() => setPopupMessage("")}>{L.ok}</button></div></div>}
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-base font-semibold">{L.title}</h1><p className="mt-1 text-xs text-slate-600">{L.subtitle} Shift date: {shiftDate}</p></div><LanguageToggle lang={lang} setLang={setLang} /></div>
    <div className="rounded border border-slate-200 bg-white p-3"><div className="flex items-center justify-between"><div><h2 className="text-xs font-semibold">{L.progress}</h2><p className="text-slate-600">{completedCount} / {tasks.length} {L.complete}</p></div><div className="text-right"><p className="text-xs font-semibold">{L.score}</p><p className="text-base">{cleaningScore}%</p></div></div><div className="mt-2 h-2 w-full rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }} /></div></div>
    {taskLoadError && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-900">{taskLoadError}</div>}
    {tasks.map((task) => {
      const row = state[task.taskId] || blankTaskState;
      const previewSrc = row.previewUrl || row.imagePath;
      return <section key={task.taskId} className="rounded border border-slate-300 bg-white p-3 shadow-sm">
        <div className="mb-2"><h2 className="text-sm font-semibold">{task.taskName}</h2><p className="mt-1 text-[11px] font-semibold text-slate-500">{L.standard}</p><ul className="mt-1 space-y-0.5 text-xs text-slate-700">{task.standard.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className="grid grid-cols-2 gap-2"><button type="button" className={`rounded border px-3 py-2 text-xs font-semibold ${row.status === "Pass" ? "border-emerald-700 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} onClick={() => update(task.taskId, { status: "Pass", comments: "" })}>{L.meets}</button><button type="button" className={`rounded border px-3 py-2 text-xs font-semibold ${row.status === "Requires Attention" ? "border-red-700 bg-red-600 text-white" : "border-red-300 bg-red-50 text-red-900"}`} onClick={() => update(task.taskId, { status: "Requires Attention" })}>{L.needs}</button></div>
        <div className="mt-3"><p className="font-semibold">{L.photo}</p><div className="mt-1 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white">{L.takePhoto}<input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} /></label><label className="inline-flex cursor-pointer rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800">{L.choosePhoto}<input className="hidden" type="file" accept="image/*" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} /></label></div>{previewSrc && <div className="mt-2 flex items-center gap-2"><img src={previewSrc} alt={`${task.taskName} cleaning evidence`} className="h-16 w-16 rounded border object-cover" /><label className="inline-flex cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800">{L.replacePhoto}<input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(task.taskId, e.target.files?.[0] || null)} /></label></div>}</div>
        {row.status === "Requires Attention" && <label className="mt-3 block text-xs font-semibold">{L.notes}<textarea className="mt-1 block min-h-16 w-full rounded border p-2 text-xs font-normal" value={row.comments} onChange={(e) => update(task.taskId, { comments: e.target.value })} /></label>}
      </section>;
    })}
    <button type="button" className="rounded bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={submitting} onClick={submitCleaning}>{submitting ? L.submitting : L.submit}</button>
  </div>;
}
