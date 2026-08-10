import assert from "node:assert/strict";
import test from "node:test";
import { resolveExactReportingRange } from "./unifiedLedger";
import { sourceOwnsTimestamp } from "./reportingCutover";

test("resolves an overnight Bangkok reporting range to exact UTC instants", () => {
  const range = resolveExactReportingRange({
    fromDate: "2026-08-07",
    fromTime: "17:00",
    toDate: "2026-08-08",
    toTime: "03:00",
    timezone: "Asia/Bangkok",
  });
  assert.equal(range.fromInstant, "2026-08-07T10:00:00.000Z");
  assert.equal(range.toInstant, "2026-08-07T20:00:00.000Z");
});

test("rejects a zero or negative reporting range", () => {
  assert.throws(() => resolveExactReportingRange({
    fromDate: "2026-08-08",
    fromTime: "03:00",
    toDate: "2026-08-08",
    toTime: "03:00",
    timezone: "Asia/Bangkok",
  }), /must be after/);
});

test("cutover ownership is half-open and cannot double count", () => {
  const before = new Date("2026-08-09T02:59:59+07:00");
  const boundary = new Date("2026-08-09T03:00:00+07:00");
  assert.equal(sourceOwnsTimestamp("loyverse", before), true);
  assert.equal(sourceOwnsTimestamp("sbb_pos", before), false);
  assert.equal(sourceOwnsTimestamp("loyverse", boundary), false);
  assert.equal(sourceOwnsTimestamp("sbb_pos", boundary), true);
});
