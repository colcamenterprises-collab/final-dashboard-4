import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IssueRow {
  id: number;
  shift_date: string;
  issue_type: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description?: string;
  detected_by: string;
  source_page?: string;
  source_ref: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  assigned_to?: string;
  resolution_notes?: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
}

interface IssueSummary {
  open_count: string;
  in_progress_count: string;
  resolved_count: string;
  closed_count: string;
  critical_count: string;
  total_count: string;
}

interface IssueListResponse {
  ok: boolean;
  issues: IssueRow[];
  summary: IssueSummary;
}

// ─── Styling helpers ───────────────────────────────────────────────────────────

function severityStyle(s: string) {
  switch (s) {
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200";
    case "HIGH":     return "bg-amber-100 text-amber-700 border-amber-200";
    case "MEDIUM":   return "bg-yellow-100 text-yellow-700 border-yellow-200";
    default:         return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function statusStyle(s: string) {
  switch (s) {
    case "OPEN":        return "bg-red-100 text-red-700 border-red-200";
    case "IN_PROGRESS": return "bg-amber-100 text-amber-700 border-amber-200";
    case "RESOLVED":    return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "CLOSED":      return "bg-slate-100 text-slate-500 border-slate-200";
    default:            return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function categoryStyle(c: string) {
  switch (c) {
    case "STOCK":     return "bg-purple-100 text-purple-700 border-purple-200";
    case "FINANCIAL": return "bg-blue-100 text-blue-700 border-blue-200";
    case "DATA":      return "bg-orange-100 text-orange-700 border-orange-200";
    default:          return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// ─── Today's date helper ────────────────────────────────────────────────────────
function todayBKK(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IssueRegisterPage() {
  const qc = useQueryClient();

  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoCreateDate, setAutoCreateDate] = useState(todayBKK());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [manualSeverity, setManualSeverity] = useState("MEDIUM");

  // ── Query ──────────────────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (filterDate) params.set("shiftDate", filterDate);
  if (filterStatus) params.set("status", filterStatus);
  if (filterSeverity) params.set("severity", filterSeverity);
  if (filterCategory) params.set("category", filterCategory);
  if (search) params.set("search", search);

  const { data, isLoading, isFetching } = useQuery<IssueListResponse>({
    queryKey: ["/api/issue-register", filterDate, filterStatus, filterSeverity, filterCategory, search],
    queryFn: async () => {
      const res = await fetch(`/api/issue-register?${params.toString()}`);
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const issues = data?.issues ?? [];
  const summary = data?.summary;

  // ── Auto-create mutation ───────────────────────────────────────────────────
  const autoCreate = useMutation({
    mutationFn: async (date: string) => {
      return apiRequest("/api/issue-register/auto-create", {
        method: "POST",
        body: JSON.stringify({ date }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/issue-register"] });
    },
  });

  // ── Status update mutation ─────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, resolution_notes }: { id: number; status: string; resolution_notes?: string }) => {
      return apiRequest(`/api/issue-register/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, resolution_notes }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/issue-register"] });
    },
  });

  const toggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const openCount     = Number(summary?.open_count ?? 0);
  const criticalCount = Number(summary?.critical_count ?? 0);
  const totalCount    = Number(summary?.total_count ?? 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Issue Register</h1>
          <p className="text-sm text-slate-500 mt-1">Theft control & shift accountability</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/analysis/daily-review">
            <Button variant="outline" className="text-xs rounded-[4px]">
              Sales &amp; Shift Analysis
            </Button>
          </Link>
          <Button
            className="text-xs rounded-[4px] bg-slate-900 text-white"
            onClick={() => setShowCreateForm(v => !v)}
          >
            + Manual Issue
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Open",        value: summary?.open_count        ?? "—", color: "text-red-600" },
          { label: "In Progress", value: summary?.in_progress_count ?? "—", color: "text-amber-600" },
          { label: "Resolved",    value: summary?.resolved_count    ?? "—", color: "text-emerald-600" },
          { label: "Closed",      value: summary?.closed_count      ?? "—", color: "text-slate-400" },
          { label: "Critical",    value: summary?.critical_count    ?? "—", color: "text-red-700 font-bold" },
        ].map(t => (
          <Card key={t.label} className="rounded-[4px]">
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-semibold ${t.color}`}>{t.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Auto-create row */}
      <Card className="rounded-[4px]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-600">Auto-detect issues for date:</span>
            <input
              type="date"
              value={autoCreateDate}
              onChange={e => setAutoCreateDate(e.target.value)}
              className="border border-slate-200 rounded-[4px] px-2 py-1 text-sm"
            />
            <Button
              className="text-xs rounded-[4px] bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => autoCreate.mutate(autoCreateDate)}
              disabled={autoCreate.isPending || !autoCreateDate}
            >
              {autoCreate.isPending ? "Detecting…" : "Run Auto-Detect"}
            </Button>
            {autoCreate.isSuccess && (() => {
              const result = (autoCreate.data as any);
              return (
                <span className="text-xs text-emerald-700">
                  Done — {result?.created?.length ?? 0} created, {result?.skipped?.length ?? 0} skipped
                </span>
              );
            })()}
            {autoCreate.isError && (
              <span className="text-xs text-red-600">Failed — check console</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual create form */}
      {showCreateForm && (
        <ManualCreateForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["/api/issue-register"] });
            setShowCreateForm(false);
          }}
        />
      )}

      {/* Filters */}
      <Card className="rounded-[4px]">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-40 text-xs rounded-[4px]"
            />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-slate-200 rounded-[4px] px-2 py-1 text-sm"
            />
            {[
              { label: "All Status", value: "", setter: setFilterStatus, current: filterStatus, options: ["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] },
              { label: "All Severity", value: "", setter: setFilterSeverity, current: filterSeverity, options: ["CRITICAL","HIGH","MEDIUM","LOW"] },
              { label: "All Category", value: "", setter: setFilterCategory, current: filterCategory, options: ["STOCK","FINANCIAL","DATA","SYSTEM"] },
            ].map(f => (
              <select
                key={f.label}
                value={f.current}
                onChange={e => f.setter(e.target.value)}
                className="border border-slate-200 rounded-[4px] px-2 py-1 text-sm"
              >
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            {(filterDate || filterStatus || filterSeverity || filterCategory || search) && (
              <Button
                variant="ghost"
                className="text-xs text-slate-500"
                onClick={() => { setFilterDate(""); setFilterStatus(""); setFilterSeverity(""); setFilterCategory(""); setSearch(""); }}
              >
                Clear filters
              </Button>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {isFetching ? "Loading…" : `${issues.length} of ${totalCount} issues`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-[4px]">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-slate-400">Loading issues…</div>
          ) : issues.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              No issues found.{" "}
              {openCount === 0 && totalCount === 0 && "Run auto-detect to scan a shift for issues."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Date</th>
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Severity</th>
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Category</th>
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Issue</th>
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Status</th>
                  <th className="text-left p-3 font-medium text-slate-600 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <>
                    <tr
                      key={issue.id}
                      className={`border-b hover:bg-slate-100/40 cursor-pointer transition-colors ${expandedId === issue.id ? "bg-slate-50" : ""}`}
                      onClick={() => toggleExpand(issue.id)}
                    >
                      <td className="p-3 text-xs text-slate-700 tabular-nums whitespace-nowrap">{issue.shift_date}</td>
                      <td className="p-3">
                        <Badge className={`text-xs rounded-[4px] ${severityStyle(issue.severity)}`}>
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs rounded-[4px] ${categoryStyle(issue.category)}`}>
                          {issue.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-slate-700 max-w-xs">
                        <span className="font-medium">{issue.title}</span>
                        {issue.detected_by !== "MANUAL" && (
                          <span className="ml-1 text-slate-400">· {issue.issue_type.replace(/_/g, " ")}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs rounded-[4px] ${statusStyle(issue.status)}`}>
                          {issue.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 flex-wrap">
                          {issue.status === "OPEN" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-[4px] h-6 px-2"
                              onClick={() => updateStatus.mutate({ id: issue.id, status: "IN_PROGRESS" })}
                              disabled={updateStatus.isPending}
                            >
                              Start
                            </Button>
                          )}
                          {issue.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-[4px] h-6 px-2 text-emerald-700 border-emerald-200"
                              onClick={() => updateStatus.mutate({ id: issue.id, status: "RESOLVED" })}
                              disabled={updateStatus.isPending}
                            >
                              Resolve
                            </Button>
                          )}
                          {issue.status === "RESOLVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-[4px] h-6 px-2 text-slate-500"
                              onClick={() => updateStatus.mutate({ id: issue.id, status: "CLOSED" })}
                              disabled={updateStatus.isPending}
                            >
                              Close
                            </Button>
                          )}
                          {issue.status === "RESOLVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-[4px] h-6 px-2 text-amber-700 border-amber-200"
                              onClick={() => updateStatus.mutate({ id: issue.id, status: "OPEN" })}
                              disabled={updateStatus.isPending}
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === issue.id && (
                      <tr key={`${issue.id}-detail`} className="border-b bg-slate-50">
                        <td colSpan={6} className="p-4">
                          <IssueDetail issue={issue} onUpdate={() => qc.invalidateQueries({ queryKey: ["/api/issue-register"] })} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Issue Detail panel (expanded row) ────────────────────────────────────────

function IssueDetail({ issue, onUpdate }: { issue: IssueRow; onUpdate: () => void }) {
  const [resolutionNote, setResolutionNote] = useState(issue.resolution_notes ?? "");
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    setSaving(true);
    try {
      await fetch(`/api/issue-register/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution_notes: resolutionNote }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 text-xs text-slate-700">
      <div className="space-y-2">
        <div>
          <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">Description</span>
          <p className="mt-1 text-slate-700 leading-relaxed">{issue.description ?? "—"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-slate-500">Detected by:</span> <span>{issue.detected_by}</span></div>
          <div><span className="text-slate-500">Source:</span> <span>{issue.source_page ?? "—"}</span></div>
          <div><span className="text-slate-500">Assigned to:</span> <span>{issue.assigned_to ?? "—"}</span></div>
          <div><span className="text-slate-500">Type:</span> <span className="font-mono">{issue.issue_type}</span></div>
          <div><span className="text-slate-500">Created:</span> <span>{issue.created_at?.slice(0,16).replace("T"," ")}</span></div>
          {issue.resolved_at && <div><span className="text-slate-500">Resolved:</span> <span>{issue.resolved_at.slice(0,16).replace("T"," ")}</span></div>}
        </div>
      </div>
      <div className="space-y-2">
        {issue.metadata_json && (
          <div>
            <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">Data</span>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {Object.entries(issue.metadata_json).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
                  <span className="text-slate-500 font-mono truncate">{k}</span>
                  <span className="text-slate-700 tabular-nums">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">Resolution Notes</span>
          <textarea
            className="mt-1 w-full border border-slate-200 rounded-[4px] px-2 py-1.5 text-xs min-h-16 resize-y"
            value={resolutionNote}
            onChange={e => setResolutionNote(e.target.value)}
            placeholder="Add resolution notes…"
          />
          <Button
            size="sm"
            variant="outline"
            className="text-xs rounded-[4px] h-6 px-2 mt-1"
            onClick={saveNote}
            disabled={saving || resolutionNote === (issue.resolution_notes ?? "")}
          >
            {saving ? "Saving…" : "Save Notes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual create form ────────────────────────────────────────────────────────

function ManualCreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    shift_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }),
    issue_type: "",
    category: "SYSTEM",
    severity: "MEDIUM",
    title: "",
    description: "",
    source_ref: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.shift_date || !form.issue_type || !form.title || !form.source_ref) {
      setError("Date, type, title and source ref are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/issue-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, detected_by: "MANUAL" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-[4px] border-emerald-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-slate-700">Create Manual Issue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Shift Date</label>
            <input type="date" value={form.shift_date} onChange={set("shift_date")} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Issue Type</label>
            <Input value={form.issue_type} onChange={set("issue_type")} placeholder="e.g. CASH_DISCREPANCY" className="text-xs rounded-[4px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Source Ref (unique ID)</label>
            <Input value={form.source_ref} onChange={set("source_ref")} placeholder="e.g. CASH_DISCREPANCY::2025-03-01" className="text-xs rounded-[4px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Category</label>
            <select value={form.category} onChange={set("category")} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm">
              {["STOCK","FINANCIAL","DATA","SYSTEM","OTHER"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Severity</label>
            <select value={form.severity} onChange={set("severity")} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm">
              {["LOW","MEDIUM","HIGH","CRITICAL"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 md:col-span-3">
            <label className="text-xs text-slate-500">Title</label>
            <Input value={form.title} onChange={set("title")} placeholder="Brief issue title" className="text-xs rounded-[4px]" />
          </div>
          <div className="flex flex-col gap-1 md:col-span-3">
            <label className="text-xs text-slate-500">Description</label>
            <textarea value={form.description} onChange={set("description")} placeholder="Detailed description…" className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm min-h-16" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button className="text-xs rounded-[4px] bg-slate-900 text-white" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create Issue"}
          </Button>
          <Button variant="outline" className="text-xs rounded-[4px]" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
