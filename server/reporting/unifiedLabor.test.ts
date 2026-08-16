import assert from "node:assert/strict";
import test from "node:test";
import { calculateLabourEfficiency, summarizeRecordedLabor } from "./unifiedLabor";

test("summarizes paid labor without counting reimbursements or tips", () => {
  const result = summarizeRecordedLabor([{ payload: { wages: [
    { staff: "Nok", amount: 500, type: "WAGES" },
    { staff: "Nok", amount: 100, type: "OVERTIME" },
    { staff: "Bee", amount: 450, type: "WAGES" },
    { staff: "Bee", amount: 80, type: "REIMBURSEMENT" },
    { staff: "May", amount: 200, type: "BONUS" },
    { staff: "", amount: 100, type: "TIPS" },
  ] } }]);
  assert.deepEqual(result, { laborCost: 1250, paidStaffCount: 2, staffShiftCount: 2, recordedShiftCount: 1 });
});

test("ignores empty and invalid wage rows", () => {
  assert.deepEqual(summarizeRecordedLabor([
    { payload: { wages: [{ staff: "A", amount: 0, type: "WAGES" }, { staff: "B", amount: "bad" }] } },
    { payload: {} },
  ]), { laborCost: 0, paidStaffCount: 0, staffShiftCount: 0, recordedShiftCount: 0 });
});

test("counts the same employee once per shift but preserves staff-shift capacity", () => {
  assert.deepEqual(summarizeRecordedLabor([
    { payload: { wages: [{ staff: "Nok", amount: 500, type: "WAGES" }] } },
    { payload: { wages: [{ staff: "Nok", amount: 500, type: "WAGES" }] } },
  ]), { laborCost: 1000, paidStaffCount: 1, staffShiftCount: 2, recordedShiftCount: 2 });
});

test("calculates V1 items per available labour hour for the SBB shift", () => {
  const result = calculateLabourEfficiency({
    itemCount: 300,
    staffCount: 4,
    shiftMinutes: 500,
  });

  assert.equal(result.grossLabourMinutes, 2000);
  assert.equal(result.breakAllowanceMinutes, 120);
  assert.equal(result.prepMinutes, 60);
  assert.equal(result.cleaningMinutes, 60);
  assert.equal(result.prepAndCleaningMinutes, 120);
  assert.equal(result.availableProductionMinutes, 1760);
  assert.equal(result.itemsPerLabourHour?.toFixed(2), "10.23");
  assert.deepEqual(result.warnings, []);
});

test("returns an explainable empty result rather than dividing by zero", () => {
  const result = calculateLabourEfficiency({ itemCount: 20, staffCount: 0, shiftMinutes: 500 });
  assert.equal(result.itemsPerLabourHour, null);
  assert.equal(result.availableProductionMinutes, 0);
  assert.match(result.warnings[0], /No itemised paid staff/);
});
