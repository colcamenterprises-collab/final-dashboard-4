import { Router } from "express";
import { pool } from "../db";
import { sendDailySalesEmail } from "../services/salesEmail";

const r = Router();

r.get("/", async (req, res) => {
  const { from, to, staff, variance, hasAttach, page="1", pageSize="50" } = req.query as Record<string,string>;
  const q: any[] = [];
  const where: string[] = [];

  if (from) { q.push(from); where.push(`"createdAt"::date >= $${q.length}`); }
  if (to)   { q.push(to);   where.push(`"createdAt"::date <= $${q.length}`); }
  if (staff){ q.push(staff);where.push(`"completedBy" ILIKE '%'||$${q.length}||'%'`); }
  // Skip attachments filter as column doesn't exist in current schema

  const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageN = Math.max(1, parseInt(page)), ps = Math.min(200, Math.max(10, parseInt(pageSize)));
  const off = (pageN-1)*ps;

  const sql = `
    SELECT id, "createdAt", "completedBy", "startingCash", "cashSales", "qrSales", "grabSales", "aroiDeeSales",
           "totalSales", "shoppingExpenses", wages, "totalExpenses", "closingCash", "cashBanked", "qrTransferred", status
    FROM "DailySales"
    ${baseWhere}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${ps} OFFSET ${off};
  `;
  const rows = (await pool.query(sql, q)).rows;

  // compute variance & optionally filter variance-only
  const out = rows.map((r: any) => {
    const sumShopping = Number(r.shoppingExpenses||0);
    const expectedClose = Number(r.startingCash||0) + Number(r.cashSales||0) - sumShopping;
    const variance = Number(r.closingCash||0) - expectedClose;
    return { ...r, variance };
  });
  const filtered = variance==="only" ? out.filter(x => Math.abs(x.variance) > 20) : out;

  res.json({ ok: true, rows: filtered, page: pageN, pageSize: ps });
});

r.get("/:id", async (req, res) => {
  const { id } = req.params;
  const row = (await pool.query(`SELECT * FROM "DailySales" WHERE id=$1`, [id])).rows[0];
  if (!row) return res.status(404).json({ error: "Not found" });
  
  // add computed variance
  const sumShopping = Number(row.shoppingExpenses||0);
  const expectedClose = Number(row.startingCash||0) + Number(row.cashSales||0) - sumShopping;
  const variance = Number(row.closingCash||0) - expectedClose;
  
  res.json({ ok: true, ...row, variance });
});

r.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`DELETE FROM "DailySales" WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Daily sales record not found" });
    }
    res.json({ ok: true, message: "Daily sales record deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily sales record:", error);
    res.status(500).json({ error: "Failed to delete daily sales record" });
  }
});

r.post("/:id/resend-email", async (req, res) => {
  const { id } = req.params;
  const row = (await pool.query(`SELECT * FROM "DailySales" WHERE id=$1`, [id])).rows[0];
  if (!row) return res.status(404).json({ error: "Not found" });
  await sendDailySalesEmail(row);
  res.json({ ok: true });
});

r.post("/:id/lock", async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE "DailySales" SET status='LOCKED' WHERE id=$1`, [id]);
  res.json({ ok: true });
});

r.post("/:id/unlock", async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE "DailySales" SET status='SUBMITTED' WHERE id=$1`, [id]);
  res.json({ ok: true });
});

export default r;