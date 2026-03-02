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
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-slate-100 text-slate-600',
  };
  return `inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls[p] ?? cls.medium}`;
}

function statusBadge(s: TaskStatus) {
  const done = ['done', 'completed', 'approved'];
  const bad = ['cancelled', 'rejected', 'archived'];
  const warn = ['blocked', 'needs_review', 'changes_requested'];
  if (done.includes(s)) return 'bg-emerald-100 text-emerald-700';
  if (bad.includes(s)) return 'bg-slate-100 text-slate-500';
  if (warn.includes(s)) return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
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
    return <div className="p-8 text-slate-500">Invalid task ID.</div>;
  }

  if (taskQuery.isLoading) {
    return <div className="p-8 text-slate-500">Loading task…</div>;
  }

  if (taskQuery.isError || !task) {
    return (
      <div className="p-8">
        <p className="text-slate-500 mb-4">Task not found or failed to load.</p>
        <button className="text-sm text-emerald-600 hover:underline" onClick={() => navigate('/operations/ai-ops-control')}>
          ← Back to Work Register
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{task.title}</h1>
            {task.description && (
              <p className="mt-1 text-sm text-slate-600">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {task.deletedAt ? (
              <button
                className="rounded-[4px] border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
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
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={priorityBadge(task.priority)}>{task.priority}</span>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(task.status)}`}>
            {task.status.replace(/_/g, ' ')}
          </span>
          {task.area && (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">{task.area}</span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <span className="text-slate-400">Assigned</span>
            <p className="font-medium text-slate-700 capitalize">{task.assignedTo ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Frequency</span>
            <p className="font-medium text-slate-700">{task.frequency}</p>
          </div>
          <div>
            <span className="text-slate-400">Due</span>
            <p className="font-medium text-slate-700">{task.dueAt ? new Date(task.dueAt).toLocaleDateString('en-GB') : '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Created by</span>
            <p className="font-medium text-slate-700">{task.createdBy}</p>
          </div>
          <div>
            <span className="text-slate-400">Created</span>
            <p className="font-medium text-slate-700">{new Date(task.createdAt).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <span className="text-slate-400">Updated</span>
            <p className="font-medium text-slate-700">{new Date(task.updatedAt).toLocaleDateString('en-GB')}</p>
          </div>
          {task.completedAt && (
            <div>
              <span className="text-slate-400">Completed</span>
              <p className="font-medium text-slate-700">{new Date(task.completedAt).toLocaleDateString('en-GB')}</p>
            </div>
          )}
          {task.deletedAt && (
            <div>
              <span className="text-slate-400">Archived</span>
              <p className="font-medium text-slate-500">{new Date(task.deletedAt).toLocaleDateString('en-GB')}</p>
            </div>
          )}
        </div>
      </div>

      {editMode && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Edit Task</h2>
          <form onSubmit={submitEdit} className="space-y-3">
            <input
              className="w-full h-9 rounded-[4px] border border-slate-300 px-3 text-sm"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              required
            />
            <textarea
              className="w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Status</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Priority</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Area</label>
                <select
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
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
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
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
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
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
                  className="w-full h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-[4px] border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
            <div className="space-y-3 text-sm text-slate-700">
              {task.description ? (
                <p className="whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-slate-400 italic">No description.</p>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2">
              {(task.activity ?? []).length === 0 && (
                <p className="text-xs text-slate-400">No activity yet.</p>
              )}
              {(task.activity ?? []).map((a) => (
                <div key={a.id} className="flex gap-3 text-xs">
                  <span className="text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString('en-GB')}</span>
                  <span className="font-medium text-slate-600">{a.actor}</span>
                  <span className="text-slate-500 capitalize">{a.action.replace(/_/g, ' ')}</span>
                  {a.note && <span className="text-slate-400 italic">— {a.note}</span>}
                  {a.payload && (
                    <span className="text-slate-300 font-mono">{JSON.stringify(a.payload)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(task.messages ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">No comments yet.</p>
                )}
                {(task.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-[4px] border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-medium text-slate-700">{m.actor}</span>
                      <span>{new Date(m.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  className="flex-1 rounded-[4px] border border-slate-300 px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  className="self-end rounded-[4px] border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? '…' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
