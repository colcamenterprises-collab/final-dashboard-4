import { pool } from "../../db";
import { ensureCommercialSchema } from "./commercialService";

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

export async function attachCommercialAttributionToOrder(orderId: string, input: any) {
  await ensureCommercialSchema();
  const source = input?.channel_source === "partner_venue" ? "partner_venue" : "direct";
  const partnerVenueId = source === "partner_venue" ? input?.partner_venue_id || null : null;
  const memberId = input?.member_id || null;
  const qrCodeId = input?.qr_code_id || null;
  const attributionStartedAt = input?.attribution_started_at ? new Date(input.attribution_started_at) : null;

  if (partnerVenueId) {
    const venueResult = await db().query(`SELECT id,address FROM ordering_partner_venues WHERE id=$1 AND is_active=TRUE LIMIT 1`, [partnerVenueId]);
    const venue = venueResult.rows[0];
    if (!venue) throw new Error("Partner venue attribution is invalid or inactive");
    const expiryMs = attributionStartedAt ? attributionStartedAt.getTime() + 12 * 60 * 60 * 1000 : 0;
    if (!attributionStartedAt || !Number.isFinite(expiryMs) || Date.now() > expiryMs) throw new Error("Partner venue attribution has expired");
    input.delivery_address_snapshot = venue.address;
  }

  if (memberId) {
    const memberResult = await db().query(`SELECT id FROM ordering_members WHERE id=$1 AND status='active' LIMIT 1`, [memberId]);
    if (!memberResult.rows[0]) throw new Error("Membership is invalid or inactive");
  }

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
    source,
    partnerVenueId,
    memberId,
    qrCodeId,
    input?.delivery_address_snapshot || null,
    attributionStartedAt,
    Number(input?.delivery_fee_standard || 0),
    Number(input?.delivery_fee_charged || 0),
  ]);
  return result.rows[0];
}
