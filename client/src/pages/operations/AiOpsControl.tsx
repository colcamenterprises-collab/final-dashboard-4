import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type TaskStatus = "draft" | "not_assigned" | "assigned" | "in_progress" | "blocked" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskFrequency = "once" | "daily" | "weekly" | "monthly" | "ad-hoc";
type TaskAgent = "bob" | "jussi" | "sally" | "supplier" | "codex";

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

type TaskEvent = {
  id: string;
  taskId: string;
  eventType: string;
  actor: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

const STATUS_OPTIONS: TaskStatus[] = ["draft", "not_assigned", "assigned", "in_progress", "blocked", "done", "cancelled"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];
const FREQUENCY_OPTIONS: TaskFrequency[] = ["once", "daily", "weekly", "monthly", "ad-hoc"];
const AGENT_OPTIONS: TaskAgent[] = ["bob", "jussi", "sally", "supplier", "codex"];

const AGENT_OVERVIEW = [
  {
    name: "Bob",
    title: "AI Operations Manager",
    description: "Orchestrates tasks, assigns specialists, enforces thresholds, and maintains the audit trail.",
  },
  {
    name: "Jussi",
    title: "Operations Analyst",
    description: "Reconciles sales, flags stock variances, and analyses items and modifiers per shift.",
  },
  {
    name: "Sally",
    title: "Financial Controller",
    description: "Audits wages, shift expenses, and rolling 24-hour business costs.",
  },
  {
    name: "Supplier",
    title: "Procurement Coordinator",
    description: "Generates supplier-ready orders, confirms acknowledgements, and books deliveries.",
  },
  {
    name: "Codex",
    title: "Software Engineer",
    description: "Implements fixes, migrations, and system enhancements.",
  },
] as const;

export default function AiOpsControlPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [noteText, setNoteText] = useState("");

  const taskQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (agentFilter) params.set("assignedTo", agentFilter);
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [statusFilter, agentFilter]);

  const tasksQuery = useQuery<{ items: Task[] }>({
    queryKey: [`/api/ops/ai/tasks${taskQueryString}`],
  });

  const selectedTask = tasksQuery.data?.items.find((task) => task.id === selectedTaskId) || null;

  const eventsQuery = useQuery<{ items: TaskEvent[] }>({
    queryKey: selectedTaskId ? [`/api/ops/ai/tasks/${selectedTaskId}/events`] : ["/api/ops/ai/tasks/noop"],
    enabled: Boolean(selectedTaskId),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiRequest("/api/ops/ai/tasks", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/ai/tasks"] });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && String(query.queryKey[0]).startsWith("/api/ops/ai/tasks?") });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest(`/api/ops/ai/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/ai/tasks"] });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && String(query.queryKey[0]).startsWith("/api/ops/ai/tasks?") });
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ops/ai/tasks/${selectedTaskId}/events`] });
      }
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) =>
      apiRequest(`/api/ops/ai/tasks/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ actor: "Cameron", note, publish: false }),
      }),
    onSuccess: () => {
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ops/ai/tasks/${selectedTaskId}/events`] });
      }
      setNoteText("");
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

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI Ops Control</h1>
        <p className="text-sm text-slate-600">Task queue, assignment control, and audit trail for multi-agent operations.</p>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {AGENT_OVERVIEW.map((agent) => (
          <article
            key={agent.name}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
          >
            <p className="text-base font-semibold text-slate-900">{agent.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{agent.title}</p>
            <p className="mt-2 text-sm text-slate-600">{agent.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">Create Task</h2>
        <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <input name="title" placeholder="Task title" className="border rounded px-2 py-2" required />
          <select name="frequency" className="border rounded px-2 py-2" defaultValue="ad-hoc">
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select name="priority" className="border rounded px-2 py-2" defaultValue="medium">
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select name="status" className="border rounded px-2 py-2" defaultValue="draft">
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select name="assignedTo" className="border rounded px-2 py-2" defaultValue="">
            <option value="">Unassigned</option>
            {AGENT_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input name="dueAt" type="datetime-local" className="border rounded px-2 py-2" />
          <textarea name="description" placeholder="Description" className="border rounded px-2 py-2 md:col-span-2" rows={3} />
          <label className="flex items-center gap-2 text-sm">
            <input name="publish" type="checkbox" /> Publish
          </label>
          <button type="submit" className="border rounded px-3 py-2 bg-slate-900 text-white md:col-span-3 w-fit" disabled={createTaskMutation.isPending}>
            {createTaskMutation.isPending ? "Saving..." : "Create Task"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex gap-2 text-sm">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="border rounded px-2 py-2">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="border rounded px-2 py-2">
            <option value="">All assignees</option>
            {AGENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {(tasksQuery.data?.items || []).map((task) => (
              <tr
                key={task.id}
                className={`border-b cursor-pointer ${selectedTaskId === task.id ? "bg-slate-100" : ""}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <td className="py-2">{task.title}</td>
                <td>
                  <select
                    value={task.status}
                    onChange={(event) => updateTaskMutation.mutate({ id: task.id, payload: { status: event.target.value, actor: "Cameron" } })}
                    className="border rounded px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </td>
                <td>{task.priority}</td>
                <td>
                  <select
                    value={task.assignedTo || ""}
                    onChange={(event) => updateTaskMutation.mutate({ id: task.id, payload: { assignedTo: event.target.value || null, actor: "Cameron" } })}
                    className="border rounded px-2 py-1"
                  >
                    <option value="">Unassigned</option>
                    {AGENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </td>
                <td>{task.dueAt ? new Date(task.dueAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold">Audit Trail</h2>
        {!selectedTask && <p className="text-sm text-slate-600">Select a task to view full history and internal notes.</p>}
        {selectedTask && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedTaskId || !noteText.trim()) return;
                addNoteMutation.mutate({ id: selectedTaskId, note: noteText });
              }}
            >
              <input value={noteText} onChange={(event) => setNoteText(event.target.value)} className="border rounded px-2 py-2 flex-1" placeholder="Internal note (not published)" />
              <button type="submit" className="border rounded px-3 py-2" disabled={addNoteMutation.isPending}>Add Note</button>
            </form>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">When</th>
                  <th>Type</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {(eventsQuery.data?.items || []).map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="py-2">{new Date(event.createdAt).toLocaleString()}</td>
                    <td>{event.eventType}</td>
                    <td>{event.actor}</td>
                    <td>{event.note || JSON.stringify(event.payload || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
