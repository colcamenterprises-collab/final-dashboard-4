#!/usr/bin/env bash
set -euo pipefail

# Block unsafe Prisma commands in production
if [[ "${NODE_ENV:-production}" == "production" ]]; then
  if grep -R --line-number -E "prisma (db push|migrate reset)" -- package.json 2>/dev/null || true; then
    echo "Unsafe Prisma command detected in prod. Failing."
    exit 1
  fi
fi