import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, AlertTriangle } from "lucide-react";

interface Issue {
  id: number;
  shift_date: string;
  issue_type: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  resolved?: boolean;
  created_at?: string;
}

interface IssueResponse {
  ok: boolean;
  issues: Issue[];
}

function severityColor(s: string) {
  switch (s?.toUpperCase()) {
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200";
    case "HIGH":     return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM":   return "bg-amber-100 text-amber-700 border-amber-200";
    case "LOW":      return "bg-slate-100 text-slate-600 border-slate-200";
    default:         return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

export default function IssueRegister() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<IssueResponse>({
    queryKey: ["/api/issue-register"],
  });

  const issues = data?.issues ?? [];

  const filtered = issues.filter(
    (i) =>
      (i.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.issue_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const criticalCount = issues.filter((i) => i.severity?.toUpperCase() === "CRITICAL").length;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Issue Register</h1>
            <p className="text-xs text-slate-500">
              Developer/admin direct route · {issues.length} total · {criticalCount} critical
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
        Operational variances are now reviewed in Shift Analysis. This register remains available by direct URL for developer/admin review.
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading issues...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load issue register.</div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No issues found.</div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <div
              key={issue.id}
              className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] px-1.5 py-0 border ${severityColor(issue.severity)}`}>
                    {issue.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{issue.category}</Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">{issue.issue_type}</Badge>
                </div>
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                  {formatDate(issue.shift_date)}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{issue.title}</p>
              {issue.description && (
                <p className="text-[11px] text-slate-500 line-clamp-2">{issue.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
