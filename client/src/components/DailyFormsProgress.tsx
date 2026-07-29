import type { DailyFormsProgress as Progress } from "../../../shared/dailyFormsWorkflow";

const labels: Array<{ key: keyof Progress; label: string }> = [
  { key: "form1", label: "Form 1 — Daily Sales" },
  { key: "form2", label: "Form 2 — Daily Cleaning" },
  { key: "form3", label: "Form 3 — Daily Stock" },
];

export default function DailyFormsProgress({ progress }: { progress: Progress }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Daily forms progress">
      {labels.map(({ key, label }) => {
        const status = progress[key];
        const complete = status === "complete";
        const available = status === "available";
        return (
          <div key={key} className={`rounded-lg border p-3 ${complete ? "border-emerald-300 bg-emerald-50" : available ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-slate-50"}`}>
            <p className="text-xs font-semibold text-slate-900">{label}</p>
            <p className="mt-1 text-xs capitalize text-slate-700">{status}</p>
          </div>
        );
      })}
    </div>
  );
}
