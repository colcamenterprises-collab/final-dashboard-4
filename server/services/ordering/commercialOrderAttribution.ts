import { pool } from "../../db";
import { ensureCommercialSchema } from "./commercialService";

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

function numeric(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function settingValue(rows: any[], key: string, fallback: any = null) {
  const row = rows.find((item) => item.key === key);
  if (!row) return fallback;
  return row.value;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ensureDirectDeliveryColumns() {
  await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10,7)`);
  await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7)`);
  await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC(10,3)`);
  await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS delivery_in_service_area BOOLEAN`);
}

export async function validateCommercialOrderInput(input: any) {
  await ensureCommercialSchema();
  await ensureDirectDeliveryColumns();

  const settingsResult = await db().query(`SELECT key,value FROM ordering_settings WHERE key IN ('delivery_enabled','restaurant_latitude','restaurant_longitude','delivery_radius_km','standard_delivery_fee','delivery_fee_charged')`);
  const settings = settingsResult.rows;
  const deliveryEnabled = settingValue(settings, "delivery_enabled", true) !== false;
  const restaurantLatitude = numeric(settingValue(settings, "restaurant_latitude"));
  const restaurantLongitude = numeric(settingValue(settings, "restaurant_longitude"));
  const deliveryRadiusKm = numeric(settingValue(settings, "delivery_radius_km"));
  const standardDeliveryFee = numeric(settingValue(settings, "standard_delivery_fee", input?.delivery_fee_standard || 0)) || 0;
  const chargedDeliveryFee = numeric(settingValue(settings, "delivery_fee_charged", input?.delivery_fee_charged || 0)) || 0;

  const source = input?.channel_source === "partner_venue" ? "partner_venue" : "direct";
  const normalized: any = {
    channel_source: source,
    partner_venue_id: null,
    member_id: input?.member_id || null,
    qr_code_id: input?.qr_code_id || null,
    attribution_started_at: input?.attribution_started_at || null,
    delivery_address_snapshot: input?.delivery_address_snapshot || null,
    delivery_latitude: numeric(input?.delivery_latitude),
    delivery_longitude: numeric(input?.delivery_longitude),
    delivery_distance_km: null,
    delivery_in_service_area: null,
    delivery_fee_standard: standardDeliveryFee,
    delivery_fee_charged: chargedDeliveryFee,
  };

  if (source === "partner_venue") {
    const partnerVenueId = input?.partner_venue_id || null;
    if (!partnerVenueId) throw new Error("Partner venue attribution is missing the venue ID");
    const started = input?.attribution_started_at ? new Date(input.attribution_started_at) : null;
    const expiryMs = started ? started.getTime() + 12 * 60 * 60 * 1000 : 0;
    if (!started || !Number.isFinite(expiryMs) || Date.now() > expiryMs) throw new Error("Partner venue attribution has expired");
    const venueResult = await db().query(`SELECT id,address,latitude,longitude FROM ordering_partner_venues WHERE id=$1 AND is_active=TRUE LIMIT 1`, [partnerVenueId]);
    const venue = venueResult.rows[0];
    if (!venue) throw new Error("Partner venue attribution is invalid or inactive");
    normalized.partner_venue_id = venue.id;
    normalized.delivery_address_snapshot = venue.address;
    normalized.delivery_latitude = numeric(venue.latitude);
    normalized.delivery_longitude = numeric(venue.longitude);
    normalized.delivery_in_service_area = true;
    normalized.attribution_started_at = started.toISOString();
  } else if (normalized.delivery_address_snapshot) {
    if (!deliveryEnabled) throw new Error("Direct delivery is currently unavailable. Please choose pickup.");
    if (restaurantLatitude == null || restaurantLongitude == null || deliveryRadiusKm == null || deliveryRadiusKm <= 0) {
      throw new Error("Direct delivery map is not configured. Please choose pickup or contact the restaurant.");
    }
    if (normalized.delivery_latitude == null || normalized.delivery_longitude == null) {
      throw new Error("Please choose your delivery location on the map.");
    }
    const distance = haversineKm(restaurantLatitude, restaurantLongitude, normalized.delivery_latitude, normalized.delivery_longitude);
    normalized.delivery_distance_km = Number(distance.toFixed(3));
    normalized.delivery_in_service_area = distance <= deliveryRadiusKm;
    if (!normalized.delivery_in_service_area) {
      throw new Error(`This delivery location is ${distance.toFixed(2)} km from the restaurant. Direct delivery is available within ${deliveryRadiusKm.toFixed(1)} km.`);
    }
  }

  if (normalized.member_id) {
    const memberResult = await db().query(`SELECT id FROM ordering_members WHERE id=$1 AND status='active' LIMIT 1`, [normalized.member_id]);
    if (!memberResult.rows[0]) throw new Error("Membership is invalid or inactive");
  }

  return normalized;
}

export async function attachCommercialAttributionToOrder(orderId: string, normalized: any) {
  await ensureCommercialSchema();
  await ensureDirectDeliveryColumns();
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
      delivery_latitude=$10,
      delivery_longitude=$11,
      delivery_distance_km=$12,
      delivery_in_service_area=$13,
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
    normalized?.delivery_latitude ?? null,
    normalized?.delivery_longitude ?? null,
    normalized?.delivery_distance_km ?? null,
    normalized?.delivery_in_service_area ?? null,
  ]);
  if (!result.rows[0]) throw new Error("Order attribution could not be saved");
  return result.rows[0];
}
