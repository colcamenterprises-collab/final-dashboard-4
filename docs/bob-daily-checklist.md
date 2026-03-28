# Bob Daily Checklist

## Inputs
- `date` in `YYYY-MM-DD`

## Checks (in order)

| Step | Endpoint | What Bob Verifies | Done Criteria |
|---|---|---|---|
| 1 | `GET /api/bob/read/system-health` | Runtime + module availability | `status=ok` and API health visible |
| 2 | `GET /api/bob/read/system-map` | Ownership map (page→endpoint→service→table) | Route map present and canonical sources listed |
| 3 | `GET /api/bob/read/module-status` | Domain-level readiness | Required modules not all `missing` |
| 4 | `GET /api/bob/read/build-status?date=YYYY-MM-DD` | Build/analysis state | Reports visible, failures explicit |
| 5 | `GET /api/bob/read/forms/daily-sales?date=YYYY-MM-DD` | Sales form exists | At least one row or structured blocker |
| 6 | `GET /api/bob/read/forms/daily-stock?date=YYYY-MM-DD` | Stock form exists | At least one row or structured blocker |
| 7 | `GET /api/bob/read/receipts/truth?date=YYYY-MM-DD` | Raw vs normalized receipt truth | Availability and aggregates explicit |
| 8 | `GET /api/bob/read/usage/truth?date=YYYY-MM-DD` | Usage derivation truth | Summary + row breakdown OR blockers |
| 9 | `GET /api/bob/read/issues?date=YYYY-MM-DD` | Issue register state | Issue list + counts visible |
| 10 | `GET /api/bob/read/catalog` | Catalog/modifier visibility | Live/hidden + modifier state visible |
| 11 | `GET /api/bob/read/orders?date=YYYY-MM-DD` | Online order read visibility | Orders and line items visible |
| 12 | `GET /api/bob/read/shift-snapshot?date=YYYY-MM-DD` | Unified daily intelligence snapshot | Forms/receipts/usage/build/issues + blockers + confidence signals |

## “Done” Definition for Bob Daily Run
- Bob can identify what exists, what is missing, where it failed, and canonical source ownership by date.
- Missing derived data is reported with blockers, not inferred values.
- No write or destructive route is used in daily checks.
