import { pool } from "../../db";
import { ensureCommercialSchema } from "./commercialService";

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

export async function validateCommercialOrderInput(input: any) {
  await ensureCommercialSchema();
  const source = input?.channel_source === "partner_venue" ? "partner_venue" : "direct";
  const normalized: any = {
    channel_source: source,
    partner_venue_id: null,
    member_id: input?.member_id || null,
    qr_code_id: input?.qr_code_id || null,
    attribution_started_at: input?.attribution_started_at || null,
    delivery_address_snapshot: input?.delivery_address_snapshot || null,
    delivery_fee_standard: Number(input?.delivery_fee_standard || 0),
    delivery_fee_charged: Number(input?.delivery_fee_charged || 0),
  };

  if (source === "partner_venue") {
    const partnerVenueId = input?.partner_venue_id || null;
    if (!partnerVenueId) throw new Error("Partner venue attribution is missing the venue ID");
    const started = input?.attribution_started_at ? new Date(input.attribution_started_at) : null;
    const expiryMs = started ? started.getTime() + 12 * 60 * 60 * 1000 : 0;
    if (!started || !Number.isFinite(expiryMs) || Date.now() > expiryMs) throw new Error("Partner venue attribution has expired");
    const venueResult = await db().query(`SELECT id,address FROM ordering_partner_venues WHERE id=$1 AND is_active=TRUE LIMIT 1`, [partnerVenueId]);
    const venue = venueResult.rows[0];
    if (!venue) throw new Error("Partner venue attribution is invalid or inactive");
    normalized.partner_venue_id = venue.id;
    normalized.delivery_address_snapshot = venue.address;
    normalized.attribution_started_at = started.toISOString();
  }

  if (normalized.member_id) {
    const memberResult = await db().query(`SELECT id FROM ordering_members WHERE id=$1 AND status='active' LIMIT 1`, [normalized.member_id]);
    if (!memberResult.rows[0]) throw new Error("Membership is invalid or inactive");
  }

  return normalized;
}

export async function attachCommercialAttributionToOrder(orderId: string, normalized: any) {
  await ensureCommercialSchema();
  const result = await db().query(`
    UPDATE ordering_orders SET
      channel_source=$2,
      partner_venue_id=$3,
      member_id=$4,
      qr_code_id=$5,
      delivery_address_snapshot=$6,
      attribution_started_at=$7,
      delivery_fee_standard=$8,
      delivery_fee_charged=$9,
      updated_at=NOW()
    WHERE id=$1
    RETURNING *
  `,[
    orderId,
    normalized?.channel_source || "direct",
    normalized?.partner_venue_id || null,
    normalized?.member_id || null,
    normalized?.qr_code_id || null,
    normalized?.delivery_address_snapshot || null,
    normalized?.attribution_started_at ? new Date(normalized.attribution_started_at) : null,
    Number(normalized?.delivery_fee_standard || 0),
    Number(normalized?.delivery_fee_charged || 0),
  ]);
  if (!result.rows[0]) throw new Error("Order attribution could not be saved");
  return result.rows[0];
}
