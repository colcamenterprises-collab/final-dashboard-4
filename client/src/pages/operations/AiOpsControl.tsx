import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/queryClient';

type TaskStatus =
  | 'draft'
  | 'in_review'
  | 'not_assigned'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'archived'
  | 'done'
  | 'cancelled'
  | 'needs_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';
type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'ad-hoc';
type TaskAgent = 'bob' | 'jussi' | 'sally' | 'supplier' | 'codex' | 'cam' | 'staff';
type TaskArea = 'operations' | 'finance' | 'purchasing' | 'marketing' | 'dev' | 'compliance';

type Task = {
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

type AgentStatus = 'online' | 'offline' | 'busy';
type AgentItem = {
  agent: TaskAgent;
  name: string;
  role: string;
  description: string;
  imageUrl: string | null;
  status: AgentStatus;
  statusMessage: string | null;
};

type ChatThread = {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
};

type ChatMessage = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenEstimate: number;
  createdBy: string;
  createdAt: string;
};
type SelectedItem = { type: 'task'; id: number } | { type: 'issue' | 'idea'; id: string } | null;

const STATUS_OPTIONS: TaskStatus[] = [
  'draft',
  'in_review',
  'not_assigned',
  'assigned',
  'in_progress',
  'blocked',
  'needs_review',
  'approved',
  'changes_requested',
  'rejected',
  'done',
  'completed',
  'cancelled',
  'archived',
];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent', 'critical'];
const AREA_OPTIONS: TaskArea[] = ['operations', 'finance', 'purchasing', 'marketing', 'dev', 'compliance'];
const AGENT_OPTIONS: TaskAgent[] = ['bob', 'jussi', 'sally', 'supplier', 'codex', 'cam', 'staff'];
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



export default function AiOpsControlPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const selectedTaskId = selectedItem?.type === 'task' ? selectedItem.id : null;
  const selectedIssueId = selectedItem?.type === 'issue' ? selectedItem.id : null;
  const selectedIdeaId = selectedItem?.type === 'idea' ? selectedItem.id : null;

  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskAgentFilter, setTaskAgentFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');
  const [taskAreaFilter, setTaskAreaFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskFrequency, setTaskFrequency] = useState<TaskFrequency>('ad-hoc');
  const [taskAssignee, setTaskAssignee] = useState<TaskAgent | ''>('');
  const [taskAreaInput, setTaskAreaInput] = useState<TaskArea | ''>('');
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
  const [chatThreadTitle, setChatThreadTitle] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [chatMessageText, setChatMessageText] = useState('');
  const [detailTab, setDetailTab] = useState<'details' | 'activity' | 'notes'>('details');
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null);
  const [systemMapOpen, setSystemMapOpen] = useState(false);
  const taskQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (taskStatusFilter) params.set('status', taskStatusFilter);
    if (taskAgentFilter) params.set('assignedTo', taskAgentFilter);
    if (taskPriorityFilter) params.set('priority', taskPriorityFilter);
    if (taskAreaFilter) params.set('area', taskAreaFilter);
    if (taskSearch.trim()) params.set('q', taskSearch.trim());
    if (includeArchived) params.set('includeArchived', 'true');
    return params.toString() ? `?${params.toString()}` : '';
  }, [taskStatusFilter, taskAgentFilter, taskPriorityFilter, taskAreaFilter, taskSearch, includeArchived]);

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

  const chatThreadsQuery = useQuery<{ ok: true; items: ChatThread[] }>({ queryKey: ['/api/ai-ops/chat/threads'] });
  const chatMessagesQuery = useQuery<{ ok: true; items: ChatMessage[] }>({
    queryKey: selectedThreadId ? [`/api/ai-ops/chat/threads/${selectedThreadId}/messages`] : ['noop-chat'],
    enabled: Boolean(selectedThreadId),
  });

  type ProcessEntry = {
    id: string;
    key: string;
    name: string;
    description: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    dependencies: Record<string, unknown>;
    owner: string;
    status: string;
    updated_at: string;
  };
  const processRegistryQuery = useQuery<{ ok: true; items: ProcessEntry[] }>({
    queryKey: ['/api/ai-ops/process-registry'],
  });
  const selectedProcess = (processRegistryQuery.data?.items || []).find(p => p.key === selectedProcessKey) ?? null;

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
  const refreshChat = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/chat/threads'),
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
      setTaskAreaInput('');
      refreshTasks();
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest(`/api/ai-ops/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: refreshTasks,
  });
  const archiveTaskMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/ai-ops/tasks/${id}/archive`, { method: 'POST', body: JSON.stringify({ actor: 'Cameron' }) }),
    onSuccess: refreshTasks,
  });
  const restoreTaskMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/ai-ops/tasks/${id}/restore`, { method: 'POST', body: JSON.stringify({ actor: 'Cameron' }) }),
    onSuccess: refreshTasks,
  });
  const messageTaskMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
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
    mutationFn: ({ id, note }: { id: number; note: string }) =>
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
      id: number;
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

  const createChatThreadMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/ai-ops/chat/threads', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (data: { ok: true; item: ChatThread }) => {
      setChatThreadTitle('');
      setSelectedThreadId(data.item.id);
      refreshChat();
    },
  });

  const sendChatMessageMutation = useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
      apiRequest(`/api/ai-ops/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, createdBy: 'Bob' }),
      }),
    onSuccess: () => {
      setChatMessageText('');
      refreshChat();
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai-ops/chat/threads/${selectedThreadId}/messages`] });
      }
    },
  });

  const selectedTask = taskDetailQuery.data;
  const selectedIssue = issueDetailQuery.data?.item;
  const selectedIdea = ideaDetailQuery.data?.item;

  useEffect(() => {
    if (selectedIssue) setIssuePlan(selectedIssue.planMd || '');
  }, [selectedIssue]);

  useEffect(() => {
    if (!selectedThreadId && (chatThreadsQuery.data?.items?.length || 0) > 0) {
      setSelectedThreadId(chatThreadsQuery.data!.items[0].id);
    }
  }, [chatThreadsQuery.data, selectedThreadId]);

  const tasks = tasksQuery.data?.items || [];
  const issues = issuesQuery.data?.items || [];
  const ideas = ideasQuery.data?.items || [];
  const openTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status)).length;
  const openIssues = issues.filter((issue) => !['done', 'closed', 'rejected'].includes(issue.status)).length;
  const dueToday = tasks.filter((task) => {
    if (!task.dueAt) return false;
    return new Date(task.dueAt).toDateString() === new Date().toDateString();
  }).length;
  const totalQueue = openTasks + openIssues + ideas.length;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(320px,1.2fr)_minmax(0,2fr)] lg:items-stretch">
          <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/70 p-4">
            <h1 className="text-2xl font-semibold">AI Ops Control</h1>
            <p className="text-sm text-slate-200">
              Central command for AI task execution, incident workflow, and idea intake.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Today Queue', value: totalQueue },
              { label: 'Open Issues', value: openIssues },
              { label: 'Tasks Due Today', value: dueToday },
              { label: 'Live Agents', value: (agentsQuery.data?.items || []).length },
            ].map((item) => (
              <article key={item.label} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-300">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </article>
            ))}
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">AI Agents</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(agentsQuery.data?.items || []).map((agent) => (
            <article key={agent.agent} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <img src={agent.imageUrl || 'https://placehold.co/128x128'} alt={agent.name} className="h-12 w-12 rounded-md object-cover" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                  <p className="text-xs text-slate-600">{agent.role}</p>
                </div>
                <span
                  className={`ml-auto inline-flex h-2.5 w-2.5 rounded-full ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'}`}
                  title={agent.status}
                />
              </div>
              <p className="text-sm text-slate-700">{agent.description}</p>
            </article>
          ))}
        </div>
      </section>


      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Bob Chat (Orchestrator)</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatThreadTitle.trim()) return;
              createChatThreadMutation.mutate({ title: chatThreadTitle.trim(), createdBy: 'Bob' });
            }}
            className="space-y-2"
          >
            <input className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={chatThreadTitle} onChange={(e) => setChatThreadTitle(e.target.value)} placeholder="New thread title" />
            <button type="submit" className="h-10 rounded-lg bg-slate-900 px-3 text-sm text-white">Create Thread</button>
          </form>
          <div className="max-h-64 space-y-2 overflow-auto">
            {(chatThreadsQuery.data?.items || []).map((thread) => (
              <button key={thread.id} type="button" onClick={() => setSelectedThreadId(thread.id)} className={`w-full rounded-lg border p-2 text-left text-sm ${selectedThreadId === thread.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                <p className="font-medium text-slate-900">{thread.title}</p>
                <p className="text-xs text-slate-500">{thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : 'No messages yet'}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-slate-200 p-3">
            {(chatMessagesQuery.data?.items || []).map((msg) => (
              <div key={msg.id} className={`rounded-lg p-2 text-sm ${msg.role === 'assistant' ? 'bg-blue-50' : 'bg-slate-100'}`}>
                <p className="text-xs uppercase text-slate-500">{msg.role}</p>
                <p className="whitespace-pre-wrap text-slate-800">{msg.content}</p>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const text = chatMessageText.trim();
              if (!text) return;

              let threadId = selectedThreadId;

              if (!threadId) {
                const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
                const result = await createChatThreadMutation.mutateAsync({ title, createdBy: 'Bob' });
                threadId = (result as { ok: true; item: ChatThread }).item.id;
              }

              sendChatMessageMutation.mutate({ threadId, content: text });
            }}
            className="space-y-2"
          >
            <textarea
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              value={chatMessageText}
              onChange={(e) => setChatMessageText(e.target.value)}
              placeholder="Type a message — a thread is created automatically if needed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={sendChatMessageMutation.isPending || createChatThreadMutation.isPending}
              className="h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
            >
              {sendChatMessageMutation.isPending || createChatThreadMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      </section>

      {/* System Map — Bob's process familiarity layer */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          role="button"
          tabIndex={0}
          data-testid="system-map-toggle"
          onClick={() => setSystemMapOpen(v => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSystemMapOpen(v => !v); }}
          className="flex w-full cursor-pointer items-center justify-between p-4 text-left select-none"
        >
          <div>
            <p className="text-lg font-semibold text-slate-900">System Map</p>
            <p className="text-xs text-slate-500 mt-0.5">Bob's operational process registry — {(processRegistryQuery.data?.items || []).length} processes loaded</p>
          </div>
          <span
            data-testid="system-map-toggle-label"
            className="text-xs font-medium text-slate-600 border border-slate-200 rounded px-2 py-1 pointer-events-none"
          >
            {systemMapOpen ? 'Collapse' : 'Expand'}
          </span>
        </div>

        {systemMapOpen && (
          <div className="border-t border-slate-200 p-4">
            {processRegistryQuery.isLoading && (
              <p className="text-sm text-slate-500">Loading process registry...</p>
            )}
            {!processRegistryQuery.isLoading && (
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                {/* Process list */}
                <div className="space-y-1">
                  {(processRegistryQuery.data?.items || []).map(proc => (
                    <button
                      key={proc.key}
                      type="button"
                      onClick={() => setSelectedProcessKey(prev => prev === proc.key ? null : proc.key)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedProcessKey === proc.key
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <p className="font-medium leading-tight">{proc.name}</p>
                      <p className={`text-xs mt-0.5 ${selectedProcessKey === proc.key ? 'text-slate-300' : 'text-slate-500'}`}>
                        {proc.owner} — {proc.status}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Process detail */}
                <div className="rounded-lg border border-slate-200 p-4">
                  {!selectedProcess ? (
                    <p className="text-sm text-slate-500">Select a process to view its inputs, outputs, and dependencies.</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{selectedProcess.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedProcess.key} — {selectedProcess.owner} — {selectedProcess.status}</p>
                        <p className="text-sm text-slate-700 mt-2">{selectedProcess.description}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(['inputs', 'outputs', 'dependencies'] as const).map(section => (
                          <div key={section}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{section}</p>
                            <pre className="rounded bg-slate-50 border border-slate-200 p-2 text-xs text-slate-700 overflow-auto max-h-48 whitespace-pre-wrap">
                              {JSON.stringify(selectedProcess[section], null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">Updated: {new Date(selectedProcess.updated_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,1.1fr)_minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Work Register</h2>
              <span className="text-xs text-slate-400">{tasksQuery.data?.items?.length ?? 0} tasks</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                createTaskMutation.mutate({
                  title: taskTitle.trim(),
                  description: taskDescription.trim() || null,
                  priority: taskPriority,
                  frequency: taskFrequency,
                  area: taskAreaInput || null,
                  assignedTo: taskAssignee || null,
                  createdBy: 'Cameron',
                });
              }}
              className="grid gap-2 rounded-lg border border-slate-200 p-3"
            >
              <input
                className="w-full h-9 rounded-[4px] border border-slate-300 bg-white px-3 text-sm"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="New task title"
              />
              <textarea
                className="w-full rounded-[4px] border border-slate-300 bg-white px-3 py-2 text-sm"
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <select
                  className="h-9 w-full rounded-[4px] border border-slate-300 bg-white px-2 text-xs"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  className="h-9 w-full rounded-[4px] border border-slate-300 bg-white px-2 text-xs"
                  value={taskFrequency}
                  onChange={(e) => setTaskFrequency(e.target.value as TaskFrequency)}
                >
                  {(['once', 'daily', 'weekly', 'monthly', 'ad-hoc'] as TaskFrequency[]).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  className="h-9 w-full rounded-[4px] border border-slate-300 bg-white px-2 text-xs"
                  value={taskAreaInput}
                  onChange={(e) => setTaskAreaInput(e.target.value as TaskArea | '')}
                >
                  <option value="">No area</option>
                  {AREA_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <select
                  className="h-9 w-full rounded-[4px] border border-slate-300 bg-white px-2 text-xs col-span-2 sm:col-span-3"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value as TaskAgent | '')}
                >
                  <option value="">Unassigned</option>
                  {AGENT_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button
                className="w-fit rounded-[4px] border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs font-medium hover:bg-slate-100"
                type="submit"
                disabled={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? 'Creating…' : '+ Create Task'}
              </button>
            </form>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <select
                className="rounded-[4px] border border-slate-300 px-2 py-1.5 text-xs"
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="rounded-[4px] border border-slate-300 px-2 py-1.5 text-xs"
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
              >
                <option value="">All priorities</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className="rounded-[4px] border border-slate-300 px-2 py-1.5 text-xs"
                value={taskAreaFilter}
                onChange={(e) => setTaskAreaFilter(e.target.value)}
              >
                <option value="">All areas</option>
                {AREA_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                className="rounded-[4px] border border-slate-300 px-2 py-1.5 text-xs"
                value={taskAgentFilter}
                onChange={(e) => setTaskAgentFilter(e.target.value)}
              >
                <option value="">All assignees</option>
                {AGENT_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <input
                className="col-span-2 rounded-[4px] border border-slate-300 px-2 py-1.5 text-xs"
                placeholder="Search tasks…"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show archived
            </label>

            <div className="overflow-x-auto rounded-[4px] border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-2 py-2 font-medium text-slate-600">Title</th>
                    <th className="px-2 py-2 font-medium text-slate-600 whitespace-nowrap">Priority</th>
                    <th className="px-2 py-2 font-medium text-slate-600">Status</th>
                    <th className="px-2 py-2 font-medium text-slate-600">Area</th>
                    <th className="px-2 py-2 font-medium text-slate-600">Assigned</th>
                    <th className="px-2 py-2 font-medium text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasksQuery.isLoading && (
                    <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-400">Loading…</td></tr>
                  )}
                  {!tasksQuery.isLoading && (tasksQuery.data?.items || []).length === 0 && (
                    <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-400">No tasks found</td></tr>
                  )}
                  {(tasksQuery.data?.items || []).map((task) => (
                    <tr
                      key={task.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${task.deletedAt ? 'opacity-60' : ''}`}
                    >
                      <td className="px-2 py-2 max-w-[180px]">
                        <button
                          className="text-left text-emerald-700 hover:underline font-medium truncate block w-full"
                          onClick={() => navigate(`/operations/tasks/${task.id}`)}
                        >
                          {task.title}
                        </button>
                        {task.dueAt && (
                          <span className="text-slate-400 text-[10px]">
                            Due {new Date(task.dueAt).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize
                          ${task.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            task.priority === 'urgent' ? 'bg-orange-100 text-orange-700' :
                            task.priority === 'high' ? 'bg-yellow-100 text-yellow-700' :
                            task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'}`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-600 capitalize whitespace-nowrap">{task.status.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-2 text-slate-500 capitalize">{task.area ?? '—'}</td>
                      <td className="px-2 py-2 text-slate-500 capitalize">{task.assignedTo ?? '—'}</td>
                      <td className="px-2 py-2">
                        {task.deletedAt ? (
                          <button
                            className="text-[10px] text-emerald-600 hover:underline"
                            onClick={() => restoreTaskMutation.mutate(task.id)}
                            disabled={restoreTaskMutation.isPending}
                          >Restore</button>
                        ) : (
                          <button
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                            onClick={() => archiveTaskMutation.mutate(task.id)}
                            disabled={archiveTaskMutation.isPending}
                          >Archive</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                placeholder="New issue title"
              />
              <textarea
                name="issueDescription"
                className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                rows={2}
                placeholder="Description"
              />
              <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm" type="submit">
                Create Issue
              </button>
            </form>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={ideaTitle}
                onChange={(e) => setIdeaTitle(e.target.value)}
                placeholder="Idea title"
              />
              <textarea
                className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                rows={2}
                value={ideaDescription}
                onChange={(e) => setIdeaDescription(e.target.value)}
                placeholder="Idea description"
              />
              <select
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={ideaCategory}
                onChange={(e) => setIdeaCategory(e.target.value as IdeaCategory)}
              >
                {IDEA_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm" type="submit">
                Add Idea
              </button>
            </form>

            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
          <div className="mb-4 inline-flex w-full rounded-lg border border-slate-300 p-1">
            {(['details', 'activity', 'notes'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                className={`flex-1 rounded-md px-3 py-2 text-sm capitalize ${detailTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setDetailTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {!selectedItem && (
            <p className="text-sm text-slate-500">Select an item to view details.</p>
          )}

          {detailTab === 'details' && selectedItem?.type === 'task' && (
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="flex-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Add note"
                    />
                    <button
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                      type="submit"
                    >
                      Send
                    </button>
                  </form>

                  <textarea
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Review request note"
                  />
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                    onClick={() =>
                      reviewTaskMutation.mutate({ id: selectedTask.id, note: reviewNote })
                    }
                  >
                    Request Review
                  </button>
                  <textarea
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    rows={2}
                    value={reviewDecisionNote}
                    onChange={(e) => setReviewDecisionNote(e.target.value)}
                    placeholder="Review decision note"
                  />
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

          {detailTab === 'details' && selectedItem?.type === 'issue' && (
            <div className="space-y-3">
              {!selectedIssue ? (
                <p className="text-sm text-slate-500">Select an item to view details.</p>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900">Issue Detail</h3>
                  <input
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    value={selectedIssue.title}
                    onChange={(e) =>
                      updateIssueMutation.mutate({
                        id: selectedIssue.id,
                        payload: { title: e.target.value, actor: 'Bob' },
                      })
                    }
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      Severity: {selectedIssue.severity}
                    </span>
                    <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      Status: {selectedIssue.status}
                    </span>
                    <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      Created By: {selectedIssue.createdBy}
                    </span>
                  </div>
                  <textarea
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    rows={4}
                    value={issuePlan}
                    onChange={(e) => setIssuePlan(e.target.value)}
                    placeholder="Bob Plan"
                  />
                  <textarea
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    rows={2}
                    value={issueApprovalNote}
                    onChange={(e) => setIssueApprovalNote(e.target.value)}
                    placeholder="Approval note (optional)"
                  />
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                    className="w-full h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    rows={2}
                    value={issueDecisionNote}
                    onChange={(e) => setIssueDecisionNote(e.target.value)}
                    placeholder="Decision note"
                  />

                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm flex-1"
                      value={issueComment}
                      onChange={(e) => setIssueComment(e.target.value)}
                      placeholder="Add comment"
                    />
                    <button
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
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

          {detailTab === 'details' && selectedItem?.type === 'idea' && (
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
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


          {detailTab === 'activity' && selectedItem?.type === 'task' && selectedTask && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Task Activity</h3>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 p-3 text-xs space-y-2">
                {selectedTask.activity.map((entry) => (
                  <p key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.actor}</p>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'activity' && selectedItem?.type === 'issue' && selectedIssue && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Issue Activity</h3>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 p-3 text-xs space-y-2">
                {selectedIssue.activity.map((entry) => (
                  <p key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.actor}</p>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'activity' && selectedItem?.type === 'idea' && selectedIdea && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Idea Activity</h3>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 p-3 text-xs space-y-2">
                {selectedIdea.activity.map((entry) => (
                  <p key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.actor}</p>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'notes' && selectedItem?.type === 'task' && selectedTask && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Task Notes</h3>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 p-3 text-sm space-y-2">
                {selectedTask.messages.map((m) => <p key={m.id}><strong>{m.actor}</strong>: {m.message}</p>)}
              </div>
            </div>
          )}

          {detailTab === 'notes' && selectedItem?.type === 'issue' && selectedIssue && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Issue Notes</h3>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 p-3 text-sm space-y-2">
                {selectedIssue.comments.map((c) => <p key={c.id}><strong>{c.author}</strong>: {c.message}</p>)}
              </div>
            </div>
          )}

          {detailTab === 'notes' && selectedItem?.type === 'idea' && selectedIdea && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Idea Notes</h3>
              <p className="rounded border border-slate-200 p-3 text-sm text-slate-700">{selectedIdea.description || 'No notes available.'}</p>
            </div>
          )}

        </aside>
      </section>
    </div>
  );
}
