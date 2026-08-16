# Labour Efficiency V1

## Purpose

Provide one explainable shift-level productivity measure that works for Smash Brothers now and can be reused by another restaurant without changing the database.

## Metric

`items per labour hour = paid POS item quantity / available production hours`

Available production time is calculated as:

`(itemised paid staff-shifts × daily shift minutes) - break allowance - prep/cleaning allowance`

## Current SBB defaults

- Default reporting window: 17:55 to 02:15 next day (500 minutes).
- Break allowance: 30 minutes per recorded staff member.
- Prep allowance: 60 total staff-minutes per recorded shift.
- Cleaning allowance: 60 total staff-minutes per recorded shift.
- Prep and cleaning combined: 120 total staff-minutes per shift. These are shift-level totals and are not multiplied by staff count.
- Staff source: unique positive WAGES/OVERTIME staff names within each Daily Sales & Stock V2 wage list. Bonus-only and reimbursement rows do not create a worked-staff record.
- Item source: canonical unified reporting ledger quantities for paid, non-cancelled sales. Set components and refunds are excluded by the ledger.

The result and every input are returned together. A missing staff record produces `null` efficiency and a warning; it never manufactures a value.

## Generic design boundary

The calculation is a pure function in `server/reporting/unifiedLabor.ts`. Future restaurants can supply staff count, exact shift minutes and allowance values from a different adapter without changing the formula. No schema or migration is required.

## API

`GET /api/reports/receipt-analytics/unified/overview`

The existing `labor` object now includes `efficiency`, `staffShiftCount`, and `demandSource`. Existing labour cost fields remain unchanged.

The date-based Daily Review compatibility service uses the same calculation and returns `version: "v1"`; the former recipe-weighted labour model has been removed so the repository has one authoritative method.

## Deliberate exclusions

V1 does not weight menu items, estimate recommended staffing, score employees, or infer missing wage rows. Those features are excluded because the current decision only requires a transparent whole-shift baseline.

## Validation

Run:

```bash
npx tsx --test server/reporting/unifiedLabor.test.ts
npm run check
```
