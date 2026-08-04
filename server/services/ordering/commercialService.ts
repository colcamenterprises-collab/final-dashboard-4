import crypto from "crypto";
import QRCode from "qrcode";
import { pool } from "../../db";

const DEFAULT_TENANT = "sbb";
const ATTRIBUTION_HOURS = 12;

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

function tenantKey(input?: unknown) {
  const value = String(input || DEFAULT_TENANT).trim().toLowerCase();
  return value || DEFAULT_TENANT;
}

function normalizePhone(value: unknown) {
  const raw = String(value || "").trim();
  const normalized = raw.replace(/[^0-9+]/g, "").replace(/^00/, "+");
  if (!normalized) throw new Error("Mobile number is required");
  return normalized;
}

function token(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function venueCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function ensureCommercialSchema() {
  const database = db();
  await database.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await database.query(`
    CREATE TABLE IF NOT EXISTS ordering_partner_venues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_key TEXT NOT NULL DEFAULT 'sbb',
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      phone TEXT,
      address TEXT NOT NULL,
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7),
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS ordering_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_key TEXT NOT NULL DEFAULT 'sbb',
      member_number TEXT NOT NULL,
      name TEXT NOT NULL,
      phone_display TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_key, member_number),
      UNIQUE(tenant_key, phone_normalized)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS ordering_qr_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_key TEXT NOT NULL DEFAULT 'sbb',
      qr_type TEXT NOT NULL CHECK (qr_type IN ('partner_venue','member')),
      token TEXT NOT NULL UNIQUE,
      partner_venue_id UUID REFERENCES ordering_partner_venues(id) ON DELETE CASCADE,
      member_id UUID REFERENCES ordering_members(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS ordering_qr_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_key TEXT NOT NULL DEFAULT 'sbb',
      qr_code_id UUID NOT NULL REFERENCES ordering_qr_codes(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL DEFAULT 'scan',
      session_key TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`CREATE INDEX IF NOT EXISTS ordering_qr_events_qr_created_idx ON ordering_qr_events(qr_code_id, created_at DESC)`);
  await database.query(`CREATE INDEX IF NOT EXISTS ordering_partner_venues_tenant_idx ON ordering_partner_venues(tenant_key, is_active, name)`);
  await database.query(`CREATE INDEX IF NOT EXISTS ordering_members_tenant_idx ON ordering_members(tenant_key, status, created_at DESC)`);

  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS channel_source TEXT NOT NULL DEFAULT 'direct'`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS partner_venue_id UUID REFERENCES ordering_partner_venues(id) ON DELETE SET NULL`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES ordering_members(id) ON DELETE SET NULL`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS qr_code_id UUID REFERENCES ordering_qr_codes(id) ON DELETE SET NULL`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_address_snapshot TEXT`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS attribution_started_at TIMESTAMPTZ`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_fee_standard NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await database.query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_fee_charged NUMERIC(10,2) NOT NULL DEFAULT 0`);
}

export async function listPartnerVenues(tenant = DEFAULT_TENANT) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT v.*,
      q.id AS qr_code_id,
      q.token AS qr_token,
      COUNT(DISTINCT e.id)::int AS qr_scans,
      COUNT(DISTINCT o.id)::int AS orders,
      COALESCE(SUM(DISTINCT CASE WHEN o.id IS NOT NULL THEN o.total ELSE 0 END),0)::numeric AS sales
    FROM ordering_partner_venues v
    LEFT JOIN ordering_qr_codes q ON q.partner_venue_id=v.id AND q.qr_type='partner_venue' AND q.is_active=TRUE
    LEFT JOIN ordering_qr_events e ON e.qr_code_id=q.id AND e.event_type='scan'
    LEFT JOIN ordering_orders o ON o.partner_venue_id=v.id
    WHERE v.tenant_key=$1
    GROUP BY v.id,q.id,q.token
    ORDER BY v.is_active DESC,v.name ASC
  `, [tenantKey(tenant)]);
  return result.rows;
}

export async function createPartnerVenue(input: any) {
  await ensureCommercialSchema();
  const tenant = tenantKey(input?.tenant_key);
  const name = String(input?.name || "").trim();
  const address = String(input?.address || "").trim();
  if (!name) throw new Error("Venue name is required");
  if (!address) throw new Error("Venue delivery address is required");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(`
      INSERT INTO ordering_partner_venues
        (tenant_key,name,code,contact_name,phone,address,latitude,longitude,notes,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
      RETURNING *
    `, [tenant,name,venueCode(),input?.contact_name || null,input?.phone || null,address,input?.latitude ?? null,input?.longitude ?? null,input?.notes || null]);
    const venue = created.rows[0];
    const qr = await client.query(`
      INSERT INTO ordering_qr_codes (tenant_key,qr_type,token,partner_venue_id)
      VALUES ($1,'partner_venue',$2,$3)
      RETURNING *
    `, [tenant,token("venue"),venue.id]);
    await client.query("COMMIT");
    return { ...venue, qr_code_id: qr.rows[0].id, qr_token: qr.rows[0].token };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePartnerVenue(id: string, input: any) {
  await ensureCommercialSchema();
  const result = await db().query(`
    UPDATE ordering_partner_venues SET
      name=COALESCE($2,name), contact_name=$3, phone=$4,
      address=COALESCE($5,address), latitude=$6, longitude=$7,
      notes=$8, is_active=COALESCE($9,is_active), updated_at=NOW()
    WHERE id=$1 RETURNING *
  `, [id,input?.name ?? null,input?.contact_name ?? null,input?.phone ?? null,input?.address ?? null,input?.latitude ?? null,input?.longitude ?? null,input?.notes ?? null,input?.is_active ?? null]);
  if (!result.rows[0]) throw new Error("Partner venue not found");
  return result.rows[0];
}

export async function getPartnerVenueQr(id: string, baseUrl: string) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT v.*,q.id AS qr_code_id,q.token AS qr_token
    FROM ordering_partner_venues v
    JOIN ordering_qr_codes q ON q.partner_venue_id=v.id AND q.qr_type='partner_venue' AND q.is_active=TRUE
    WHERE v.id=$1
    LIMIT 1
  `,[id]);
  const row = result.rows[0];
  if (!row) throw new Error("Partner venue QR not found");
  const url = `${baseUrl.replace(/\/$/,"")}/order?v=${encodeURIComponent(row.qr_token)}`;
  return { ...row, order_url: url, qr_data_url: await QRCode.toDataURL(url,{ width: 720, margin: 2, errorCorrectionLevel: "M" }) };
}

export async function resolvePartnerQr(qrToken: string, meta: { session_key?: string; user_agent?: string } = {}) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT q.id AS qr_code_id,q.token AS qr_token,v.*
    FROM ordering_qr_codes q
    JOIN ordering_partner_venues v ON v.id=q.partner_venue_id
    WHERE q.token=$1 AND q.qr_type='partner_venue' AND q.is_active=TRUE AND v.is_active=TRUE
    LIMIT 1
  `,[qrToken]);
  const venue = result.rows[0];
  if (!venue) throw new Error("Partner venue QR is invalid or inactive");
  await db().query(`INSERT INTO ordering_qr_events (tenant_key,qr_code_id,event_type,session_key,user_agent) VALUES ($1,$2,'scan',$3,$4)`, [venue.tenant_key,venue.qr_code_id,meta.session_key || null,meta.user_agent || null]);
  const expiresAt = new Date(Date.now() + ATTRIBUTION_HOURS * 60 * 60 * 1000).toISOString();
  return {
    channel_source: "partner_venue",
    partner_venue_id: venue.id,
    qr_code_id: venue.qr_code_id,
    qr_token: venue.qr_token,
    venue: { id: venue.id, name: venue.name, code: venue.code, address: venue.address, latitude: venue.latitude, longitude: venue.longitude },
    attribution_hours: ATTRIBUTION_HOURS,
    attribution_started_at: new Date().toISOString(),
    attribution_expires_at: expiresAt,
    delivery_locked_to_venue: true,
  };
}

async function nextMemberNumber(tenant: string) {
  const result = await db().query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number,'\\D','','g'),'' )::int),0)+1 AS next_number FROM ordering_members WHERE tenant_key=$1`, [tenant]);
  return `${tenant.toUpperCase()}-${String(Number(result.rows[0]?.next_number || 1)).padStart(6,"0")}`;
}

export async function createOrFindMember(input: any, baseUrl: string) {
  await ensureCommercialSchema();
  const tenant = tenantKey(input?.tenant_key);
  const name = String(input?.name || "").trim();
  const phoneDisplay = String(input?.phone || "").trim();
  const phoneNormalized = normalizePhone(phoneDisplay);
  if (!name) throw new Error("Name is required");
  let result = await db().query(`SELECT * FROM ordering_members WHERE tenant_key=$1 AND phone_normalized=$2 LIMIT 1`, [tenant,phoneNormalized]);
  let member = result.rows[0];
  if (!member) {
    const memberNumber = await nextMemberNumber(tenant);
    result = await db().query(`
      INSERT INTO ordering_members (tenant_key,member_number,name,phone_display,phone_normalized)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,[tenant,memberNumber,name,phoneDisplay,phoneNormalized]);
    member = result.rows[0];
  } else if (member.name !== name && name) {
    const updated = await db().query(`UPDATE ordering_members SET name=$2,phone_display=$3,updated_at=NOW() WHERE id=$1 RETURNING *`,[member.id,name,phoneDisplay]);
    member = updated.rows[0];
  }
  let qr = (await db().query(`SELECT * FROM ordering_qr_codes WHERE member_id=$1 AND qr_type='member' AND is_active=TRUE LIMIT 1`,[member.id])).rows[0];
  if (!qr) {
    qr = (await db().query(`INSERT INTO ordering_qr_codes (tenant_key,qr_type,token,member_id) VALUES ($1,'member',$2,$3) RETURNING *`,[tenant,token("member"),member.id])).rows[0];
  }
  const url = `${baseUrl.replace(/\/$/,"")}/order?member=${encodeURIComponent(qr.token)}`;
  return { ...member, qr_code_id: qr.id, qr_token: qr.token, member_url: url, qr_data_url: await QRCode.toDataURL(url,{ width: 720, margin: 2, errorCorrectionLevel: "M" }) };
}

export async function lookupMember(phone: string, tenant = DEFAULT_TENANT, baseUrl = "") {
  await ensureCommercialSchema();
  const normalized = normalizePhone(phone);
  const result = await db().query(`
    SELECT m.*,q.id AS qr_code_id,q.token AS qr_token,
      COUNT(DISTINCT o.id)::int AS order_count,
      COALESCE(SUM(o.total),0)::numeric AS lifetime_spend,
      MAX(o.created_at) AS last_order_at
    FROM ordering_members m
    LEFT JOIN ordering_qr_codes q ON q.member_id=m.id AND q.qr_type='member' AND q.is_active=TRUE
    LEFT JOIN ordering_orders o ON o.member_id=m.id AND o.status NOT IN ('cancelled','refunded')
    WHERE m.tenant_key=$1 AND m.phone_normalized=$2
    GROUP BY m.id,q.id,q.token
    LIMIT 1
  `,[tenantKey(tenant),normalized]);
  const member = result.rows[0];
  if (!member) return null;
  const url = baseUrl && member.qr_token ? `${baseUrl.replace(/\/$/,"")}/order?member=${encodeURIComponent(member.qr_token)}` : null;
  return { ...member, member_url: url, qr_data_url: url ? await QRCode.toDataURL(url,{ width: 720, margin: 2, errorCorrectionLevel: "M" }) : null };
}

export async function resolveMemberQr(qrToken: string) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT m.*,q.id AS qr_code_id,q.token AS qr_token
    FROM ordering_qr_codes q JOIN ordering_members m ON m.id=q.member_id
    WHERE q.token=$1 AND q.qr_type='member' AND q.is_active=TRUE AND m.status='active'
    LIMIT 1
  `,[qrToken]);
  return result.rows[0] || null;
}

export async function listMembers(tenant = DEFAULT_TENANT) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT m.*,COUNT(DISTINCT o.id)::int AS order_count,COALESCE(SUM(o.total),0)::numeric AS lifetime_spend,MAX(o.created_at) AS last_order_at
    FROM ordering_members m
    LEFT JOIN ordering_orders o ON o.member_id=m.id AND o.status NOT IN ('cancelled','refunded')
    WHERE m.tenant_key=$1
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `,[tenantKey(tenant)]);
  return result.rows;
}

export async function partnerVenueReport(id: string) {
  await ensureCommercialSchema();
  const result = await db().query(`
    SELECT v.id,v.name,v.code,v.address,
      COUNT(DISTINCT e.id)::int AS qr_scans,
      COUNT(DISTINCT o.id)::int AS orders,
      COALESCE(SUM(o.total),0)::numeric AS sales,
      COALESCE(AVG(o.total),0)::numeric AS average_order_value,
      COUNT(DISTINCT o.member_id)::int AS members,
      MAX(o.created_at) AS last_order_at
    FROM ordering_partner_venues v
    LEFT JOIN ordering_qr_codes q ON q.partner_venue_id=v.id AND q.qr_type='partner_venue'
    LEFT JOIN ordering_qr_events e ON e.qr_code_id=q.id AND e.event_type='scan'
    LEFT JOIN ordering_orders o ON o.partner_venue_id=v.id AND o.status NOT IN ('cancelled','refunded')
    WHERE v.id=$1
    GROUP BY v.id
  `,[id]);
  if (!result.rows[0]) throw new Error("Partner venue not found");
  return result.rows[0];
}
