#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path('server/routes/pos.ts')
if not path.exists():
    sys.exit('ERROR: Run this from the SBB repository root; server/routes/pos.ts was not found.')

src = path.read_text()
original = src

# 1) Preserve existing product images unless image_url is explicitly supplied.
old = '''router.patch("/catalog/items/:id", staffDevice, async (req, res) => {
  const { category_id, name_en, description_en, price, direct_price, grab_price, image_url, is_active, is_sold_out, pos_enabled, sort_order } = req.body || {};
  try {
    const updated = await db().query(
      `UPDATE ordering_menu_items SET
        category_id=COALESCE($2, category_id), name_en=COALESCE($3, name_en), description_en=$4,
        price=COALESCE($5, price), direct_price=COALESCE($6, direct_price), grab_price=COALESCE($7, grab_price),
        image_url=$8, is_active=COALESCE($9, is_active), is_sold_out=COALESCE($10, is_sold_out),
        pos_enabled=COALESCE($11, pos_enabled), sort_order=COALESCE($12, sort_order), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, category_id || null, name_en?.trim() || null, description_en || null, price === undefined ? null : Number(price), direct_price === undefined ? null : Number(direct_price), grab_price === undefined ? null : Number(grab_price), image_url || null, typeof is_active === "boolean" ? is_active : null, typeof is_sold_out === "boolean" ? is_sold_out : null, typeof pos_enabled === "boolean" ? pos_enabled : null, sort_order === undefined ? null : Number(sort_order)],
    );'''
new = '''router.patch("/catalog/items/:id", staffDevice, async (req, res) => {
  const { category_id, name_en, description_en, price, direct_price, grab_price, image_url, is_active, is_sold_out, pos_enabled, sort_order } = req.body || {};
  const imageWasSupplied = Object.prototype.hasOwnProperty.call(req.body || {}, "image_url");
  try {
    const updated = await db().query(
      `UPDATE ordering_menu_items SET
        category_id=COALESCE($2, category_id), name_en=COALESCE($3, name_en), description_en=$4,
        price=COALESCE($5, price), direct_price=COALESCE($6, direct_price), grab_price=COALESCE($7, grab_price),
        image_url=CASE WHEN $8::boolean THEN $9 ELSE image_url END,
        is_active=COALESCE($10, is_active), is_sold_out=COALESCE($11, is_sold_out),
        pos_enabled=COALESCE($12, pos_enabled), sort_order=COALESCE($13, sort_order), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, category_id || null, name_en?.trim() || null, description_en || null, price === undefined ? null : Number(price), direct_price === undefined ? null : Number(direct_price), grab_price === undefined ? null : Number(grab_price), imageWasSupplied, imageWasSupplied ? (image_url || null) : null, typeof is_active === "boolean" ? is_active : null, typeof is_sold_out === "boolean" ? is_sold_out : null, typeof pos_enabled === "boolean" ? pos_enabled : null, sort_order === undefined ? null : Number(sort_order)],
    );'''
if old not in src:
    sys.exit('ERROR: Product image update block did not match. No changes were written.')
src = src.replace(old, new, 1)

# 2) Replace POS reconciliation: no custom-POS refunds; cancelled tickets excluded from sales.
old_start = 'router.get("/receipts/reconciliation", staffDevice, async (req, res) => {'
old_end = '\nrouter.get("/kitchen/orders", staffDevice, async (_req, res) => {'
start = src.find(old_start)
end = src.find(old_end, start)
if start < 0 or end < 0:
    sys.exit('ERROR: Reconciliation route boundaries were not found. No changes were written.')
new_block = '''router.get("/receipts/reconciliation", staffDevice, async (req, res) => {
  const shiftDate = String(req.query.shift_date || "");
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(shiftDate))
    return fail(res, "shift_date must be YYYY-MM-DD");
  try {
    const result = await db().query(
      `SELECT id, order_number, ticket_number, status, payment_status,
              payment_method, subtotal, discount_amount, total, created_at
       FROM ordering_orders
       WHERE channel IN ('pos_direct','grab')
         AND created_at >= (($1::date + time '17:00') AT TIME ZONE 'Asia/Bangkok')
         AND created_at < ((($1::date + 1) + time '03:00') AT TIME ZONE 'Asia/Bangkok')
       ORDER BY order_number`,
      [shiftDate],
    );
    const rows = result.rows;
    const issuedNumbers = rows.map((row) => Number(row.order_number)).filter(Number.isFinite);
    const first = issuedNumbers.length ? Math.min(...issuedNumbers) : null;
    const last = issuedNumbers.length ? Math.max(...issuedNumbers) : null;
    const present = new Set(issuedNumbers);
    const missing: string[] = [];
    if (first !== null && last !== null) {
      for (let n = first; n <= last; n += 1) {
        if (!present.has(n)) missing.push(receiptNumber(n, `${shiftDate}T17:00:00+07:00`));
      }
    }

    const voided = rows.filter((row) => row.status === "cancelled");
    const saleRows = rows.filter((row) => row.status !== "cancelled");
    const completedRows = rows.filter((row) => row.status === "completed");
    const paymentTotals = saleRows.reduce<Record<string, number>>((totals, row) => {
      const method = String(row.payment_method || "other").toLowerCase();
      const key = ["cash", "qr", "grab"].includes(method) ? method : "other";
      totals[key] = (totals[key] || 0) + value(row.total);
      return totals;
    }, { cash: 0, qr: 0, grab: 0, other: 0 });

    const grossSales = saleRows.reduce((sum, row) => sum + value(row.subtotal ?? row.total), 0);
    const discountTotal = saleRows.reduce((sum, row) => sum + value(row.discount_amount), 0);
    const netSales = saleRows.reduce((sum, row) => sum + value(row.total), 0);

    res.json({
      ok: true,
      source: "sbb_pos_core",
      data: {
        shift_date: shiftDate,
        first_receipt: rows[0]?.ticket_number || null,
        last_receipt: rows.at(-1)?.ticket_number || null,
        issued_count: rows.length,
        completed_count: completedRows.length,
        active_count: saleRows.length - completedRows.length,
        expected_count: first === null || last === null ? 0 : last - first + 1,
        missing_receipts: missing,
        voided_count: voided.length,
        gross_sales: grossSales,
        discount_total: discountTotal,
        net_sales: netSales,
        payment_totals: paymentTotals,
        total: netSales,
        receipts: rows,
      },
    });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});
'''
src = src[:start] + new_block + src[end:]

# 3) Ticket display must return order id for individual clearing.
old = '''`SELECT ticket_number, status, updated_at
       FROM ordering_orders'''
new = '''`SELECT id, ticket_number, status, updated_at
       FROM ordering_orders'''
if old not in src:
    sys.exit('ERROR: Ticket display SELECT block did not match. No changes were written.')
src = src.replace(old, new, 1)

# 4) Add individual and bulk clear routes with permanent audit events.
anchor = '\nrouter.patch("/orders/:id/status", staffDevice, async (req, res) => {'
idx = src.find(anchor)
if idx < 0:
    sys.exit('ERROR: Status route anchor was not found. No changes were written.')
clear_routes = '''
router.post("/display/orders/:id/clear", staffDevice, async (req, res) => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const row = (
      await client.query(
        `UPDATE ordering_orders SET status='completed', updated_at=NOW()
         WHERE id=$1 AND status='ready'
         RETURNING id, ticket_number, status, updated_at`,
        [req.params.id],
      )
    ).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return fail(res, "Ready ticket not found or already cleared", 409);
    }
    await client.query(
      `INSERT INTO pos_order_events(order_id, event_type, payload)
       VALUES($1,'ticket_cleared',$2)`,
      [row.id, JSON.stringify({ ticket_number: row.ticket_number, clear_mode: "individual" })],
    );
    await client.query("COMMIT");
    res.json({ ok: true, source: "sbb_pos_core", data: row });
  } catch (e: any) {
    await client.query("ROLLBACK");
    fail(res, e.message, 500);
  } finally {
    client.release();
  }
});

router.post("/display/orders/clear", staffDevice, async (_req, res) => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const cleared = await client.query(
      `UPDATE ordering_orders SET status='completed', updated_at=NOW()
       WHERE channel IN ('pos_direct','grab') AND status='ready'
       RETURNING id, ticket_number, status, updated_at`,
    );
    for (const row of cleared.rows) {
      await client.query(
        `INSERT INTO pos_order_events(order_id, event_type, payload)
         VALUES($1,'ticket_cleared',$2)`,
        [row.id, JSON.stringify({ ticket_number: row.ticket_number, clear_mode: "bulk" })],
      );
    }
    await client.query("COMMIT");
    res.json({
      ok: true,
      source: "sbb_pos_core",
      data: { cleared_count: cleared.rowCount || 0, tickets: cleared.rows },
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    fail(res, e.message, 500);
  } finally {
    client.release();
  }
});
'''
src = src[:idx] + clear_routes + src[idx:]

if src == original:
    sys.exit('ERROR: Nothing changed.')

backup = path.with_suffix('.ts.pre-p0-backup')
backup.write_text(original)
path.write_text(src)
print(f'PATCHED: {path}')
print(f'BACKUP:  {backup}')
print('Added: correct POS reconciliation, safe image updates, individual/bulk ticket clearing, and audit events.')
