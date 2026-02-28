import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type TaskStatus = "draft" | "not_assigned" | "assigned" | "in_progress" | "blocked" | "done" | "cancelled" | "needs_review" | "approved" | "changes_requested" | "rejected";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskFrequency = "once" | "daily" | "weekly" | "monthly" | "ad-hoc";
type TaskAgent = "bob" | "jussi" | "sally" | "supplier" | "codex";
type AgentStatus = "idle" | "running" | "waiting" | "blocked" | "error" | "offline";

type Task = {
  id: string;
  taskNumber: string | null;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: TaskAgent | null;
  publish: boolean;
  dueAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type TaskMessage = { id: string; taskId: string; actor: string; message: string; visibility: "internal" | "public"; createdAt: string };
type TaskReview = { id: string; taskId: string; requestedBy: string; requestNote: string | null; requestedAt: string; decision: "approved" | "changes_requested" | "rejected" | null; decisionNote: string | null; decidedBy: string | null; decidedAt: string | null };
type TaskActivity = { id: string; taskId: string; action: string; actor: string; note: string | null; payload: Record<string, unknown> | null; createdAt: string };

type TaskDetail = Task & { messages: TaskMessage[]; reviews: TaskReview[]; activity: TaskActivity[] };

type AgentItem = {
  agent: TaskAgent;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  statusMessage: string | null;
};

const STATUS_OPTIONS: TaskStatus[] = ["draft", "not_assigned", "assigned", "in_progress", "blocked", "needs_review", "approved", "changes_requested", "rejected", "done", "cancelled"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];
const FREQUENCY_OPTIONS: TaskFrequency[] = ["once", "daily", "weekly", "monthly", "ad-hoc"];
const AGENT_OPTIONS: TaskAgent[] = ["bob", "jussi", "sally", "supplier", "codex"];
const AGENT_IMAGES: Record<string, string | null> = { bob: "/src/assets/agents/bob.png", jussi: null, sally: null, supplier: null, codex: null };

const statusPillClass: Record<AgentStatus, string> = {
  idle: "bg-slate-100 text-slate-700 ring-slate-200",
  running: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  waiting: "bg-amber-100 text-amber-800 ring-amber-200",
  blocked: "bg-orange-100 text-orange-800 ring-orange-200",
  error: "bg-rose-100 text-rose-800 ring-rose-200",
  offline: "bg-zinc-200 text-zinc-700 ring-zinc-300",
};

export default function AiOpsControlPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [publishFilter, setPublishFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewDecisionNote, setReviewDecisionNote] = useState("");
  const [failedAgentImages, setFailedAgentImages] = useState<Record<string, boolean>>({});

  const taskQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (agentFilter) params.set("assignedTo", agentFilter);
    if (publishFilter) params.set("publish", publishFilter);
    if (search.trim()) params.set("q", search.trim());
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [statusFilter, agentFilter, publishFilter, search]);

  const agentsQuery = useQuery<{ items: AgentItem[] }>({ queryKey: ["/api/ai-ops/agents"] });
  const tasksQuery = useQuery<{ items: Task[] }>({ queryKey: [`/api/ai-ops/tasks${taskQueryString}`] });
  const detailQuery = useQuery<TaskDetail>({
    queryKey: selectedTaskId ? [`/api/ai-ops/tasks/${selectedTaskId}`] : ["/api/ai-ops/tasks/noop"],
    enabled: Boolean(selectedTaskId),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiRequest("/api/ai-ops/tasks", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai-ops/tasks"] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest(`/api/ai-ops/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-ops/tasks"] });
      if (selectedTaskId) queryClient.invalidateQueries({ queryKey: [`/api/ai-ops/tasks/${selectedTaskId}`] });
    },
  });

  const postMessageMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => apiRequest(`/api/ai-ops/tasks/${id}/messages`, { method: "POST", body: JSON.stringify({ actor: "Cameron", message, visibility: "internal" }) }),
    onSuccess: () => {
      if (selectedTaskId) queryClient.invalidateQueries({ queryKey: [`/api/ai-ops/tasks/${selectedTaskId}`] });
      setMessageText("");
    },
  });

  const requestReviewMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => apiRequest(`/api/ai-ops/tasks/${id}/review-request`, { method: "POST", body: JSON.stringify({ actor: "Cameron", note: note || null }) }),
    onSuccess: () => {
      if (selectedTaskId) queryClient.invalidateQueries({ queryKey: [`/api/ai-ops/tasks/${selectedTaskId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-ops/tasks"] });
      setReviewNote("");
    },
  });

  const decideReviewMutation = useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "approved" | "changes_requested" | "rejected"; note: string }) =>
      apiRequest(`/api/ai-ops/tasks/${id}/review-decision`, { method: "POST", body: JSON.stringify({ actor: "Cameron", decision, note: note || null }) }),
    onSuccess: () => {
      if (selectedTaskId) queryClient.invalidateQueries({ queryKey: [`/api/ai-ops/tasks/${selectedTaskId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-ops/tasks"] });
      setReviewDecisionNote("");
    },
  });

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createTaskMutation.mutate({
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || "") || null,
      frequency: String(formData.get("frequency") || "ad-hoc"),
      priority: String(formData.get("priority") || "medium"),
      status: String(formData.get("status") || "draft"),
      assignedTo: String(formData.get("assignedTo") || "") || null,
      dueAt: String(formData.get("dueAt") || "") ? new Date(String(formData.get("dueAt"))).toISOString() : null,
      publish: formData.get("publish") === "on",
      createdBy: "Cameron",
    });
    event.currentTarget.reset();
  };

  const selectedTask = detailQuery.data;

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI Ops Control</h1>
        <p className="text-sm text-slate-600">Task queue, assignment control, threaded collaboration, reviews, and audit trail.</p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(agentsQuery.data?.items || []).map((agent) => (
          <article key={agent.agent} className="rounded-lg border border-slate-200 bg-white p-4 text-center">
            <div className="mx-auto mb-3 h-[90px] w-[90px] overflow-hidden rounded-full border border-slate-200 shadow-sm ring-1 ring-slate-100">
              {AGENT_IMAGES[agent.agent] && !failedAgentImages[agent.agent] ? (
                <img
                  src={AGENT_IMAGES[agent.agent] ?? undefined}
                  alt={`${agent.name} headshot`}
                  className="h-full w-full object-cover"
                  onError={() => setFailedAgentImages((prev) => ({ ...prev, [agent.agent]: true }))}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-2xl font-semibold text-slate-500">{agent.name.charAt(0)}</div>
              )}
            </div>
            <p className="text-base font-semibold text-slate-900">{agent.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{agent.role}</p>
            <p className="mt-1 text-xs text-slate-600 truncate">{agent.description}</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusPillClass[agent.status]}`}>{agent.status}</span>
            <p className="mt-1 text-xs text-slate-500">{agent.statusMessage || "No status message"}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">Create Task</h2>
        <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <input name="title" placeholder="Task title" className="border rounded px-2 py-2" required />
          <select name="frequency" className="border rounded px-2 py-2" defaultValue="ad-hoc">{FREQUENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <select name="priority" className="border rounded px-2 py-2" defaultValue="medium">{PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <select name="status" className="border rounded px-2 py-2" defaultValue="draft">{STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <select name="assignedTo" className="border rounded px-2 py-2" defaultValue=""><option value="">Unassigned</option>{AGENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <input name="dueAt" type="datetime-local" className="border rounded px-2 py-2" />
          <textarea name="description" placeholder="Description" className="border rounded px-2 py-2 md:col-span-2" rows={3} />
          <label className="flex items-center gap-2 text-sm"><input name="publish" type="checkbox" /> Publish</label>
          <button type="submit" className="border rounded px-3 py-2 bg-slate-900 text-white md:col-span-3 w-fit" disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? "Saving..." : "Create Task"}</button>
        </form>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="border rounded px-2 py-2" placeholder="Search title/description" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-2 py-2"><option value="">All statuses</option>{STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="border rounded px-2 py-2"><option value="">All assignees</option>{AGENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <select value={publishFilter} onChange={(e) => setPublishFilter(e.target.value)} className="border rounded px-2 py-2"><option value="">All visibility</option><option value="true">Published</option><option value="false">Internal</option></select>
          </div>

          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2">Title</th><th>Status</th><th>Assigned</th></tr></thead>
            <tbody>
              {(tasksQuery.data?.items || []).map((task) => (
                <tr key={task.id} className={`border-b cursor-pointer ${selectedTaskId === task.id ? "bg-slate-100" : ""}`} onClick={() => setSelectedTaskId(task.id)}>
                  <td className="py-2">{task.title}</td><td>{task.status}</td><td>{task.assignedTo || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-4">
          {!selectedTask ? (
            <p className="text-sm text-slate-500">Select a task to view overview, thread, review, and activity.</p>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Overview</h3>
                <p className="text-sm"><span className="font-medium">Title:</span> {selectedTask.title}</p>
                <p className="text-sm"><span className="font-medium">Description:</span> {selectedTask.description || "-"}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded border px-2 py-1">Status: {selectedTask.status}</span>
                  <span className="rounded border px-2 py-1">Priority: {selectedTask.priority}</span>
                  <span className="rounded border px-2 py-1">Assigned: {selectedTask.assignedTo || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <select className="border rounded px-2 py-1 text-sm" value={selectedTask.status} onChange={(e) => updateTaskMutation.mutate({ id: selectedTask.id, payload: { status: e.target.value, actor: "Cameron" } })}>{STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  <select className="border rounded px-2 py-1 text-sm" value={selectedTask.assignedTo || ""} onChange={(e) => updateTaskMutation.mutate({ id: selectedTask.id, payload: { assignedTo: e.target.value || null, actor: "Cameron" } })}><option value="">Unassigned</option>{AGENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold">Messages</h3>
                <div className="max-h-36 overflow-auto space-y-2 border rounded p-2">
                  {selectedTask.messages.map((m) => (
                    <div key={m.id} className="text-sm border-b pb-1"><span className="font-medium">{m.actor}</span> <span className="text-xs text-slate-500">({m.visibility})</span><p>{m.message}</p></div>
                  ))}
                  {!selectedTask.messages.length && <p className="text-xs text-slate-500">No messages.</p>}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (messageText.trim()) postMessageMutation.mutate({ id: selectedTask.id, message: messageText.trim() }); }} className="flex gap-2">
                  <input className="border rounded px-2 py-1 text-sm flex-1" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Add internal note" />
                  <button className="border rounded px-3 py-1 text-sm" type="submit">Send</button>
                </form>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold">Review</h3>
                <div className="space-y-1 text-sm">
                  <textarea className="border rounded px-2 py-1 w-full" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Review request note" />
                  <button className="border rounded px-3 py-1 text-sm" onClick={() => requestReviewMutation.mutate({ id: selectedTask.id, note: reviewNote })}>Request Review</button>
                </div>
                <div className="space-y-1 text-sm">
                  <textarea className="border rounded px-2 py-1 w-full" rows={2} value={reviewDecisionNote} onChange={(e) => setReviewDecisionNote(e.target.value)} placeholder="Decision note" />
                  <div className="flex gap-2">
                    <button className="border rounded px-2 py-1" onClick={() => decideReviewMutation.mutate({ id: selectedTask.id, decision: "approved", note: reviewDecisionNote })}>Approve</button>
                    <button className="border rounded px-2 py-1" onClick={() => decideReviewMutation.mutate({ id: selectedTask.id, decision: "changes_requested", note: reviewDecisionNote })}>Changes Requested</button>
                    <button className="border rounded px-2 py-1" onClick={() => decideReviewMutation.mutate({ id: selectedTask.id, decision: "rejected", note: reviewDecisionNote })}>Reject</button>
                  </div>
                </div>
                <div className="max-h-28 overflow-auto border rounded p-2 space-y-1">
                  {selectedTask.reviews.map((r) => <p key={r.id} className="text-xs">{r.requestedBy} requested {new Date(r.requestedAt).toLocaleString()} · decision: {r.decision || "pending"}</p>)}
                  {!selectedTask.reviews.length && <p className="text-xs text-slate-500">No reviews.</p>}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold">Activity</h3>
                <div className="max-h-36 overflow-auto border rounded p-2 space-y-1">
                  {selectedTask.activity.map((a) => <p key={a.id} className="text-xs">{new Date(a.createdAt).toLocaleString()} · {a.action} · {a.actor}{a.note ? ` · ${a.note}` : ""}</p>)}
                  {!selectedTask.activity.length && <p className="text-xs text-slate-500">No activity.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
