#!/usr/bin/env bash
set -euo pipefail

cd /opt/apps/sbb-app-production

read -r -p "Owner username: " OWNER_USERNAME
read -r -p "Owner display name [Dashboard Owner]: " OWNER_NAME
OWNER_NAME="${OWNER_NAME:-Dashboard Owner}"
read -r -s -p "Owner password (8–72 characters): " OWNER_PASSWORD
echo
if [ "${#OWNER_PASSWORD}" -lt 8 ] || [ "${#OWNER_PASSWORD}" -gt 72 ]; then
  echo "Password must be 8–72 characters." >&2
  exit 1
fi

export OWNER_USERNAME OWNER_NAME OWNER_PASSWORD
node <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const path = ".env";
const existing = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const values = {
  DASHBOARD_OWNER_USERNAME: process.env.OWNER_USERNAME,
  DASHBOARD_OWNER_NAME: process.env.OWNER_NAME,
  DASHBOARD_OWNER_PASSWORD: process.env.OWNER_PASSWORD,
};
if (!/^INTERNAL_APP_PASSWORD=/m.test(existing)) {
  values.INTERNAL_APP_PASSWORD = crypto.randomBytes(48).toString("hex");
}
let output = existing;
for (const [key, value] of Object.entries(values)) {
  const safe = JSON.stringify(String(value));
  const line = `${key}=${safe}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  output = pattern.test(output) ? output.replace(pattern, line) : `${output.replace(/\s*$/, "")}\n${line}\n`;
}
fs.writeFileSync(path, output, { mode: 0o600 });
NODE

npm install
NODE_OPTIONS=--max-old-space-size=4096 npm run check
NODE_OPTIONS=--max-old-space-size=4096 npm run build
systemctl restart sbb-production
sleep 5
systemctl is-active --quiet sbb-production

DASHBOARD_BASE_URL=http://127.0.0.1:8081 \
DASHBOARD_OWNER_USERNAME="$OWNER_USERNAME" \
DASHBOARD_OWNER_PASSWORD="$OWNER_PASSWORD" \
node scripts/verify-production-access.mjs

unset OWNER_USERNAME OWNER_NAME OWNER_PASSWORD
echo "Production access release verified."
