import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

type DailyFormsProgress = {
  form1: "complete";
  form2: "incomplete" | "complete";
  form3: "locked" | "available";
};

interface DailyFormsResumeState {
  id: string;
  shiftDate: string;
  completedBy: string;
  nextPath: string;
  progress: DailyFormsProgress;
}

export default function DailyFormsResume() {
  const navigate = useNavigate();
  const workflowQuery = useQuery<{
    ok: boolean;
    workflow: DailyFormsResumeState | null;
    error?: string;
  }>({
    queryKey: ["/api/staff/daily-forms/resume"],
    retry: false,
  });

  const workflow = workflowQuery.data?.workflow;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Resume Daily Forms</h1>
          <p className="text-xs text-slate-500">Continue an unfinished Daily Sales and Stock workflow.</p>
        </div>
      </div>

      {workflowQuery.isLoading && (
        <div className="py-8 text-center text-xs text-slate-400">Checking unfinished forms...</div>
      )}

      {workflowQuery.isError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            The unfinished daily forms could not be checked. Your saved forms were not changed.
            Refresh this page or sign in again.
          </p>
        </div>
      )}

      {workflow && (
        <section
          className="space-y-3 rounded-xl border-2 border-[#FFD400] bg-[#FFF8CC] p-4"
          aria-label="Unfinished daily forms"
        >
          <div>
            <h2 className="text-base font-bold text-slate-950">Daily forms are unfinished</h2>
            <p className="mt-1 text-xs text-slate-700">
              Shift {workflow.shiftDate} — continue from the last completed form.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 font-semibold text-emerald-800">
              Form 1<br />Complete
            </div>
            <div
              className={`rounded-lg border p-2 font-semibold ${
                workflow.progress.form2 === "complete"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-amber-300 bg-white text-amber-900"
              }`}
            >
              Form 2<br />{workflow.progress.form2 === "complete" ? "Complete" : "Resume"}
            </div>
            <div
              className={`rounded-lg border p-2 font-semibold ${
                workflow.progress.form3 === "available"
                  ? "border-amber-300 bg-white text-amber-900"
                  : "border-slate-300 bg-slate-50 text-slate-500"
              }`}
            >
              Form 3<br />{workflow.progress.form3 === "available" ? "Resume" : "Locked"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(workflow.nextPath)}
            className="w-full rounded-lg bg-[#111111] px-4 py-3 text-sm font-bold text-[#FFD400] hover:bg-black"
          >
            Resume Forms
          </button>
        </section>
      )}

      {!workflowQuery.isLoading && !workflowQuery.isError && !workflow && (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-emerald-900">No unfinished daily forms</h2>
              <p className="mt-1 text-xs text-emerald-800">
                There is currently no saved shift waiting for Form 2 or Form 3.
              </p>
            </div>
          </div>
          <Link
            to="/operations/daily-sales"
            className="inline-flex rounded-lg bg-[#111111] px-4 py-2 text-xs font-bold text-[#FFD400] hover:bg-black"
          >
            Open Daily Sales and Stock Form
          </Link>
        </section>
      )}
    </div>
  );
}
