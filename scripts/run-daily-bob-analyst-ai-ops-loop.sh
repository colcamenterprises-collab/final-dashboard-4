#!/usr/bin/env bash
set -euo pipefail

SHIFT_DATE="${1:-}"
if [[ -z "$SHIFT_DATE" ]]; then
  echo "Usage: scripts/run-daily-bob-analyst-ai-ops-loop.sh YYYY-MM-DD" >&2
  exit 1
fi

npx tsx server/scripts/run_daily_bob_analyst_ai_ops_loop.ts "$SHIFT_DATE"
