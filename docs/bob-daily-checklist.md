# Bob Daily Readiness Checklist (Artifact Runner)

## Purpose
This checklist defines the canonical **read-only** readiness run for Bob. The run inspects existing canonical endpoints and writes evidence artifacts only. It does **not** trigger rebuilds and does **not** mutate production data.

## Canonical runner
| Item | Value |
|---|---|
| Script | `server/scripts/daily_readiness_check.js` |
| Wrapper | `scripts/run-daily-readiness.sh` |
| Behavior | Read-only evidence collection + JSON readiness decision |

## What the readiness check does
| Step | Behavior |
|---|---|
| 1 | Checks latest calendar date (yesterday in Asia/Bangkok) for `forms/daily-stock` and `analysis/stock-usage`; creates issue artifact when missing. |
| 2 | Looks back up to 7 days and picks the latest completed shift date where forms count > 0 **and** receipts truth count > 0. |
| 3 | Fetches canonical read endpoints for selected date: `forms/daily-stock`, `receipts/truth`, `analysis/stock-usage`. |
| 4 | Writes payload artifacts + `summary.json` + SHA-256 checksums. |
| 5 | Prints structured JSON to stdout, even on failure paths. |

## GO / NO-GO rules
| Rule | GO condition | NO-GO condition |
|---|---|---|
| Latest completed shift exists | Found within lookback window | No qualifying date in 7-day lookback |
| Forms data present | `forms/daily-stock` count > 0 | Count = 0 or endpoint unavailable |
| Receipts truth present | `receipts/truth` count/lines > 0 | Count/lines = 0 or endpoint unavailable |
| Usage built | `analysis/stock-usage` returns built/usable payload | `not_built` or blockers/missing payload |

## Artifact locations
| Artifact type | Path |
|---|---|
| Readiness run folder | `/data/.openclaw/workspace/artifacts/readiness/<DATE>-<STAMP>/` |
| Readiness payload files | `forms-daily-stock.json`, `receipts-truth.json`, `analysis-stock-usage.json`, `summary.json` |
| Issue artifacts | `/data/.openclaw/workspace/artifacts/issues/*.json` |

## Required environment variables
| Variable | Required | Notes |
|---|---|---|
| `BOB_READONLY_TOKEN` | Yes | Bearer token for `/api/bob/read/*` |
| `BOB_BASE_URL` | No | Defaults to `http://127.0.0.1:5000` |
| `NODE_ENV` | No | Wrapper defaults to `production` |

## Exact run command
```bash
BOB_READONLY_TOKEN='<token>' BOB_BASE_URL='http://127.0.0.1:5000' ./scripts/run-daily-readiness.sh
```

## Replit scheduled job command (05:30 BKK)
Use this command in Replit Scheduled Jobs:
```bash
cd /workspace/final-dashboard-4 && BOB_READONLY_TOKEN='<token>' BOB_BASE_URL='http://127.0.0.1:5000' ./scripts/run-daily-readiness.sh
```
Set schedule time to **05:30 Asia/Bangkok** in the Replit scheduler UI.

## Expected stdout JSON format
```json
{
  "date": "YYYY-MM-DD" | null,
  "go": true | false,
  "artifacts": {
    "forms": "...",
    "receipts": "...",
    "usage": "...",
    "summary": "..."
  },
  "checksums": {
    "forms": "...",
    "receipts": "...",
    "usage": "...",
    "summary": "..."
  },
  "issues": [],
  "latestCalendarIssue": "path or null"
}
```

## Verification quick checks
| Check | Command |
|---|---|
| Syntax check | `node --check server/scripts/daily_readiness_check.js` |
| Wrapper executable | `test -x scripts/run-daily-readiness.sh` |
| Manual run | `BOB_READONLY_TOKEN='<token>' ./scripts/run-daily-readiness.sh` |
