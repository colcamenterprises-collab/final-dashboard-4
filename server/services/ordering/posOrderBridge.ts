import { pool } from "../../db";

const DISPLAY_TICKET_MAX = 999;
const DISPLAY_TICKET_DIGITS = 3;
let schemaReady: Promise<void> | null = null;

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

function ticketNumber(sequence: number) {
  return String(sequence).padStart(DISPLAY_TICKET_DIGITS, "0");
}

async function ensureBridgeSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS pos_origin_channel TEXT`);
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS pos_routed_at TIMESTAMPTZ`);
    })();
  }
  await schemaReady;
}

function diningType(input: any) {
  const requested = String(input?.dining_type || "").trim().toLowerCase();
  if (["pickup", "delivery", "table", "counter"].includes(requested)) return requested;
  if (input?.table_code) return "table";
  if (input?.channel === "tablet_counter") return "counter";
  return "pickup";
}

export async function prepareOnlineOrderForPos(orderId: string, input: any) {
  await ensureBridgeSchema();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query(`SELECT * FROM ordering_orders WHERE id=$1 FOR UPDATE`, [orderId]);
    const order = orderResult.rows[0];
    if (!order) throw new Error("Online order could not be routed to POS");

    const shiftResult = await client.query(`SELECT id FROM pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
    const shiftId = shiftResult.rows[0]?.id || null;
    const numericOrderNumber = Number(order.order_number || 1);
    const displayTicket = ticketNumber(((numericOrderNumber - 1) % DISPLAY_TICKET_MAX) + 1);
    const storedTicket = `${displayTicket}-${order.id}`;
    const fulfilment = diningType(input);
    const awaitsQrConfirmation = order.payment_method === "manual_qr_transfer";

    const updated = await client.query(
      `UPDATE ordering_orders SET
        pos_origin_channel=COALESCE(pos_origin_channel,channel),
        pos_routed_at=COALESCE(pos_routed_at,NOW()),
        order_mode='direct',
        dining_type=$2,
        pos_shift_id=COALESCE(pos_shift_id,$3),
        ticket_number=COALESCE(ticket_number,$4),
        status=CASE WHEN $5 THEN 'payment_pending' ELSE status END,
        updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [orderId, fulfilment, shiftId, storedTicket, awaitsQrConfirmation],
    );

    await client.query(
      `INSERT INTO pos_order_events(order_id,event_type,payload)
       VALUES($1,'online_order_routed',$2)`,
      [orderId, JSON.stringify({
        ticket_number: displayTicket,
        receipt_number: displayTicket,
        shift_id: shiftId,
        origin_channel: order.channel,
        dining_type: fulfilment,
        payment_method: order.payment_method,
        awaiting_payment_confirmation: awaitsQrConfirmation,
      })],
    );
    await client.query("COMMIT");
    return { ...updated.rows[0], ticket_number: displayTicket, shift_id: shiftId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseOnlineOrderAfterPayment(orderId: string) {
  await ensureBridgeSchema();
  const result = await db().query(
    `UPDATE ordering_orders
     SET status=CASE WHEN status='payment_pending' THEN 'submitted' ELSE status END,
         updated_at=NOW()
     WHERE id=$1 AND pos_origin_channel IS NOT NULL
     RETURNING *`,
    [orderId],
  );
  if (result.rows[0]) {
    await db().query(
      `INSERT INTO pos_order_events(order_id,event_type,payload)
       VALUES($1,'online_payment_confirmed',$2)`,
      [orderId, JSON.stringify({ released_to_kitchen: true })],
    );
  }
  return result.rows[0] || null;
}

export async function finalizeOnlineOrderForPosReporting(orderId: string, status: string) {
  await ensureBridgeSchema();
  if (String(status).toLowerCase() !== "completed") return null;

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT * FROM ordering_orders WHERE id=$1 FOR UPDATE`, [orderId]);
    const current = currentResult.rows[0];
    if (!current || !current.pos_origin_channel) {
      await client.query("COMMIT");
      return null;
    }

    if (["cash", "pay_at_counter"].includes(String(current.payment_method))) {
      await client.query(
        `UPDATE ordering_payments SET status='confirmed',confirmed_by=COALESCE(confirmed_by,'pos_completion'),confirmed_at=COALESCE(confirmed_at,NOW()),updated_at=NOW()
         WHERE order_id=$1 AND status<>'confirmed'`,
        [orderId],
      );
    }

    const updated = await client.query(
      `UPDATE ordering_orders SET
        channel='pos_direct',
        order_mode='direct',
        payment_status=CASE WHEN payment_method IN ('cash','pay_at_counter') THEN 'paid' ELSE payment_status END,
        updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [orderId],
    );

    await client.query(
      `INSERT INTO pos_order_events(order_id,event_type,payload)
       VALUES($1,'online_order_completed',$2)`,
      [orderId, JSON.stringify({
        origin_channel: current.pos_origin_channel,
        dining_type: current.dining_type,
        reporting_channel: "pos_direct",
      })],
    );
    await client.query("COMMIT");
    return updated.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
