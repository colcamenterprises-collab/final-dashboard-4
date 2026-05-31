import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CleaningTemplate {
  id: number;
  taskName: string;
  area?: string;
  timing?: string;
  role?: string;
  required?: boolean;
  isActive?: boolean;
  description?: string;
}

interface CleaningResponse {
  templates?: CleaningTemplate[];
}

const TIMING_COLOURS: Record<string, string> = {
  start_shift: "bg-blue-100 text-blue-700 border-blue-200",
  during_shift: "bg-amber-100 text-amber-700 border-amber-200",
  end_shift: "bg-purple-100 text-purple-700 border-purple-200",
};

const TIMING_LABELS: Record<string, string> = {
  start_shift: "Start",
  during_shift: "During",
  end_shift: "End",
};

export default function Cleaning() {
  const { data, isLoading, isError } = useQuery<CleaningResponse>({
    queryKey: ["/api/staff/cleaning/templates"],
  });

  const templates = (data?.templates ?? []).filter((t) => t.isActive !== false);

  const byTiming = templates.reduce<Record<string, CleaningTemplate[]>>((acc, t) => {
    const key = t.timing || "general";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const timingOrder = ["start_shift", "during_shift", "end_shift", "general"];
  const sortedTimings = [...Object.keys(byTiming)].sort(
    (a, b) => (timingOrder.indexOf(a) ?? 99) - (timingOrder.indexOf(b) ?? 99)
  );

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Cleaning Tasks</h1>
          <p className="text-xs text-slate-500">{templates.length} active templates</p>
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading tasks...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load cleaning tasks.</div>}
      {!isLoading && !isError && templates.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-xs">No cleaning task templates found. Use Staff Settings to seed defaults.</div>
      )}

      <div className="space-y-4">
        {sortedTimings.map((timing) => {
          const group = byTiming[timing];
          const label = TIMING_LABELS[timing] ?? timing.replace(/_/g, " ");
          return (
            <div key={timing} className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{label} Shift ({group.length})</p>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {group.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">{t.taskName}</p>
                      {t.area && <p className="text-[10px] text-slate-400">{t.area}</p>}
                      {t.description && <p className="text-[10px] text-slate-400 mt-0.5">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.role && t.role !== "all" && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200 border">
                          {t.role}
                        </Badge>
                      )}
                      {t.timing && (
                        <Badge className={`text-[10px] px-1.5 py-0 border ${TIMING_COLOURS[t.timing] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {TIMING_LABELS[t.timing] ?? t.timing}
                        </Badge>
                      )}
                      {t.required && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200 border">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
