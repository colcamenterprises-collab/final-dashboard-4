#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV="${NODE_ENV:-production}"
export BOB_BASE_URL="${BOB_BASE_URL:-http://127.0.0.1:5000}"

if [[ -z "${BOB_READONLY_TOKEN:-}" ]]; then
  echo '{"date":null,"go":false,"artifacts":{"forms":null,"receipts":null,"usage":null,"summary":null},"checksums":{"forms":null,"receipts":null,"usage":null,"summary":null},"issues":[{"code":"TOKEN_MISSING","message":"BOB_READONLY_TOKEN is required","where":"env","canonical_source":"BOB_READONLY_TOKEN","auto_build_attempted":false}],"latestCalendarIssue":null}'
  exit 1
fi

exec node server/scripts/daily_readiness_check.js
