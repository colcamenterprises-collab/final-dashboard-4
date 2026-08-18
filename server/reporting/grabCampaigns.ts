import { pool } from "../db";

export type GrabCampaign = {
  id: string;
  name: string;
  itemNameMatch: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  notes: string | null;
};

function db() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

function map(row: any): GrabCampaign {
  return {
    id: String(row.id),
    name: String(row.name),
    itemNameMatch: String(row.item_name_match),
    discountType: row.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: Number(row.discount_value || 0),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    active: row.active !== false,
    notes: row.notes ?? null,
  };
}

export async function listGrabCampaigns() {
  const result = await db().query(`
    SELECT *
    FROM reporting_grab_campaigns
    ORDER BY active DESC, starts_at DESC, name
  `);
  return result.rows.map(map);
}

export async function createGrabCampaign(input: any) {
  const name = String(input?.name || "").trim();
  const itemNameMatch = String(input?.itemNameMatch || "").trim();
  const discountType = input?.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = Number(input?.discountValue);
  const startsAt = new Date(input?.startsAt);
  const endsAt = new Date(input?.endsAt);
  if (!name || !itemNameMatch) throw new Error("Campaign name and item match are required");
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === "percent" && discountValue > 100)) throw new Error("Enter a valid campaign discount");
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Enter a valid campaign start and end time");
  const result = await db().query(`
    INSERT INTO reporting_grab_campaigns(name,item_name_match,discount_type,discount_value,starts_at,ends_at,active,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [name, itemNameMatch, discountType, discountValue, startsAt.toISOString(), endsAt.toISOString(), input?.active !== false, String(input?.notes || "").trim() || null]);
  return map(result.rows[0]);
}

export async function updateGrabCampaign(id: string, input: any) {
  const current = (await db().query(`SELECT * FROM reporting_grab_campaigns WHERE id=$1`, [id])).rows[0];
  if (!current) throw new Error("Grab campaign not found");
  const name = input?.name === undefined ? current.name : String(input.name).trim();
  const itemNameMatch = input?.itemNameMatch === undefined ? current.item_name_match : String(input.itemNameMatch).trim();
  const discountType = input?.discountType === undefined ? current.discount_type : input.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = input?.discountValue === undefined ? Number(current.discount_value) : Number(input.discountValue);
  const startsAt = input?.startsAt === undefined ? new Date(current.starts_at) : new Date(input.startsAt);
  const endsAt = input?.endsAt === undefined ? new Date(current.ends_at) : new Date(input.endsAt);
  const active = input?.active === undefined ? current.active : Boolean(input.active);
  const notes = input?.notes === undefined ? current.notes : String(input.notes || "").trim() || null;
  if (!name || !itemNameMatch) throw new Error("Campaign name and item match are required");
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === "percent" && discountValue > 100)) throw new Error("Enter a valid campaign discount");
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Enter a valid campaign start and end time");
  const result = await db().query(`
    UPDATE reporting_grab_campaigns SET
      name=$2,item_name_match=$3,discount_type=$4,discount_value=$5,
      starts_at=$6,ends_at=$7,active=$8,notes=$9,updated_at=NOW()
    WHERE id=$1 RETURNING *
  `, [id, name, itemNameMatch, discountType, discountValue, startsAt.toISOString(), endsAt.toISOString(), active, notes]);
  return map(result.rows[0]);
}

export async function deleteGrabCampaign(id: string) {
  const result = await db().query(`DELETE FROM reporting_grab_campaigns WHERE id=$1 RETURNING id`, [id]);
  if (!result.rows[0]) throw new Error("Grab campaign not found");
  return { id: String(result.rows[0].id) };
}
