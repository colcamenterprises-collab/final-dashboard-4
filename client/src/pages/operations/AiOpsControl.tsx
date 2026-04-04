import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
type TaskAgent = 'bob' | 'jussi' | 'sally' | 'supplier' | 'codex' | 'cam' | 'staff';
type TaskArea = 'operations' | 'finance' | 'purchasing' | 'marketing' | 'dev' | 'compliance';

type Task = {
  id: number;
  taskNumber: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  area: TaskArea | null;
  assignedTo: TaskAgent | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  followUpRequired: boolean;
};

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
  createdBy: string;
  createdAt: string;
};

type BoardColumn = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done' | 'blocked';

const BOARD_COLUMNS: Array<{ key: BoardColumn; title: string }> = [
  { key: 'inbox', title: 'Inbox' },
  { key: 'assigned', title: 'Assigned' },
  { key: 'in_progress', title: 'In Progress' },
  { key: 'review', title: 'Review' },
  { key: 'done', title: 'Done' },
  { key: 'blocked', title: 'Blocked' },
];

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent', 'critical'];

function mapTaskToBoardColumn(status: TaskStatus): BoardColumn {
  if (['blocked'].includes(status)) return 'blocked';
  if (['done', 'completed', 'approved', 'archived', 'cancelled'].includes(status)) return 'done';
  if (['needs_review', 'in_review', 'changes_requested', 'rejected'].includes(status)) return 'review';
  if (['in_progress'].includes(status)) return 'in_progress';
  if (['assigned'].includes(status)) return 'assigned';
  return 'inbox';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AiOpsControlPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [taskSearch, setTaskSearch] = useState('');
  const [taskAgentFilter, setTaskAgentFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');
  const [columnFilter, setColumnFilter] = useState<'all' | BoardColumn>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const [chatThreadTitle, setChatThreadTitle] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [chatMessageText, setChatMessageText] = useState('');
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const agentsQuery = useQuery<{ items: AgentItem[] }>({ queryKey: ['/api/ai-ops/agents'] });
  const tasksQuery = useQuery<{ items: Task[] }>({ queryKey: ['/api/ai-ops/tasks'] });
  const chatThreadsQuery = useQuery<{ ok: true; items: ChatThread[] }>({ queryKey: ['/api/ai-ops/chat/threads'] });
  const chatMessagesQuery = useQuery<{ ok: true; items: ChatMessage[] }>({
    queryKey: selectedThreadId ? [`/api/ai-ops/chat/threads/${selectedThreadId}/messages`] : ['noop-chat'],
    enabled: Boolean(selectedThreadId),
  });

  const refreshChat = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('/api/ai-ops/chat/threads'),
    });
  };

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

  const deleteThreadMutation = useMutation({
    mutationFn: (threadId: string) => apiRequest(`/api/ai-ops/chat/threads/${threadId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmDeleteThreadId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-ops/chat/threads'] });
      if (confirmDeleteThreadId === selectedThreadId) {
        setSelectedThreadId(null);
      }
    },
  });

  useEffect(() => {
    if (!selectedThreadId && (chatThreadsQuery.data?.items?.length || 0) > 0) {
      setSelectedThreadId(chatThreadsQuery.data!.items[0].id);
    }
  }, [chatThreadsQuery.data, selectedThreadId]);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [chatMessagesQuery.data, selectedThreadId]);

  const tasks = tasksQuery.data?.items || [];
  const normalizedSearch = taskSearch.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.deletedAt) return false;
      const boardColumn = mapTaskToBoardColumn(task.status);
      if (columnFilter !== 'all' && boardColumn !== columnFilter) return false;
      if (taskAgentFilter && task.assignedTo !== taskAgentFilter) return false;
      if (taskPriorityFilter && task.priority !== taskPriorityFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        task.title,
        task.taskNumber || '',
        task.description || '',
        task.area || '',
        task.assignedTo || '',
        task.status,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [tasks, columnFilter, taskAgentFilter, taskPriorityFilter, normalizedSearch]);

  const boardTasks = useMemo(() => {
    const grouped: Record<BoardColumn, Task[]> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    };
    for (const task of filteredTasks) {
      grouped[mapTaskToBoardColumn(task.status)].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  const uniqueAgents = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.assignedTo)
      .filter((value): value is TaskAgent => Boolean(value));
    const fromRegistry = (agentsQuery.data?.items || []).map((agent) => agent.agent);
    return Array.from(new Set([...fromRegistry, ...fromTasks]));
  }, [tasks, agentsQuery.data?.items]);

  return (
    <div className="space-y-6" data-page="ops">
      <section className="rounded-[4px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">AI Ops Control Board</h1>
            <p className="text-xs text-slate-500">Operations command center for work intake, execution, and review.</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Total active tasks: {filteredTasks.length}</div>
            <div>Agents in rail: {(agentsQuery.data?.items || []).length}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,0.6fr))]">
          <input
            className="h-9 rounded-[4px] border border-slate-300 px-3 text-xs"
            placeholder="Search tasks, messages, deliverables"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
          />
          <select
            className="h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
            value={taskAgentFilter}
            onChange={(e) => setTaskAgentFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {uniqueAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
            value={taskPriorityFilter}
            onChange={(e) => setTaskPriorityFilter(e.target.value)}
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-[4px] border border-slate-300 px-2 text-xs"
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value as 'all' | BoardColumn)}
          >
            <option value="all">All columns</option>
            {BOARD_COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {column.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-[4px] border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Rail</h2>
          <div className="mt-3 space-y-2">
            {(agentsQuery.data?.items || []).map((agent) => (
              <article key={agent.agent} className="rounded-[4px] border border-slate-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{agent.name}</p>
                    <p className="text-[11px] text-slate-500">{agent.role}</p>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'}`}
                    title={agent.status}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{agent.statusMessage || 'No live status message.'}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Updated from registry data</p>
              </article>
            ))}
            {(agentsQuery.data?.items || []).length === 0 && (
              <p className="text-xs text-slate-400">No agents returned.</p>
            )}
          </div>
        </aside>

        <div className="overflow-x-auto">
          <div className="grid min-w-[1080px] grid-cols-6 gap-3">
            {BOARD_COLUMNS.map((column) => (
              <section key={column.key} className="rounded-[4px] border border-slate-200 bg-slate-50 p-2">
                <header className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-semibold text-slate-800">{column.title}</h3>
                  <span className="text-xs text-slate-500">{boardTasks[column.key].length}</span>
                </header>
                <div className="max-h-[560px] space-y-2 overflow-y-auto">
                  {boardTasks[column.key].map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-[4px] border bg-white p-2 text-left shadow-sm transition hover:border-slate-400 ${selectedTaskId === task.id ? 'border-slate-900' : 'border-slate-200'}`}
                    >
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2">{task.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{task.taskNumber || `Task #${task.id}`}</p>
                      <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-600">
                        {task.area && <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5">{task.area}</span>}
                        <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5">{task.priority}</span>
                        {task.assignedTo && <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5">{task.assignedTo}</span>}
                        {task.followUpRequired && <span className="rounded-[4px] bg-amber-100 px-1.5 py-0.5 text-amber-700">follow-up</span>}
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">Updated {formatTimestamp(task.updatedAt)}</p>
                    </button>
                  ))}
                  {boardTasks[column.key].length === 0 && (
                    <p className="rounded-[4px] border border-dashed border-slate-300 bg-white p-2 text-center text-[11px] text-slate-400">
                      No tasks in {column.title.toLowerCase()}.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[4px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Selected Task</h2>
          {selectedTaskId && (
            <button
              type="button"
              className="rounded-[4px] border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => navigate(`/operations/tasks/${selectedTaskId}`)}
            >
              Open task detail
            </button>
          )}
        </div>
        {!selectedTaskId && <p className="mt-2 text-xs text-slate-500">Select a card in the board to inspect or open detail view.</p>}
        {selectedTaskId && (
          <div className="mt-2 text-xs text-slate-600">Task #{selectedTaskId} selected. Use “Open task detail” for the full task page.</div>
        )}
      </section>

      {confirmDeleteThreadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-[4px] border border-slate-200 bg-white p-5 shadow-xl">
            <p className="mb-2 text-sm font-semibold text-slate-900">Delete this thread?</p>
            <p className="mb-4 text-xs text-slate-500">This cannot be undone. All messages in this thread will be removed.</p>
            <div className="flex justify-end gap-2">
              <button className="h-8 rounded-[4px] border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50" onClick={() => setConfirmDeleteThreadId(null)}>
                Cancel
              </button>
              <button
                className="h-8 rounded-[4px] bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deleteThreadMutation.isPending}
                onClick={() => deleteThreadMutation.mutate(confirmDeleteThreadId)}
              >
                {deleteThreadMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 rounded-[4px] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">Bob Chat (Orchestrator)</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatThreadTitle.trim()) return;
              createChatThreadMutation.mutate({ title: chatThreadTitle.trim(), createdBy: 'Bob' });
            }}
            className="space-y-2"
          >
            <input
              className="h-9 w-full rounded-[4px] border border-slate-300 px-3 text-xs"
              value={chatThreadTitle}
              onChange={(e) => setChatThreadTitle(e.target.value)}
              placeholder="New thread title"
            />
            <button type="submit" className="h-9 rounded-[4px] border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Create Thread
            </button>
          </form>
          <div className="max-h-64 space-y-2 overflow-auto">
            {(chatThreadsQuery.data?.items || []).map((thread) => (
              <div
                key={thread.id}
                className={`group relative flex items-start rounded-[4px] border ${selectedThreadId === thread.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <button type="button" onClick={() => setSelectedThreadId(thread.id)} className="min-w-0 flex-1 p-2 text-left text-xs">
                  <p className="truncate pr-5 text-xs font-medium text-slate-900">{thread.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : 'No messages yet'}</p>
                </button>
                <button
                  type="button"
                  title="Delete thread"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteThreadId(thread.id);
                  }}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div ref={chatScrollRef} className="max-h-96 space-y-2 overflow-y-auto rounded-[4px] border border-slate-200 p-3 scroll-smooth">
            {(chatMessagesQuery.data?.items || []).length === 0 && <p className="py-4 text-center text-xs text-slate-400">No messages yet. Send one below.</p>}
            {(chatMessagesQuery.data?.items || []).map((msg) => (
              <div key={msg.id} className={`rounded-[4px] p-2.5 text-xs ${msg.role === 'assistant' ? 'border border-emerald-100 bg-emerald-50' : 'border border-slate-200 bg-white'}`}>
                <p className={`mb-1 text-[10px] font-semibold uppercase ${msg.role === 'assistant' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {msg.role === 'assistant' ? 'Bob' : 'You'}
                </p>
                <p className="whitespace-pre-wrap text-slate-800">{msg.content}</p>
                <p className="mt-1.5 text-right text-[10px] text-slate-400">{new Date(msg.createdAt).toLocaleString()}</p>
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
                const title = text.length > 50 ? `${text.slice(0, 47)}...` : text;
                const result = await createChatThreadMutation.mutateAsync({ title, createdBy: 'Bob' });
                threadId = (result as { ok: true; item: ChatThread }).item.id;
              }
              sendChatMessageMutation.mutate({ threadId, content: text });
            }}
            className="space-y-2"
          >
            <textarea
              className="w-full rounded-[4px] border border-slate-300 p-3 text-xs"
              rows={3}
              value={chatMessageText}
              onChange={(e) => setChatMessageText(e.target.value)}
              placeholder="Type a message"
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
              className="h-9 rounded-[4px] border border-emerald-300 bg-emerald-50 px-4 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {sendChatMessageMutation.isPending || createChatThreadMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
