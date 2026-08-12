#!/usr/bin/env bash
set -euo pipefail

base_ref="${GITHUB_BASE_REF:-main}"
git fetch --no-tags --depth=1 origin "${base_ref}"

mapfile -t changed_files < <(git diff --name-only "origin/${base_ref}...HEAD")

if ((${#changed_files[@]} == 0)); then
  echo "No changed files detected."
  exit 0
fi

printf 'Reviewing %s changed files.\n' "${#changed_files[@]}"

workflow_changed=false
database_changed=false
for file in "${changed_files[@]}"; do
  [[ "$file" == .github/workflows/*.yml || "$file" == .github/workflows/*.yaml ]] && workflow_changed=true
  case "$file" in
    schema.prisma|migrations/*|prisma/migrations/*|server/migrations/*|sql_migrations/*)
      database_changed=true
      ;;
  esac
done

if [[ "$workflow_changed" == true ]]; then
  mapfile -t workflow_files < <(printf '%s\n' "${changed_files[@]}" | grep -E '^\.github/workflows/.*\.ya?ml$' || true)
  for file in "${workflow_files[@]}"; do
    [[ -f "$file" ]] || continue
    if grep -En 'contents:[[:space:]]*write|git[[:space:]]+push([^#]|$)|git[[:space:]]+reset[[:space:]]+--hard|HEAD:main' "$file"; then
      echo "::error file=${file}::Changed workflows may not write to the repository or push directly to main."
      exit 1
    fi
  done
fi

if [[ "$database_changed" == true ]]; then
  labels="${PR_LABELS:-}"
  if [[ ",${labels}," != *",database-reviewed,"* ]]; then
    echo "::error::Database files are frozen until the production baseline is reconciled. A database-reviewed label is required."
    exit 1
  fi

  mapfile -t sql_files < <(printf '%s\n' "${changed_files[@]}" | grep -E '(^|/)(migration\.sql|[^/]+\.sql)$' || true)
  for file in "${sql_files[@]}"; do
    [[ -f "$file" ]] || continue
    if grep -Ein '(^|[[:space:];])(DROP[[:space:]]+(TABLE|TYPE|SCHEMA|DATABASE)|TRUNCATE[[:space:]]+TABLE|ALTER[[:space:]]+TABLE[^;]*(DROP[[:space:]]+(COLUMN|CONSTRAINT)|TYPE[[:space:]]))' "$file"; then
      echo "::error file=${file}::Destructive SQL requires a separately reviewed and tested migration plan."
      exit 1
    fi
  done
fi

echo "PR policy checks passed."
