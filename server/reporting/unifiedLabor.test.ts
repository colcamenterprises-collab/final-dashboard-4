import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRecordedLabor } from "./unifiedLabor";

test("summarizes paid labor without counting reimbursements or tips", () => {
  const result = summarizeRecordedLabor([{ payload: { wages: [
    { staff: "Nok", amount: 500, type: "WAGES" },
    { staff: "Nok", amount: 100, type: "OVERTIME" },
    { staff: "Bee", amount: 450, type: "WAGES" },
    { staff: "Bee", amount: 80, type: "REIMBURSEMENT" },
    { staff: "", amount: 100, type: "TIPS" },
  ] } }]);
  assert.deepEqual(result, { laborCost: 1050, paidStaffCount: 2 });
});

test("ignores empty and invalid wage rows", () => {
  assert.deepEqual(summarizeRecordedLabor([
    { payload: { wages: [{ staff: "A", amount: 0, type: "WAGES" }, { staff: "B", amount: "bad" }] } },
    { payload: {} },
  ]), { laborCost: 0, paidStaffCount: 0 });
});
