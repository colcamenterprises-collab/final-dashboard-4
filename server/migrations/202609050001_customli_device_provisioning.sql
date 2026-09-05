CREATE TABLE IF NOT EXISTS customli_devices (
  id UUID PRIMARY KEY,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  device_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('register','kitchen','display')),
  location_name TEXT,
  platform TEXT NOT NULL DEFAULT 'android',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  credential_hash TEXT,
  pairing_code_hash TEXT,
  pairing_expires_at TIMESTAMPTZ,
  paired_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  app_version TEXT,
  os_version TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customli_devices_tenant_idx
  ON customli_devices(tenant_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS customli_devices_active_pairing_code_idx
  ON customli_devices(pairing_code_hash)
  WHERE pairing_code_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customli_devices_active_credential_idx
  ON customli_devices(credential_hash)
  WHERE credential_hash IS NOT NULL;
