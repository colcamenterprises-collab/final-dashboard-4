// Legacy-named compatibility service. It no longer contacts Loyverse.
// Existing callers are served from the internal SBB POS ledger so old code paths
// cannot accidentally reintroduce Loyverse as a live source of truth.

import { pool } from '../db';

type DateInput = Date | string;
const iso = (value: DateInput) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function mapReceipt(row: any) {
  return {
    id: row.id,
    receiptNumber: row.receipt_number || row.ticket_number || String(row.order_number || ''),
    receiptDate: row.created_at,
    totalAmount: Number(row.total || 0),
    paymentMethod: row.payment_method,
    staffMember: row.staff_name || null,
    tableNumber: null,
    orderMode: row.order_mode,
    items: Array.isArray(row.items) ? row.items : [],
  };
}

export class LoyverseReceiptService {
  async fetchAndStoreReceipts(): Promise<{ success: boolean; receiptsProcessed: number }> {
    console.log('[Loyverse] fetchAndStoreReceipts disabled — SBB POS is source of truth');
    return { success: false, receiptsProcessed: 0 };
  }

  async fetchAndStoreShiftReports(): Promise<{ success: boolean; reportsProcessed: number }> {
    console.log('[Loyverse] fetchAndStoreShiftReports disabled — SBB POS is source of truth');
    return { success: false, reportsProcessed: 0 };
  }

  async getReceiptsByDateRange(start: DateInput, end: DateInput) {
    const result = await pool.query(`
      SELECT o.id, o.order_number, LEFT(o.ticket_number,3) AS receipt_number,
             o.created_at, o.total, o.payment_method, o.order_mode, ps.staff_name,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'name', i.item_name_en,
                 'quantity', i.quantity,
                 'price', i.line_total,
                 'modifiers', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                     'name', m.modifier_name_en,
                     'quantity', m.quantity,
                     'price', m.price_delta
                   ) ORDER BY m.created_at)
                   FROM ordering_order_item_modifiers m
                   WHERE m.order_item_id=i.id
                 ), '[]'::jsonb)
               ) ORDER BY i.sort_order)
               FROM ordering_order_items i WHERE i.order_id=o.id
             ), '[]'::jsonb) AS items
        FROM ordering_orders o
        LEFT JOIN pos_shifts ps ON ps.id=o.pos_shift_id
       WHERE o.created_at >= $1::timestamptz
         AND o.created_at <  $2::timestamptz
         AND o.channel IN ('pos_direct','grab')
         AND o.payment_status='paid'
         AND o.status <> 'cancelled'
       ORDER BY o.created_at DESC`, [iso(start), iso(end)]);
    return result.rows.map(mapReceipt);
  }

  async getReceiptsByShift(shiftId: string) {
    const shift = await pool.query(`SELECT id, opened_at, COALESCE(closed_at,NOW()) AS ended_at FROM pos_shifts WHERE id=$1 LIMIT 1`, [shiftId]);
    if (!shift.rowCount) return [];
    return this.getReceiptsByDateRange(shift.rows[0].opened_at, shift.rows[0].ended_at);
  }

  async getShiftData(which: string | number = 'last') {
    const current = String(which).toLowerCase() === 'current';
    const result = await pool.query(`
      SELECT id, staff_name, opened_at, closed_at, starting_float, closing_cash, cash_banked, status
        FROM pos_shifts
       ${current ? "WHERE status='open'" : "WHERE status='closed'"}
       ORDER BY opened_at DESC LIMIT 1`);
    if (!result.rowCount) throw new Error(`No ${current ? 'current' : 'completed'} SBB POS shift found`);
    return result.rows[0];
  }

  async getLatestShiftReports(limit = 5) {
    const result = await pool.query(`
      SELECT ps.id, ps.staff_name, ps.opened_at, ps.closed_at, ps.starting_float,
             ps.closing_cash, ps.cash_banked, ps.status,
             COUNT(o.id)::int AS receipt_count,
             COALESCE(SUM(o.total),0)::numeric AS total_sales
        FROM pos_shifts ps
        LEFT JOIN ordering_orders o
          ON o.created_at >= ps.opened_at
         AND o.created_at <= COALESCE(ps.closed_at,NOW())
         AND o.channel IN ('pos_direct','grab')
         AND o.payment_status='paid'
         AND o.status <> 'cancelled'
       WHERE ps.status='closed'
       GROUP BY ps.id
       ORDER BY ps.opened_at DESC
       LIMIT $1`, [Math.max(1, Number(limit) || 5)]);
    return result.rows;
  }

  async getAllReceipts() {
    return this.getReceiptsByDateRange(new Date('2020-01-01T00:00:00Z'), new Date());
  }

  async searchReceipts(query: string) {
    const q = `%${String(query || '').trim()}%`;
    const result = await pool.query(`
      SELECT o.id, o.order_number, LEFT(o.ticket_number,3) AS receipt_number,
             o.created_at, o.total, o.payment_method, o.order_mode, ps.staff_name, '[]'::jsonb AS items
        FROM ordering_orders o
        LEFT JOIN pos_shifts ps ON ps.id=o.pos_shift_id
       WHERE o.channel IN ('pos_direct','grab') AND o.payment_status='paid' AND o.status <> 'cancelled'
         AND (o.ticket_number ILIKE $1 OR o.payment_method ILIKE $1 OR o.id::text ILIKE $1)
       ORDER BY o.created_at DESC LIMIT 250`, [q]);
    return result.rows.map(mapReceipt);
  }

  // Old payment-summary callers stay operational, but use internal POS sales.
  async getSalesByPaymentType(start: DateInput, end: DateInput) {
    const result = await pool.query(`
      SELECT payment_method, COUNT(*)::int AS count, COALESCE(SUM(total),0)::numeric AS total
        FROM ordering_orders
       WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
         AND channel IN ('pos_direct','grab') AND payment_status='paid' AND status <> 'cancelled'
       GROUP BY payment_method ORDER BY total DESC`, [iso(start), iso(end)]);
    return result.rows.map(r => ({ paymentMethod: r.payment_method, count: Number(r.count), total: Number(r.total) }));
  }
}

export const loyverseReceiptService = new LoyverseReceiptService();
