import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CheckSquare, Square, ClipboardList } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ChecklistQuestion {
  id: string | number;
  text?: string;
  label?: string;
  area?: string;
  section?: string;
  required?: boolean;
  isCritical?: boolean;
  active?: boolean;
}

interface QuestionsResponse {
  rows?: ChecklistQuestion[];
  questions?: ChecklistQuestion[];
  items?: ChecklistQuestion[];
}

function toArray(data: ChecklistQuestion[] | QuestionsResponse | undefined): ChecklistQuestion[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (data as QuestionsResponse).rows ?? (data as QuestionsResponse).questions ?? (data as QuestionsResponse).items ?? [];
}

export default function ManagerChecklist() {
  const [checked, setChecked] = useState<Set<string | number>>(new Set());

  const { data: questionsRaw, isLoading, isError } = useQuery<ChecklistQuestion[] | QuestionsResponse>({
    queryKey: ["/api/manager-checklist/questions"],
  });

  const items = toArray(questionsRaw).filter((q) => q.active !== false);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/manager-checklist/submit", {
        completedItems: Array.from(checked),
        timestamp: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager-checklist/questions"] });
    },
  });

  const toggleItem = (id: string | number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bySection = items.reduce<Record<string, ChecklistQuestion[]>>((acc, q) => {
    const sec = q.area || q.section || "General";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(q);
    return acc;
  }, {});

  const completedCount = checked.size;
  const totalCount = items.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Manager Checklist</h1>
            <p className="text-xs text-slate-500">Nightly sign-off</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {completedCount} / {totalCount}
          </p>
          <p className="text-[10px] text-slate-400">completed</p>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading checklist...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load checklist.</div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No checklist items found.</div>
      )}

      <div className="space-y-4">
        {Object.entries(bySection).map(([section, sItems]) => (
          <div key={section} className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{section}</p>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {sItems.map((q) => {
                const id = q.id;
                const label = q.text || q.label || String(id);
                const isDone = checked.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleItem(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isDone
                        ? "bg-green-50 dark:bg-green-900/20"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {isDone
                      ? <CheckSquare className="h-4 w-4 text-green-500 flex-shrink-0" />
                      : <Square className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                    <span className={`text-xs flex-1 ${isDone ? "text-green-700 dark:text-green-400 line-through" : "text-slate-700 dark:text-slate-300"}`}>
                      {label}
                    </span>
                    {q.isCritical && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200 border">
                        Critical
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <button
          onClick={() => submitMutation.mutate()}
          disabled={!allDone || submitMutation.isPending}
          className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            allDone
              ? "bg-black text-white hover:bg-slate-800"
              : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
          }`}
        >
          {submitMutation.isPending
            ? "Submitting..."
            : allDone
            ? "Submit Checklist"
            : `Complete all ${totalCount - completedCount} remaining items to submit`}
        </button>
      )}
    </div>
  );
}
