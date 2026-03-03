import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type TaskStatus =
  | 'draft' | 'in_review' | 'not_assigned' | 'assigned' | 'in_progress' | 'blocked'
  | 'completed' | 'archived' | 'done' | 'cancelled' | 'needs_review' | 'approved'
  | 'changes_requested' | 'rejected';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';
type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'ad-hoc';
type TaskAgent = 'bob' | 'jussi' | 'sally' | 'supplier' | 'codex' | 'cam' | 'staff';
type TaskArea = 'operations' | 'finance' | 'purchasing' | 'marketing' | 'dev' | 'compliance';

interface Task {
  id: number;
  taskNumber: string | null;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  priority: TaskPriority;
  status: TaskStatus;
  area: TaskArea | null;
  assignedTo: TaskAgent | null;
  publish: boolean;
  dueAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  followUpRequired: boolean;
  bobNotifiedAt: string | null;
  bobLastError: string | null;
}

interface TaskMessage {
  id: number;
  taskId: number;
  actor: string;
  message: string;
  visibility: 'internal' | 'public';
  createdAt: string;
}

interface TaskActivity {
  id: number;
  taskId: number;
  action: string;
  actor: string;
  note: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

interface TaskDetailResponse extends Task {
  messages: TaskMessage[];
  reviews: unknown[];
  activity: TaskActivity[];
}

const STATUS_OPTIONS: TaskStatus[] = [
  'draft', 'in_review', 'not_assigned', 'assigned', 'in_progress', 'blocked',
  'needs_review', 'approved', 'changes_requested', 'rejected', 'done', 'completed', 'cancelled',
];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent', 'critical'];
const AREA_OPTIONS: TaskArea[] = ['operations', 'finance', 'purchasing', 'marketing', 'dev', 'compliance'];
const AGENT_OPTIONS: TaskAgent[] = ['bob', 'jussi', 'sally', 'supplier', 'codex', 'cam', 'staff'];

function priorityBadge(p: TaskPriority) {
  const cls: Record<TaskPriority, string> = {
    critical: 'bg-red-100 text-red-700',
    urgent: 'bg-orange-100 text-orange-700',
    high: 'bg-yellow-100 text-yellow-700',
    medium: 'bg-indigo-100 text-indigo-700',
    low: 'bg-slate-100 text-slate-600',
  };
  return `inline-block rounded-[4px] px-2 py-0.5 text-xs font-medium capitalize ${cls[p] ?? cls.medium}`;
}

function statusBadge(s: TaskStatus) {
  const done = ['done', 'completed', 'approved'];
  const bad = ['cancelled', 'rejected', 'archived'];
  const warn = ['blocked', 'needs_review', 'changes_requested'];
  if (done.includes(s)) return 'bg-emerald-100 text-emerald-700';
  if (bad.includes(s)) return 'bg-slate-100 text-slate-500';
  if (warn.includes(s)) return 'bg-yellow-100 text-yellow-700';
  return 'bg-slate-100 text-slate-600';
}

function formatActivityPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  if (payload.changedFields && Array.isArray(payload.changedFields)) {
    return `changed: ${(payload.changedFields as string[]).join(', ')}`;
  }
  if (payload.status) return `status → ${payload.status}`;
  if (payload.assignedTo) return `assigned → ${payload.assignedTo}`;
  return null;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const taskId = parseInt(id ?? '', 10);

  const [tab, setTab] = useState<'details' | 'activity' | 'messages'>('details');
  const [editMode, setEditMode] = useState(false);
  const [commentText, setCommentText] = useState('');

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('draft');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editArea, setEditArea] = useState<TaskArea | ''>('');
  const [editAssignee, setEditAssignee] = useState<TaskAgent | ''>('');
  const [editDueAt, setEditDueAt] = useState('');
  const [editFrequency, setEditFrequency] = useState<TaskFrequency>('ad-hoc');

  const qk = [`/api/ai-ops/tasks/${taskId}`];

  const taskQuery = useQuery<TaskDetailResponse>({
    queryKey: qk,
    enabled: !isNaN(taskId),
  });

  const task = taskQuery.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/tasks') && !String(q.queryKey[0]).includes(`/${taskId}`) });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest(`/api/ai-ops/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => { setEditMode(false); invalidate(); },
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/ai-ops/tasks/${taskId}/archive`, { method: 'POST', body: JSON.stringify({ actor: 'Cameron' }) }),
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/ai-ops/tasks/${taskId}/restore`, { method: 'POST', body: JSON.stringify({ actor: 'Cameron' }) }),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/ai-ops/tasks/${taskId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'Cameron', message: commentText.trim(), visibility: 'internal' }),
      }),
    onSuccess: () => { setCommentText(''); invalidate(); },
  });

  const submitTaskMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/ai-ops/tasks/${taskId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'Cameron' }),
      }),
    onSuccess: invalidate,
  });

  const markDraftMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/ai-ops/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'draft', actor: 'Cameron' }),
      }),
    onSuccess: invalidate,
  });

  const toggleFollowUpMutation = useMutation({
    mutationFn: (val: boolean) =>
      apiRequest(`/api/ai-ops/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ followUpRequired: val, actor: 'Cameron' }),
      }),
    onSuccess: invalidate,
  });

  function startEdit() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditArea(task.area ?? '');
    setEditAssignee(task.assignedTo ?? '');
    setEditDueAt(task.dueAt ? task.dueAt.slice(0, 10) : '');
    setEditFrequency(task.frequency);
    setEditMode(true);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      status: editStatus,
      priority: editPriority,
      area: editArea || null,
      assignedTo: editAssignee || null,
      dueAt: editDueAt ? new Date(editDueAt).toISOString() : null,
      frequency: editFrequency,
      actor: 'Cameron',
    });
  }

  if (isNaN(taskId)) {
    return <div className="p-8 text-sm text-slate-500">Invalid task ID.</div>;
  }

  if (taskQuery.isLoading) {
    return <div className="p-8 text-sm text-slate-500">Loading task…</div>;
  }

  if (taskQuery.isError || !task) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500 mb-4">Task not found or failed to load.</p>
        <button className="text-xs text-emerald-600 hover:underline" onClick={() => navigate('/operations/ai-ops-control')}>
          ← Back to Work Register
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <button
          className="text-xs text-emerald-600 hover:underline"
          onClick={() => navigate('/operations/ai-ops-control')}
        >
          ← Work Register
        </button>
        {task.taskNumber && (
          <span className="text-xs text-slate-400">{task.taskNumber}</span>
        )}
      </div>

      <div className="rounded-[4px] border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 leading-snug mb-1">{task.title}</h1>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={priorityBadge(task.priority)}>{task.priority}</span>
          <span className={`inline-block rounded-[4px] px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(task.status)}`}>
            {task.status.replace(/_/g, ' ')}
          </span>
          {task.area && (
            <span className="inline-block rounded-[4px] bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">{task.area}</span>
          )}
          {task.followUpRequired && (
            <span className="inline-block rounded-[4px] bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
              Follow-up required
            </span>
          )}
          {task.bobNotifiedAt && (
            <span
              className="inline-block rounded-[4px] bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
              title={`Bob notified ${new Date(task.bobNotifiedAt).toLocaleString('en-GB')}`}
            >
              Bob notified ✓
            </span>
          )}
          {task.bobLastError && !task.bobNotifiedAt && (
            <span
              className="inline-block rounded-[4px] bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200"
              title={task.bobLastError}
            >
              Bob unreachable
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {task.status === 'draft' && !task.deletedAt && (
            <button
              className="rounded-[4px] border border-emerald-500 bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              onClick={() => submitTaskMutation.mutate()}
              disabled={submitTaskMutation.isPending}
            >
              {submitTaskMutation.isPending
                ? (task.assignedTo === 'bob' ? 'Submitting & notifying Bob…' : 'Submitting…')
                : (task.assignedTo === 'bob' ? 'Submit & Notify Bob' : 'Submit Task')}
            </button>
          )}
          <button
            className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium ${task.followUpRequired ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            onClick={() => toggleFollowUpMutation.mutate(!task.followUpRequired)}
            disabled={toggleFollowUpMutation.isPending}
          >
            {task.followUpRequired ? 'Remove Follow-up' : 'Flag Follow-up'}
          </button>
          {task.status !== 'draft' && !task.deletedAt && (
            <button
              className="rounded-[4px] border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
              onClick={() => markDraftMutation.mutate()}
              disabled={markDraftMutation.isPending}
            >
              Mark Draft
            </button>
          )}
          {task.deletedAt ? (
            <button
              className="rounded-[4px] border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
            >
              Restore
            </button>
          ) : (
            <button
              className="rounded-[4px] border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              Archive
            </button>
          )}
          {!editMode && (
            <button
              className="rounded-[4px] border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
              onClick={startEdit}
            >
              Edit
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-slate-400 mb-0.5">Assigned</p>
            <p className="font-medium text-slate-700 capitalize">{task.assignedTo ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Frequency</p>
            <p className="font-medium text-slate-700">{task.frequency}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Due</p>
            <p className="font-medium text-slate-700">{task.dueAt ? new Date(task.dueAt).toLocaleDateString('en-GB') : '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Created by</p>
            <p className="font-medium text-slate-700">{task.createdBy}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Created</p>
            <p className="font-medium text-slate-700">{new Date(task.createdAt).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Updated</p>
            <p className="font-medium text-slate-700">{new Date(task.updatedAt).toLocaleDateString('en-GB')}</p>
          </div>
          {task.completedAt && (
            <div>
              <p className="text-slate-400 mb-0.5">Completed</p>
              <p className="font-medium text-slate-700">{new Date(task.completedAt).toLocaleDateString('en-GB')}</p>
            </div>
          )}
          {task.deletedAt && (
            <div>
              <p className="text-slate-400 mb-0.5">Archived</p>
              <p className="font-medium text-slate-500">{new Date(task.deletedAt).toLocaleDateString('en-GB')}</p>
            </div>
          )}
        </div>
      </div>

      {editMode && (
        <div className="rounded-[4px] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Edit Task</h2>
          <form onSubmit={submitEdit} className="space-y-3">
            <input
              className="w-full h-9 rounded-[4px] border border-slate-300 px-3 text-sm bg-white"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              required
            />
            <textarea
              className="w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm bg-white resize-none"
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Status</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Priority</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Area</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value as TaskArea | '')}
                >
                  <option value="">No area</option>
                  {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Assigned to</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value as TaskAgent | '')}
                >
                  <option value="">Unassigned</option>
                  {AGENT_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Frequency</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as TaskFrequency)}
                >
                  {(['once', 'daily', 'weekly', 'monthly', 'ad-hoc'] as TaskFrequency[]).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Due date</label>
                <input
                  type="date"
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs bg-white"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={task.followUpRequired}
                onChange={(e) => toggleFollowUpMutation.mutate(e.target.checked)}
                className="rounded border-slate-300"
              />
              Follow-up required
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="rounded-[4px] border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="rounded-[4px] border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                onClick={() => setEditMode(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-[4px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(['details', 'activity', 'messages'] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-2.5 text-xs font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setTab(t)}
            >
              {t === 'messages' ? `Comments (${task.messages?.length ?? 0})` :
               t === 'activity' ? `Activity (${task.activity?.length ?? 0})` : 'Details'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'details' && (
            <div className="text-sm text-slate-700">
              {task.description ? (
                <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
              ) : (
                <p className="text-slate-400 italic text-xs">No description.</p>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-1">
              {(task.activity ?? []).length === 0 && (
                <p className="text-xs text-slate-400">No activity yet.</p>
              )}
              {(task.activity ?? []).map((a) => {
                const extra = formatActivityPayload(a.payload);
                return (
                  <div key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 border-b border-slate-50 text-xs last:border-b-0">
                    <span className="text-slate-400 whitespace-nowrap tabular-nums">{new Date(a.createdAt).toLocaleDateString('en-GB')}</span>
                    <span className="font-medium text-slate-700">{a.actor}</span>
                    <span className="text-slate-500 capitalize">{a.action.replace(/_/g, ' ')}</span>
                    {extra && <span className="text-slate-400">— {extra}</span>}
                    {a.note && <span className="text-slate-400 italic">— {a.note}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(task.messages ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">No comments yet.</p>
                )}
                {(task.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-[4px] border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span className="font-medium text-slate-700">{m.actor}</span>
                      <span>{new Date(m.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-1">
                <textarea
                  className="w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  rows={3}
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  className="rounded-[4px] border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
