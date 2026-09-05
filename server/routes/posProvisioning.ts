import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachOwnerSessionUser } from "../middleware/sessionAuth";

const router = Router();
const PAIRING_TTL_MINUTES = 10;

function db() {
  if (!pool) throw new Error("POS database is unavailable");
  return pool;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function ownerOnly(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production" || attachOwnerSessionUser(req)) return next();
  return res.status(403).json({ ok: false, error: "OWNER_REQUIRED" });
}

async function businessName() {
  try {
    const result = await db().query(
      `SELECT value FROM ordering_settings WHERE key='restaurant_name' LIMIT 1`,
    );
    const raw = result.rows[0]?.value;
    if (raw == null) return "Connected business";
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : String(parsed?.value || raw);
      } catch {
        return raw;
      }
    }
    return String(raw);
  } catch {
    return "Connected business";
  }
}

router.get("/devices", ownerOnly, async (_req, res) => {
  const result = await db().query(
    `SELECT id, device_name, role, location_name, platform, status, paired_at,
            last_seen_at, app_version, os_version, created_at, pairing_expires_at
       FROM customli_devices
      ORDER BY created_at DESC`,
  );
  res.json({ ok: true, data: result.rows });
});

router.post("/devices", ownerOnly, async (req, res) => {
  const deviceName = String(req.body?.device_name || "").trim().slice(0, 120);
  const role = String(req.body?.role || "").trim();
  const locationName = String(req.body?.location_name || "").trim().slice(0, 120) || null;
  if (!deviceName) return res.status(400).json({ ok: false, error: "Device name is required" });
  if (!["register", "kitchen", "display"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid device role" });
  }

  const id = randomUUID();
  const user = (req as any).user;
  await db().query(
    `INSERT INTO customli_devices(id, tenant_id, device_name, role, location_name, platform, status, created_by)
     VALUES($1,$2,$3,$4,$5,'android','pending',$6)`,
    [id, Number((req as any).tenantId || 1), deviceName, role, locationName, String(user?.id || user?.uid || "owner")],
  );
  res.status(201).json({ ok: true, data: { id, device_name: deviceName, role, location_name: locationName, status: "pending" } });
});

router.patch("/devices/:id", ownerOnly, async (req, res) => {
  const deviceName = req.body?.device_name == null ? null : String(req.body.device_name).trim().slice(0, 120);
  const role = req.body?.role == null ? null : String(req.body.role).trim();
  const locationName = req.body?.location_name == null ? null : String(req.body.location_name).trim().slice(0, 120);
  if (role != null && !["register", "kitchen", "display"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid device role" });
  }
  const result = await db().query(
    `UPDATE customli_devices
        SET device_name=COALESCE($2,device_name),
            role=COALESCE($3,role),
            location_name=CASE WHEN $4::text IS NULL THEN location_name ELSE NULLIF($4,'') END,
            updated_at=NOW()
      WHERE id=$1 AND status <> 'revoked'
      RETURNING id,device_name,role,location_name,platform,status,paired_at,last_seen_at,app_version,os_version`,
    [req.params.id, deviceName || null, role, locationName],
  );
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Device not found" });
  res.json({ ok: true, data: result.rows[0] });
});

router.post("/devices/:id/pairing", ownerOnly, async (req, res) => {
  let code = "";
  let codeHash = "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    codeHash = hash(code);
    const duplicate = await db().query(
      `SELECT 1 FROM customli_devices WHERE pairing_code_hash=$1 AND pairing_expires_at>NOW() LIMIT 1`,
      [codeHash],
    );
    if (!duplicate.rowCount) break;
  }
  if (!code) return res.status(500).json({ ok: false, error: "Unable to create pairing code" });

  const result = await db().query(
    `UPDATE customli_devices
        SET pairing_code_hash=$2,
            pairing_expires_at=NOW()+($3::text || ' minutes')::interval,
            credential_hash=NULL,
            status='pending',
            paired_at=NULL,
            updated_at=NOW()
      WHERE id=$1 AND status <> 'revoked'
      RETURNING id,device_name,role,location_name,pairing_expires_at`,
    [req.params.id, codeHash, PAIRING_TTL_MINUTES],
  );
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Device not found" });
  const device = result.rows[0];
  const claimUri = `customli://provision?code=${code}`;
  res.json({ ok: true, data: { ...device, pairing_code: code, pairing_uri: claimUri, expires_in_minutes: PAIRING_TTL_MINUTES } });
});

router.post("/devices/:id/revoke", ownerOnly, async (req, res) => {
  const result = await db().query(
    `UPDATE customli_devices
        SET status='revoked', credential_hash=NULL, pairing_code_hash=NULL,
            pairing_expires_at=NULL, updated_at=NOW()
      WHERE id=$1
      RETURNING id,device_name,role,status`,
    [req.params.id],
  );
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Device not found" });
  res.json({ ok: true, data: result.rows[0] });
});

router.post("/provisioning/claim", async (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (code.length !== 6) return res.status(400).json({ ok: false, error: "Enter the 6-digit pairing code" });

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id,device_name,role,location_name,status
         FROM customli_devices
        WHERE pairing_code_hash=$1
          AND pairing_expires_at>NOW()
          AND status='pending'
        FOR UPDATE`,
      [hash(code)],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(401).json({ ok: false, error: "Pairing code is invalid or expired" });
    }

    const device = result.rows[0];
    const credential = randomBytes(32).toString("base64url");
    const appVersion = String(req.body?.app_version || "").slice(0, 64) || null;
    const osVersion = String(req.body?.os_version || "").slice(0, 120) || null;
    const platform = String(req.body?.platform || "android").toLowerCase() === "ios" ? "ios" : "android";

    await client.query(
      `UPDATE customli_devices
          SET credential_hash=$2,
              pairing_code_hash=NULL,
              pairing_expires_at=NULL,
              platform=$3,
              app_version=$4,
              os_version=$5,
              status='active',
              paired_at=NOW(),
              last_seen_at=NOW(),
              updated_at=NOW()
        WHERE id=$1`,
      [device.id, hash(credential), platform, appVersion, osVersion],
    );
    await client.query("COMMIT");

    res.json({
      ok: true,
      data: {
        device_id: device.id,
        device_token: credential,
        device_name: device.device_name,
        role: device.role,
        location_name: device.location_name,
        business_name: await businessName(),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/device/me", async (req, res) => {
  const token = String(req.header("x-pos-device-token") || "").trim();
  if (!token) return res.status(401).json({ ok: false, error: "DEVICE_AUTH_REQUIRED" });
  const result = await db().query(
    `UPDATE customli_devices
        SET last_seen_at=NOW(), updated_at=NOW()
      WHERE credential_hash=$1 AND status='active'
      RETURNING id,device_name,role,location_name,platform,status,paired_at,last_seen_at,app_version,os_version`,
    [hash(token)],
  );
  if (!result.rowCount) return res.status(401).json({ ok: false, error: "DEVICE_AUTH_INVALID" });
  res.json({ ok: true, data: { ...result.rows[0], business_name: await businessName() } });
});

/**
 * Compatibility bridge for the existing POS route family. New installations use
 * unique per-device credentials. Once validated here, the request is translated
 * to the legacy shared backend token so proven checkout/shift routes can remain
 * unchanged during the provisioning migration.
 */
export async function deviceCredentialBridge(req: Request, _res: Response, next: NextFunction) {
  const supplied = String(req.header("x-pos-device-token") || "").trim();
  if (!supplied || !process.env.POS_DEVICE_TOKEN || supplied === process.env.POS_DEVICE_TOKEN) return next();
  try {
    const result = await db().query(
      `UPDATE customli_devices
          SET last_seen_at=NOW(), updated_at=NOW()
        WHERE credential_hash=$1 AND status='active'
        RETURNING id,role`,
      [hash(supplied)],
    );
    if (!result.rowCount) return next();
    req.headers["x-pos-device-token"] = process.env.POS_DEVICE_TOKEN;
    (req as any).customliDevice = result.rows[0];
  } catch (error) {
    console.error("[deviceProvisioning] credential bridge failed", error);
  }
  next();
}

export default router;
