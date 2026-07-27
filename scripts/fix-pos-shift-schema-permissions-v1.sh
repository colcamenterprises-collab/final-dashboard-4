#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Resolve DATABASE_URL from the effective systemd service environment first.
# Fall back to common app env files and finally the systemd drop-in itself.
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  SYSTEMD_ENV=$(systemctl show sbb-production.service --property=Environment --value 2>/dev/null || true)
  if [[ -n "$SYSTEMD_ENV" ]]; then
    DATABASE_URL=$(python3 - "$SYSTEMD_ENV" <<'PY'
import shlex, sys
value = ""
try:
    words = shlex.split(sys.argv[1])
except ValueError:
    words = sys.argv[1].split()
for word in words:
    if word.startswith("DATABASE_URL="):
        value = word.split("=", 1)[1]
        break
print(value)
PY
    )
  fi
fi

if [[ -z "$DATABASE_URL" ]]; then
  for candidate in .env .env.production /opt/apps/sbb-app-production/.env /opt/apps/sbb-app-production/.env.production; do
    [[ -f "$candidate" ]] || continue
    DATABASE_URL=$(python3 - "$candidate" <<'PY'
import sys
value = ""
with open(sys.argv[1], encoding="utf-8") as handle:
    for raw in handle:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        if key.strip() == "DATABASE_URL":
            value = val.strip().strip('"').strip("'")
            break
print(value)
PY
    )
    [[ -n "$DATABASE_URL" ]] && break
  done
fi

if [[ -z "$DATABASE_URL" ]]; then
  ENV_FILE=/etc/systemd/system/sbb-production.service.d/environment.conf
  if [[ -f "$ENV_FILE" ]]; then
    DATABASE_URL=$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
value = ""
with open(sys.argv[1], encoding="utf-8") as handle:
    for raw in handle:
        line = raw.strip()
        if not line.startswith("Environment="):
            continue
        payload = line[len("Environment="):]
        try:
            assignments = shlex.split(payload)
        except ValueError:
            assignments = [payload.strip('"')]
        for assignment in assignments:
            if assignment.startswith("DATABASE_URL="):
                value = assignment.split("=", 1)[1]
                break
print(value)
PY
    )
  fi
fi

export DATABASE_URL
if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL could not be resolved from the running service or production env files" >&2
  echo "systemd EnvironmentFiles: $(systemctl show sbb-production.service --property=EnvironmentFiles --value 2>/dev/null || true)" >&2
  exit 1
fi

DB_NAME=$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.pathname.replace(/^\//,""))')
APP_ROLE=$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.username))')
DB_HOST=$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname)')

if [[ "$DB_HOST" != "localhost" && "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "::1" ]]; then
  echo "Database is remote ($DB_HOST). A database-owner connection is required to provision the POS shift schema." >&2
  exit 2
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
GRANT USAGE ON SCHEMA public TO "$APP_ROLE";

CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT NOW(),
  closed_at timestamptz,
  starting_float numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash numeric(12,2),
  cash_banked numeric(12,2),
  expected_cash numeric(12,2),
  variance numeric(12,2),
  status text NOT NULL DEFAULT 'open',
  opened_by text,
  closed_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pos_shift_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('cash_in','cash_out')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_one_open_shift_idx
  ON public.pos_shifts ((status)) WHERE status='open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shifts TO "$APP_ROLE";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shift_movements TO "$APP_ROLE";
SQL

node - <<'NODE'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query("SELECT to_regclass('public.pos_shifts') shifts, to_regclass('public.pos_shift_movements') movements");
  if (!result.rows[0]?.shifts || !result.rows[0]?.movements) throw new Error('POS shift tables were not created');
  console.log('PASS POS shift schema provisioned and visible to the application role');
} finally {
  await pool.end();
}
NODE
