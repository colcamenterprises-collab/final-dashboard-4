export type DailyFormsProgress = {
  form1: "complete";
  form2: "incomplete" | "complete";
  form3: "locked" | "available" | "complete";
};

export type DailyFormsCandidate = {
  id: string;
  shiftDate: string;
  completedBy: string;
  cleaningComplete: boolean;
  stockComplete: boolean;
};

export type DailyFormsResumeState = DailyFormsCandidate & {
  nextPath: string | null;
  progress: DailyFormsProgress;
};

export function selectDailyFormsResumeState(
  candidates: DailyFormsCandidate[],
): DailyFormsResumeState | null {
  const unfinished = candidates.find((candidate) => !candidate.stockComplete);
  if (!unfinished) return null;

  const progress: DailyFormsProgress = unfinished.cleaningComplete
    ? { form1: "complete", form2: "complete", form3: "available" }
    : { form1: "complete", form2: "incomplete", form3: "locked" };
  const nextPath = unfinished.cleaningComplete
    ? `/operations/daily-stock?shift=${encodeURIComponent(unfinished.id)}`
    : `/operations/daily-cleaning?shift=${encodeURIComponent(unfinished.id)}`;

  return { ...unfinished, nextPath, progress };
}
