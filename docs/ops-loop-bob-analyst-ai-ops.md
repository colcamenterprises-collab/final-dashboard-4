# Bob → Data Analyst → AI Ops Daily Loop

## Workflow entry points

Manual API trigger:
- `POST /api/ai-ops/ops-loop/daily-analysis/run`
- Body: `{ "shift_date": "YYYY-MM-DD" }`

Manual script trigger:
- `scripts/run-daily-bob-analyst-ai-ops-loop.sh YYYY-MM-DD`
- Under the hood: `server/scripts/run_daily_bob_analyst_ai_ops_loop.ts`

Future cron can call either entrypoint with the same `shift_date` argument.

## Role separation in this loop

1. **Data Analyst computes**
   - Uses `getDailyAnalysis(shiftDate)` from `server/services/dataAnalystService.ts`.
2. **Bob interprets and flags**
   - `runBobShiftAnalysis()` compares POS/form/stock and creates `issues[]` + `recommendations[]`.
3. **AI Ops stores/displays**
   - `runDailyBobAnalystAiOpsLoop()` materializes issues into `ai_issues`.
   - These appear in AI Ops Issue register at `GET /api/ai-ops/issues`.

## Issue payload structure

```json
{
  "title": "Shift 2026-04-21: sales reconciliation",
  "issue_type": "sales_reconciliation",
  "severity": "critical",
  "source_shift_date": "2026-04-21",
  "supporting_evidence": "Sales variance: Form ฿... vs POS ฿...",
  "summary": "Shift 2026-04-21 — 2 issue(s) found...",
  "recommended_action": "Investigate cash handling..."
}
```

## Idempotency / duplicate protection

- Each AI Ops issue includes a deterministic dedupe marker in the description:
  - `[AUTO_LOOP|<shift_date>|<issue_type>|<supporting_evidence>]`
- Before insert, the loop checks for an existing issue with same title + marker.
- Re-runs for the same shift will not duplicate the same finding.
