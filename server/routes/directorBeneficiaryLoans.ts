import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db";
import { getPinSessionUser } from "./pinAuth";

const router = Router();

function database() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

function requireOwner(req: any, res: any) {
  const user = getPinSessionUser(req);
  if (!user || user.role !== "owner") {
    res.status(403).json({ ok: false, error: "Owner access required" });
    return false;
  }
  return true;
}

async function ensureTable() {
  await database().query(`
    CREATE TABLE IF NOT EXISTS director_beneficiary_loans (
      id UUID PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      payment_required_date DATE,
      payment_terms TEXT,
      balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

router.use((req, res, next) => {
  if (!requireOwner(req, res)) return;
  next();
});

router.get("/", async (_req, res) => {
  try {
    await ensureTable();
    const result = await database().query(`SELECT * FROM director_beneficiary_loans ORDER BY payment_required_date NULLS LAST, created_at DESC`);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to load loans" });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    await ensureTable();
    const result = await database().query(`SELECT COALESCE(SUM(amount),0) AS total_amount, COALESCE(SUM(balance),0) AS total_balance FROM director_beneficiary_loans`);
    res.json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to load loan liabilities" });
  }
});

router.post("/", async (req, res) => {
  try {
    await ensureTable();
    const amount = Number(req.body?.amount);
    const balance = req.body?.balance === "" || req.body?.balance == null ? amount : Number(req.body.balance);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({ ok: false, error: "Amount and balance must be valid non-negative numbers" });
    }
    const result = await database().query(`
      INSERT INTO director_beneficiary_loans (id,amount,payment_required_date,payment_terms,balance)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `,[crypto.randomUUID(), amount, req.body?.payment_required_date || null, String(req.body?.payment_terms || "").trim() || null, balance]);
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to create loan" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    await ensureTable();
    const amount = Number(req.body?.amount);
    const balance = Number(req.body?.balance);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({ ok: false, error: "Amount and balance must be valid non-negative numbers" });
    }
    const result = await database().query(`
      UPDATE director_beneficiary_loans
      SET amount=$2,payment_required_date=$3,payment_terms=$4,balance=$5,updated_at=NOW()
      WHERE id=$1 RETURNING *
    `,[req.params.id, amount, req.body?.payment_required_date || null, String(req.body?.payment_terms || "").trim() || null, balance]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, error: "Loan not found" });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to update loan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    await database().query(`DELETE FROM director_beneficiary_loans WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to delete loan" });
  }
});

export default router;
