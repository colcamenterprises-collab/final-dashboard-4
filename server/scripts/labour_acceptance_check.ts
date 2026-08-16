import assert from "node:assert/strict";
import { calculateLabourEfficiency } from "../reporting/unifiedLabor";

const result = calculateLabourEfficiency({
  itemCount: 300,
  staffCount: 4,
  shiftCount: 1,
  shiftMinutes: 500,
});

assert.equal(result.grossLabourMinutes, 2000, "gross staff minutes");
assert.equal(result.breakAllowanceMinutes, 240, "60 minute break per staff member");
assert.equal(result.prepMinutes, 60, "one hour total prep allowance per shift");
assert.equal(result.cleaningMinutes, 60, "one hour total cleaning allowance per shift");
assert.equal(result.prepAndCleaningMinutes, 120, "total shift prep and cleaning allowance");
assert.equal(result.availableProductionMinutes, 1640, "available production minutes");
assert.equal(result.itemsPerLabourHour?.toFixed(2), "10.98", "items per labour hour");

console.log("Labour efficiency V1 acceptance checks passed");
