import assert from "node:assert/strict";
import test from "node:test";
import { selectDailyFormsResumeState } from "./dailyFormsWorkflow";

test("resumes Form 2 when cleaning is incomplete", () => {
  const state = selectDailyFormsResumeState([{ id: "sales 1", shiftDate: "2026-07-28", completedBy: "Staff", cleaningComplete: false, stockComplete: false }]);
  assert.equal(state?.nextPath, "/operations/daily-cleaning?shift=sales%201");
  assert.deepEqual(state?.progress, { form1: "complete", form2: "incomplete", form3: "locked" });
});

test("resumes Form 3 when cleaning is complete", () => {
  const state = selectDailyFormsResumeState([{ id: "sales-2", shiftDate: "2026-07-28", completedBy: "Staff", cleaningComplete: true, stockComplete: false }]);
  assert.equal(state?.nextPath, "/operations/daily-stock?shift=sales-2");
  assert.deepEqual(state?.progress, { form1: "complete", form2: "complete", form3: "available" });
});

test("does not retain a warning after Form 3 completes", () => {
  const state = selectDailyFormsResumeState([{ id: "sales-3", shiftDate: "2026-07-28", completedBy: "Staff", cleaningComplete: true, stockComplete: true }]);
  assert.equal(state, null);
});

test("selects the first unfinished candidate from server date order", () => {
  const state = selectDailyFormsResumeState([
    { id: "complete", shiftDate: "2026-07-28", completedBy: "Staff", cleaningComplete: true, stockComplete: true },
    { id: "unfinished", shiftDate: "2026-07-27", completedBy: "Staff", cleaningComplete: false, stockComplete: false },
  ]);
  assert.equal(state?.id, "unfinished");
});
