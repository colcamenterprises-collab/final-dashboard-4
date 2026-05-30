import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ShieldCheck, Square, CheckSquare } from "lucide-react";

interface HealthSafetyQuestion {
  id: string;
  section: string;
  label: string;
  isCritical: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function HealthSafety() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data: questions = [], isLoading, isError } = useQuery<HealthSafetyQuestion[]>({
    queryKey: ["/api/health-safety/questions"],
  });

  const active = questions.filter((q) => q.isActive);

  const bySection = active.reduce<Record<string, HealthSafetyQuestion[]>>((acc, q) => {
    const sec = q.section || "General";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(q);
    return acc;
  }, {});

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const criticalItems = active.filter((q) => q.isCritical);
  const criticalDone = criticalItems.filter((q) => checked.has(q.id)).length;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Health & Safety</h1>
            <p className="text-xs text-slate-500">{active.length} active checks</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {checked.size} / {active.length}
          </p>
          <p className="text-[10px] text-slate-400">completed</p>
        </div>
      </div>

      {criticalItems.length > 0 && (
        <div className={`border rounded-lg p-3 text-xs ${
          criticalDone === criticalItems.length
            ? "border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700"
            : "border-amber-200 bg-amber-50 dark:bg-amber-900/20 text-amber-700"
        }`}>
          {criticalDone === criticalItems.length
            ? `All ${criticalItems.length} critical checks complete.`
            : `${criticalItems.length - criticalDone} critical checks remaining.`}
        </div>
      )}

      {active.length > 0 && (
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: active.length > 0 ? `${(checked.size / active.length) * 100}%` : "0%" }}
          />
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading checks...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load health & safety data.</div>
      )}

      {!isLoading && !isError && active.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No active health & safety checks.</div>
      )}

      <div className="space-y-4">
        {Object.entries(bySection)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([section, items]) => (
            <div key={section} className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{section}</p>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {items
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((q) => {
                    const isDone = checked.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleItem(q.id)}
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
                          {q.label}
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
    </div>
  );
}
