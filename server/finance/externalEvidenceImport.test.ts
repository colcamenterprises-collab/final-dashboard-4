import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExternalEvidenceCsv } from './externalEvidenceImport';

test('parses verified Grab gross/net/deductions and skips summary rows', () => {
  const csv = `Date,Order Number,Gross Amount THB,Net Amount THB,Grab Deductions THB,Net % of Gross,Completed Time\n2026-08-17,GF-525,308,250.32,57.68,81.27,01:52\n2026-08-16,GF-505,2447,1985.81,461.19,81.15,20:53\n2026-08-17,DAILY TOTAL,1188,955.05,232.95,80.39,3 orders\nALL DATES,GRAND TOTAL,10885,8781.57,2103.43,80.68,22 orders\n`;
  const result = parseExternalEvidenceCsv(csv, { timezone: 'Asia/Bangkok', providerKey: 'grabfood' });
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.skippedSummaryRows, 2);
  assert.equal(result.accepted[0].externalOrderId, 'GF-525');
  assert.equal(result.accepted[0].grossSales, 308);
  assert.equal(result.accepted[0].netSales, 250.32);
  assert.equal(result.accepted[0].otherDeduction, 57.68);
  assert.equal(result.accepted[0].transactionAt.toISOString(), '2026-08-16T18:52:00.000Z');
});

test('derives deductions from gross minus net when provider total deduction is absent', () => {
  const csv = `Date,Order ID,Gross Amount,Net Amount,Completed Time\n2026-08-16,GF-699,356,281.85,20:53\n`;
  const result = parseExternalEvidenceCsv(csv, { timezone: 'Asia/Bangkok' });
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].otherDeduction, 74.15);
});

test('rejects rows without a source identifier', () => {
  const csv = `Date,Gross Amount,Net Amount,Completed Time\n2026-08-16,356,281.85,20:53\n`;
  const result = parseExternalEvidenceCsv(csv, { timezone: 'Asia/Bangkok' });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].reason, /identifier/i);
});
