import assert from "node:assert/strict";
import { calculateLabourEfficiency } from "../reporting/unifiedLabor";

const result = calculateLabourEfficiency({
  itemCount: 300,
  staffCount: 4,
  shiftCount: 1,
  shiftMinutes: 500,
});

assert.equal(result.grossLabourMinutes, 2000, "gross staff minutes");
assert.equal(result.breakAllowanceMinutes, 120, "30 minute break per staff member");
assert.equal(result.prepAndCleaningMinutes, 105, "shift prep and cleaning allowance");
assert.equal(result.availableProductionMinutes, 1775, "available production minutes");
assert.equal(result.itemsPerLabourHour?.toFixed(2), "10.14", "items per labour hour");

console.log("Labour efficiency V1 acceptance checks passed");
