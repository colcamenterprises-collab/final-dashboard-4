import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type TaskStatus =
  | 'draft'
  | 'not_assigned'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'cancelled'
  | 'needs_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'ad-hoc';
type TaskAgent = 'bob' | 'jussi' | 'sally' | 'supplier' | 'codex';

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

type TaskMessage = {
  id: string;
  taskId: string;
  actor: string;
  message: string;
  visibility: 'internal' | 'public';
  createdAt: string;
};
type TaskReview = {
  id: string;
  taskId: string;
  requestedBy: string;
  requestNote: string | null;
  requestedAt: string;
  decision: 'approved' | 'changes_requested' | 'rejected' | null;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
};
type TaskActivity = {
  id: string;
  taskId: string;
  action: string;
  actor: string;
  note: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};
type TaskDetail = Task & {
  messages: TaskMessage[];
  reviews: TaskReview[];
  activity: TaskActivity[];
};

type IssueStatus =
  | 'draft'
  | 'triage'
  | 'plan_pending'
  | 'approval_requested'
  | 'approved'
  | 'in_progress'
  | 'needs_review'
  | 'done'
  | 'closed'
  | 'rejected';
type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
type Issue = {
  id: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  createdBy: string;
  ownerAgent: string;
  assignee: string | null;
  planMd: string | null;
  approvalNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  completedBy: string | null;
  completedAt: string | null;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type IssueComment = {
  id: string;
  issueId: string;
  author: string;
  visibility: 'internal' | 'public';
  message: string;
  createdAt: string;
};
type IssueActivity = {
  id: string;
  issueId: string;
  actor: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
};
type IssueDetail = Issue & { comments: IssueComment[]; activity: IssueActivity[] };

type IdeaStatus = 'new' | 'triage' | 'accepted' | 'converted' | 'rejected' | 'archived';
type IdeaCategory = 'ops' | 'finance' | 'marketing' | 'tech' | 'product';
type Idea = {
  id: string;
  title: string;
  description: string | null;
  category: IdeaCategory | null;
  status: IdeaStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
type IdeaActivity = {
  id: string;
  ideaId: string;
  actor: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
};
type IdeaDetail = Idea & { activity: IdeaActivity[] };

type AgentItem = {
  agent: TaskAgent;
  name: string;
  role: string;
  description: string;
  status: string;
  statusMessage: string | null;
};
type SelectedItem = { type: 'task' | 'issue' | 'idea'; id: string } | null;

const STATUS_OPTIONS: TaskStatus[] = [
  'draft',
  'not_assigned',
  'assigned',
  'in_progress',
  'blocked',
  'needs_review',
  'approved',
  'changes_requested',
  'rejected',
  'done',
  'cancelled',
];
const AGENT_OPTIONS: TaskAgent[] = ['bob', 'jussi', 'sally', 'supplier', 'codex'];
const ISSUE_STATUS_OPTIONS: IssueStatus[] = [
  'draft',
  'triage',
  'plan_pending',
  'approval_requested',
  'approved',
  'in_progress',
  'needs_review',
  'done',
  'closed',
  'rejected',
];
const ISSUE_SEVERITY_OPTIONS: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];
const ISSUE_ASSIGNEE_OPTIONS = ['Bob', 'Jussi', 'Sally', 'Supplier', 'Codex', 'Cameron'];
const IDEA_STATUS_OPTIONS: IdeaStatus[] = [
  'new',
  'triage',
  'accepted',
  'converted',
  'rejected',
  'archived',
];
const IDEA_CATEGORY_OPTIONS: IdeaCategory[] = ['ops', 'finance', 'marketing', 'tech', 'product'];

const AGENT_HEADSHOTS: Partial<Record<TaskAgent, string>> = {};

const agentStatusStyles: Record<
  string,
  { label: 'Online' | 'Busy' | 'Offline'; className: string }
> = {
  idle: { label: 'Online', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  running: { label: 'Busy', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  waiting: { label: 'Busy', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  blocked: { label: 'Busy', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Offline', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  offline: { label: 'Offline', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AiOpsControlPage() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const selectedTaskId = selectedItem?.type === 'task' ? selectedItem.id : null;
  const selectedIssueId = selectedItem?.type === 'issue' ? selectedItem.id : null;
  const selectedIdeaId = selectedItem?.type === 'idea' ? selectedItem.id : null;

  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskAgentFilter, setTaskAgentFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskFrequency, setTaskFrequency] = useState<TaskFrequency>('ad-hoc');
  const [taskAssignee, setTaskAssignee] = useState<TaskAgent | ''>('');
  const [messageText, setMessageText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewDecisionNote, setReviewDecisionNote] = useState('');

  const [issueStatusFilter, setIssueStatusFilter] = useState('');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState('');
  const [issueAssigneeFilter, setIssueAssigneeFilter] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueComment, setIssueComment] = useState('');
  const [issuePlan, setIssuePlan] = useState('');
  const [issueApprovalNote, setIssueApprovalNote] = useState('');
  const [issueDecisionNote, setIssueDecisionNote] = useState('');
  const [issueActor, setIssueActor] = useState('Cameron');
  const [issueAssignee, setIssueAssignee] = useState('Bob');

  const [ideaStatusFilter, setIdeaStatusFilter] = useState('');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState('');
  const [ideaSearch, setIdeaSearch] = useState('');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaCategory, setIdeaCategory] = useState<IdeaCategory>('ops');
  const [convertIssueSeverity, setConvertIssueSeverity] = useState<IssueSeverity>('medium');

  const taskQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (taskStatusFilter) params.set('status', taskStatusFilter);
    if (taskAgentFilter) params.set('assignedTo', taskAgentFilter);
    if (taskSearch.trim()) params.set('q', taskSearch.trim());
    return params.toString() ? `?${params.toString()}` : '';
  }, [taskStatusFilter, taskAgentFilter, taskSearch]);

  const issueQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (issueStatusFilter) params.set('status', issueStatusFilter);
    if (issueSeverityFilter) params.set('severity', issueSeverityFilter);
    if (issueAssigneeFilter) params.set('assignee', issueAssigneeFilter);
    if (issueSearch.trim()) params.set('q', issueSearch.trim());
    return params.toString() ? `?${params.toString()}` : '';
  }, [issueStatusFilter, issueSeverityFilter, issueAssigneeFilter, issueSearch]);

  const ideaQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (ideaStatusFilter) params.set('status', ideaStatusFilter);
    if (ideaCategoryFilter) params.set('category', ideaCategoryFilter);
    if (ideaSearch.trim()) params.set('q', ideaSearch.trim());
    return params.toString() ? `?${params.toString()}` : '';
  }, [ideaStatusFilter, ideaCategoryFilter, ideaSearch]);

  const agentsQuery = useQuery<{ items: AgentItem[] }>({ queryKey: ['/api/ai-ops/agents'] });
  const tasksQuery = useQuery<{ items: Task[] }>({ queryKey: [`/api/ai-ops/tasks${taskQuery}`] });
  const taskDetailQuery = useQuery<TaskDetail>({
    queryKey: selectedTaskId ? [`/api/ai-ops/tasks/${selectedTaskId}`] : ['noop-task'],
    enabled: Boolean(selectedTaskId),
  });

  const issuesQuery = useQuery<{ ok: true; items: Issue[] }>({
    queryKey: [`/api/ai-ops/issues${issueQuery}`],
  });
  const issueDetailQuery = useQuery<{ ok: true; item: IssueDetail }>({
    queryKey: selectedIssueId ? [`/api/ai-ops/issues/${selectedIssueId}`] : ['noop-issue'],
    enabled: Boolean(selectedIssueId),
  });

  const ideasQuery = useQuery<{ ok: true; items: Idea[] }>({
    queryKey: [`/api/ai-ops/ideas${ideaQuery}`],
  });
  const ideaDetailQuery = useQuery<{ ok: true; item: IdeaDetail }>({
    queryKey: selectedIdeaId ? [`/api/ai-ops/ideas/${selectedIdeaId}`] : ['noop-idea'],
    enabled: Boolean(selectedIdeaId),
  });

  const refreshTasks = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/tasks'),
    });
  const refreshIssues = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/issues'),
    });
  const refreshIdeas = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/ideas'),
    });

  const createTaskMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/ai-ops/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskFrequency('ad-hoc');
      setTaskAssignee('');
      refreshTasks();
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest(`/api/ai-ops/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: refreshTasks,
  });
  const messageTaskMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      apiRequest(`/api/ai-ops/tasks/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'Cameron', message, visibility: 'internal' }),
      }),
    onSuccess: () => {
      setMessageText('');
      refreshTasks();
    },
  });
  const reviewTaskMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest(`/api/ai-ops/tasks/${id}/review-request`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'Cameron', note }),
      }),
    onSuccess: () => {
      setReviewNote('');
      refreshTasks();
    },
  });
  const decisionTaskMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'approved' | 'changes_requested' | 'rejected';
      note: string;
    }) =>
      apiRequest(`/api/ai-ops/tasks/${id}/review-decision`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'Cameron', decision, note }),
      }),
    onSuccess: () => {
      setReviewDecisionNote('');
      refreshTasks();
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/ai-ops/issues', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: refreshIssues,
  });
  const updateIssueMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest(`/api/ai-ops/issues/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: refreshIssues,
  });
  const issueActionMutation = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload: Record<string, unknown> }) =>
      apiRequest(path, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setIssueComment('');
      refreshIssues();
    },
  });

  const createIdeaMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/ai-ops/ideas', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setIdeaTitle('');
      setIdeaDescription('');
      refreshIdeas();
    },
  });
  const ideaActionMutation = useMutation({
    mutationFn: ({
      path,
      payload,
      method = 'POST',
    }: {
      path: string;
      payload: Record<string, unknown>;
      method?: 'POST' | 'PUT';
    }) => apiRequest(path, { method, body: JSON.stringify(payload) }),
    onSuccess: () => {
      refreshIdeas();
      refreshIssues();
      refreshTasks();
    },
  });

  const selectedTask = taskDetailQuery.data;
  const selectedIssue = issueDetailQuery.data?.item;
  const selectedIdea = ideaDetailQuery.data?.item;

  useEffect(() => {
    if (selectedIssue) setIssuePlan(selectedIssue.planMd || '');
  }, [selectedIssue]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">AI Ops Control</h1>
        <p className="text-sm text-slate-600">
          Central command for AI task execution, incident workflow, and idea intake.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(agentsQuery.data?.items || []).map((agent) => {
          const statusMeta = agentStatusStyles[agent.status] || agentStatusStyles.offline;
          return (
            <article
              key={agent.agent}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                {AGENT_HEADSHOTS[agent.agent] ? (
                  <img
                    src={AGENT_HEADSHOTS[agent.agent]}
                    alt={agent.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {getInitials(agent.name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                  <p className="line-clamp-1 text-xs text-slate-600">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-medium ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                createTaskMutation.mutate({
                  title: taskTitle.trim(),
                  description: taskDescription.trim() || null,
                  priority: taskPriority,
                  frequency: taskFrequency,
                  assignedTo: taskAssignee || null,
                  createdBy: 'Cameron',
                });
              }}
              className="grid gap-2 rounded-lg border border-slate-200 p-3"
            >
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="New task title"
              />
              <textarea
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Description"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                >
                  {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={taskFrequency}
                  onChange={(e) => setTaskFrequency(e.target.value as TaskFrequency)}
                >
                  {(['once', 'daily', 'weekly', 'monthly', 'ad-hoc'] as TaskFrequency[]).map(
                    (f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    )
                  )}
                </select>
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value as TaskAgent | '')}
                >
                  {' '}
                  <option value="">Unassigned</option>
                  {AGENT_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="w-fit rounded border border-slate-300 px-3 py-1 text-sm"
                type="submit"
              >
                Create Task
              </button>
            </form>

            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={taskAgentFilter}
                onChange={(e) => setTaskAgentFilter(e.target.value)}
              >
                <option value="">All assignees</option>
                {AGENT_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-2 py-1"
                placeholder="Search"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Title</th>
                  <th>Status</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {(tasksQuery.data?.items || []).map((task) => (
                  <tr
                    key={task.id}
                    className={`cursor-pointer border-b border-slate-100 ${selectedTaskId === task.id ? 'bg-slate-100' : ''}`}
                    onClick={() => setSelectedItem({ type: 'task', id: task.id })}
                  >
                    <td className="py-2">{task.title}</td>
                    <td>{task.status}</td>
                    <td>{task.assignedTo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Issues Register</h2>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const title = (
                  form.elements.namedItem('issueTitle') as HTMLInputElement
                ).value.trim();
                const description = (
                  form.elements.namedItem('issueDescription') as HTMLTextAreaElement
                ).value.trim();
                if (!title) return;
                createIssueMutation.mutate({
                  title,
                  description: description || null,
                  createdBy: 'Bob',
                  severity: 'medium',
                  status: 'triage',
                  ownerAgent: 'Bob',
                });
                form.reset();
              }}
              className="space-y-2 rounded-lg border border-slate-200 p-3"
            >
              <input
                name="issueTitle"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="New issue title"
              />
              <textarea
                name="issueDescription"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                rows={2}
                placeholder="Description"
              />
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" type="submit">
                Create Issue
              </button>
            </form>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={issueStatusFilter}
                onChange={(e) => setIssueStatusFilter(e.target.value)}
              >
                <option value="">All status</option>
                {ISSUE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={issueSeverityFilter}
                onChange={(e) => setIssueSeverityFilter(e.target.value)}
              >
                <option value="">All severity</option>
                {ISSUE_SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={issueAssigneeFilter}
                onChange={(e) => setIssueAssigneeFilter(e.target.value)}
              >
                <option value="">All assignees</option>
                {ISSUE_ASSIGNEE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-2 py-1"
                placeholder="Search"
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
              />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Title</th>
                  <th>Status</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {(issuesQuery.data?.items || []).map((issue) => (
                  <tr
                    key={issue.id}
                    className={`cursor-pointer border-b border-slate-100 ${selectedIssueId === issue.id ? 'bg-slate-100' : ''}`}
                    onClick={() => {
                      setSelectedItem({ type: 'issue', id: issue.id });
                      setIssuePlan(issue.planMd || '');
                    }}
                  >
                    <td className="py-2">{issue.title}</td>
                    <td>{issue.status}</td>
                    <td>{issue.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Ideas Register</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!ideaTitle.trim()) return;
                createIdeaMutation.mutate({
                  title: ideaTitle.trim(),
                  description: ideaDescription.trim() || null,
                  category: ideaCategory,
                  createdBy: 'Bob',
                });
              }}
              className="space-y-2 rounded-lg border border-slate-200 p-3"
            >
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={ideaTitle}
                onChange={(e) => setIdeaTitle(e.target.value)}
                placeholder="Idea title"
              />
              <textarea
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                rows={2}
                value={ideaDescription}
                onChange={(e) => setIdeaDescription(e.target.value)}
                placeholder="Idea description"
              />
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={ideaCategory}
                onChange={(e) => setIdeaCategory(e.target.value as IdeaCategory)}
              >
                {IDEA_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" type="submit">
                Add Idea
              </button>
            </form>

            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={ideaStatusFilter}
                onChange={(e) => setIdeaStatusFilter(e.target.value)}
              >
                <option value="">All status</option>
                {IDEA_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={ideaCategoryFilter}
                onChange={(e) => setIdeaCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {IDEA_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-2 py-1"
                value={ideaSearch}
                onChange={(e) => setIdeaSearch(e.target.value)}
                placeholder="Search"
              />
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Title</th>
                  <th>Status</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {(ideasQuery.data?.items || []).map((idea) => (
                  <tr
                    key={idea.id}
                    className={`cursor-pointer border-b border-slate-100 ${selectedIdeaId === idea.id ? 'bg-slate-100' : ''}`}
                    onClick={() => setSelectedItem({ type: 'idea', id: idea.id })}
                  >
                    <td className="py-2">{idea.title}</td>
                    <td>{idea.status}</td>
                    <td>{idea.category || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 h-fit">
          {!selectedItem && (
            <p className="text-sm text-slate-500">Select an item to view details.</p>
          )}

          {selectedItem?.type === 'task' && (
            <div className="space-y-3">
              {!selectedTask ? (
                <p className="text-sm text-slate-500">Select an item to view details.</p>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900">Task Detail</h3>
                  <p className="text-sm">
                    <span className="font-medium">Title:</span> {selectedTask.title}
                  </p>
                  <div className="flex gap-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selectedTask.status}
                      onChange={(e) =>
                        updateTaskMutation.mutate({
                          id: selectedTask.id,
                          payload: { status: e.target.value, actor: 'Cameron' },
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selectedTask.assignedTo || ''}
                      onChange={(e) =>
                        updateTaskMutation.mutate({
                          id: selectedTask.id,
                          payload: { assignedTo: e.target.value || null, actor: 'Cameron' },
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {AGENT_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-28 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm">
                    {selectedTask.messages.map((m) => (
                      <p key={m.id}>
                        <strong>{m.actor}</strong>: {m.message}
                      </p>
                    ))}
                    {!selectedTask.messages.length && (
                      <p className="text-xs text-slate-500">No messages.</p>
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (messageText.trim())
                        messageTaskMutation.mutate({
                          id: selectedTask.id,
                          message: messageText.trim(),
                        });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Add note"
                    />
                    <button
                      className="rounded border border-slate-300 px-3 py-1 text-sm"
                      type="submit"
                    >
                      Send
                    </button>
                  </form>

                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Review request note"
                  />
                  <button
                    className="rounded border border-slate-300 px-3 py-1 text-sm"
                    onClick={() =>
                      reviewTaskMutation.mutate({ id: selectedTask.id, note: reviewNote })
                    }
                  >
                    Request Review
                  </button>
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={reviewDecisionNote}
                    onChange={(e) => setReviewDecisionNote(e.target.value)}
                    placeholder="Review decision note"
                  />
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      className="rounded border border-slate-300 px-2 py-1"
                      onClick={() =>
                        decisionTaskMutation.mutate({
                          id: selectedTask.id,
                          decision: 'approved',
                          note: reviewDecisionNote,
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1"
                      onClick={() =>
                        decisionTaskMutation.mutate({
                          id: selectedTask.id,
                          decision: 'changes_requested',
                          note: reviewDecisionNote,
                        })
                      }
                    >
                      Changes Requested
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1"
                      onClick={() =>
                        decisionTaskMutation.mutate({
                          id: selectedTask.id,
                          decision: 'rejected',
                          note: reviewDecisionNote,
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedItem?.type === 'issue' && (
            <div className="space-y-3">
              {!selectedIssue ? (
                <p className="text-sm text-slate-500">Select an item to view details.</p>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900">Issue Detail</h3>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={selectedIssue.title}
                    onChange={(e) =>
                      updateIssueMutation.mutate({
                        id: selectedIssue.id,
                        payload: { title: e.target.value, actor: 'Bob' },
                      })
                    }
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded border border-slate-300 px-2 py-1">
                      Severity: {selectedIssue.severity}
                    </span>
                    <span className="rounded border border-slate-300 px-2 py-1">
                      Status: {selectedIssue.status}
                    </span>
                    <span className="rounded border border-slate-300 px-2 py-1">
                      Created By: {selectedIssue.createdBy}
                    </span>
                  </div>
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={4}
                    value={issuePlan}
                    onChange={(e) => setIssuePlan(e.target.value)}
                    placeholder="Bob Plan"
                  />
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={issueApprovalNote}
                    onChange={(e) => setIssueApprovalNote(e.target.value)}
                    placeholder="Approval note (optional)"
                  />
                  <button
                    className="rounded border border-slate-300 px-3 py-1 text-sm"
                    onClick={() =>
                      issueActionMutation.mutate({
                        path: `/api/ai-ops/issues/${selectedIssue.id}/plan`,
                        payload: {
                          actor: 'Bob',
                          planMd: issuePlan,
                          approvalNote: issueApprovalNote || null,
                        },
                      })
                    }
                  >
                    Request Sign-off
                  </button>

                  <div className="flex gap-2 items-center">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={issueActor}
                      onChange={(e) => setIssueActor(e.target.value)}
                    >
                      {['Cameron', 'Bob'].map((actor) => (
                        <option key={actor} value={actor}>
                          {actor}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/approve`,
                          payload: { approvedBy: issueActor, note: issueDecisionNote || null },
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/reject`,
                          payload: { rejectedBy: issueActor, note: issueDecisionNote || null },
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={issueDecisionNote}
                    onChange={(e) => setIssueDecisionNote(e.target.value)}
                    placeholder="Decision note"
                  />

                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={issueAssignee}
                      onChange={(e) => setIssueAssignee(e.target.value)}
                    >
                      {ISSUE_ASSIGNEE_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/assign`,
                          payload: { assignee: issueAssignee, actor: 'Bob' },
                        })
                      }
                    >
                      Assign
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/complete`,
                          payload: { completedBy: issueAssignee, note: null },
                        })
                      }
                    >
                      Mark completed
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/close`,
                          payload: { closedBy: 'Bob', note: null },
                        })
                      }
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-24 overflow-auto rounded border border-slate-200 p-2 text-sm space-y-1">
                    {selectedIssue.comments.map((c) => (
                      <p key={c.id}>
                        <strong>{c.author}</strong>: {c.message}
                      </p>
                    ))}
                    {!selectedIssue.comments.length && (
                      <p className="text-xs text-slate-500">No comments.</p>
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (issueComment.trim())
                        issueActionMutation.mutate({
                          path: `/api/ai-ops/issues/${selectedIssue.id}/comments`,
                          payload: {
                            author: 'Cameron',
                            message: issueComment.trim(),
                            visibility: 'internal',
                          },
                        });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      className="rounded border border-slate-300 px-2 py-1 text-sm flex-1"
                      value={issueComment}
                      onChange={(e) => setIssueComment(e.target.value)}
                      placeholder="Add comment"
                    />
                    <button
                      className="rounded border border-slate-300 px-3 py-1 text-sm"
                      type="submit"
                    >
                      Send
                    </button>
                  </form>

                  <div className="max-h-28 overflow-auto rounded border border-slate-200 p-2 text-xs space-y-1">
                    {selectedIssue.activity.map((a) => (
                      <p key={a.id}>
                        {new Date(a.createdAt).toLocaleString()} · {a.action} · {a.actor}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedItem?.type === 'idea' && (
            <div className="space-y-3">
              {!selectedIdea ? (
                <p className="text-sm text-slate-500">Select an item to view details.</p>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900">Idea Detail</h3>
                  <p className="text-sm font-medium">{selectedIdea.title}</p>
                  <p className="text-sm">{selectedIdea.description || '-'}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selectedIdea.status}
                      onChange={(e) =>
                        ideaActionMutation.mutate({
                          path: `/api/ai-ops/ideas/${selectedIdea.id}/status`,
                          method: 'PUT',
                          payload: { status: e.target.value, actor: 'Bob' },
                        })
                      }
                    >
                      {IDEA_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={convertIssueSeverity}
                      onChange={(e) => setConvertIssueSeverity(e.target.value as IssueSeverity)}
                    >
                      {ISSUE_SEVERITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        ideaActionMutation.mutate({
                          path: `/api/ai-ops/ideas/${selectedIdea.id}/convert-to-issue`,
                          payload: {
                            actor: 'Bob',
                            severity: convertIssueSeverity,
                            descriptionAppend: null,
                          },
                        })
                      }
                    >
                      Convert to Issue
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      onClick={() =>
                        ideaActionMutation.mutate({
                          path: `/api/ai-ops/ideas/${selectedIdea.id}/convert-to-task`,
                          payload: {
                            actor: 'Bob',
                            taskTitle: selectedIdea.title,
                            taskDescription: selectedIdea.description,
                            priority: 'medium',
                            type: 'ad-hoc',
                          },
                        })
                      }
                    >
                      Convert to Task
                    </button>
                  </div>
                  <div className="max-h-40 overflow-auto rounded border border-slate-200 p-2 text-xs space-y-1">
                    {selectedIdea.activity.map((a) => (
                      <p key={a.id}>
                        {new Date(a.createdAt).toLocaleString()} · {a.action} · {a.actor}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
