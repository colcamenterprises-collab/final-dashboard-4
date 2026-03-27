/**
 * Issue Register — Theft Control & Shift Accountability
 * Routes mounted at /api/issue-register
 *
 * Provides CRUD for issue_register table and auto-creation
 * from existing reconciliation / theft-control signals.
 * Does NOT change any calculation logic.
 */

import { Router } from "express";
import { pool } from "../db";
import { getUsageReconciliation } from "./analysis/usageReconciliation";

const router = Router();
const TAG = "[issueRegister]";

// ─── Table bootstrap ────────────────────────────────────────────────────────
async function ensureTable(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issue_register (
      id               SERIAL PRIMARY KEY,
      shift_date       DATE NOT NULL,
      issue_type       TEXT NOT NULL,
      category         TEXT NOT NULL,
      severity         TEXT NOT NULL DEFAULT 'MEDIUM',
      title            TEXT NOT NULL,
      description      TEXT,
      detected_by      TEXT NOT NULL DEFAULT 'SYSTEM',
      source_page      TEXT,
      source_ref       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'OPEN',
      assigned_to      TEXT,
      resolution_notes TEXT,
      metadata_json    JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at      TIMESTAMPTZ,
      closed_at        TIMESTAMPTZ,
      CONSTRAINT issue_register_dedupe UNIQUE (shift_date, issue_type, source_ref)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ir_shift_date_idx ON issue_register (shift_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ir_status_idx    ON issue_register (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ir_severity_idx  ON issue_register (severity)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ir_category_idx  ON issue_register (category)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ir_type_idx      ON issue_register (issue_type)`);
}

// Ensure table exists at startup (best-effort)
ensureTable().catch((e) => console.error(`${TAG} Table init failed:`, e.message));

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status   = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const VALID_STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  OPEN:        ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED:    ["CLOSED", "OPEN"],
  CLOSED:      [],
};

interface UpsertIssue {
  shift_date: string;
  issue_type: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  detected_by?: string;
  source_page?: string;
  source_ref: string;
  metadata_json?: Record<string, unknown>;
}

async function upsertIssue(issue: UpsertIssue): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO issue_register
       (shift_date, issue_type, category, severity, title, description,
        detected_by, source_page, source_ref, status, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10)
     ON CONFLICT (shift_date, issue_type, source_ref) DO UPDATE SET
       severity      = EXCLUDED.severity,
       title         = EXCLUDED.title,
       description   = EXCLUDED.description,
       metadata_json = EXCLUDED.metadata_json,
       updated_at    = NOW()
     WHERE issue_register.status = 'OPEN'`,
    [
      issue.shift_date,
      issue.issue_type,
      issue.category,
      issue.severity,
      issue.title,
      issue.description,
      issue.detected_by ?? "SYSTEM",
      issue.source_page ?? "Sales & Shift Analysis",
      issue.source_ref,
      issue.metadata_json ? JSON.stringify(issue.metadata_json) : null,
    ]
  );
}

// ─── GET /api/issue-register ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  await ensureTable();

  const { shiftDate, status, severity, category, issueType, search } = req.query;

  const where: string[] = [];
  const params: unknown[] = [];

  if (shiftDate && /^\d{4}-\d{2}-\d{2}$/.test(String(shiftDate))) {
    params.push(shiftDate);
    where.push(`shift_date = $${params.length}::date`);
  }
  if (status) {
    params.push(String(status).toUpperCase());
    where.push(`status = $${params.length}`);
  }
  if (severity) {
    params.push(String(severity).toUpperCase());
    where.push(`severity = $${params.length}`);
  }
  if (category) {
    params.push(String(category).toUpperCase());
    where.push(`category = $${params.length}`);
  }
  if (issueType) {
    params.push(String(issueType).toUpperCase());
    where.push(`issue_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT id, shift_date::text, issue_type, category, severity, title, description,
              detected_by, source_page, source_ref, status, assigned_to,
              resolution_notes, metadata_json,
              created_at::text, updated_at::text, resolved_at::text, closed_at::text
       FROM issue_register
       ${whereClause}
       ORDER BY
         CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         shift_date DESC,
         created_at DESC
       LIMIT 500`,
      params
    );

    // Summary counts
    const countResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='OPEN')        AS open_count,
         COUNT(*) FILTER (WHERE status='IN_PROGRESS') AS in_progress_count,
         COUNT(*) FILTER (WHERE status='RESOLVED')    AS resolved_count,
         COUNT(*) FILTER (WHERE status='CLOSED')      AS closed_count,
         COUNT(*) FILTER (WHERE severity='CRITICAL')  AS critical_count,
         COUNT(*)                                     AS total_count
       FROM issue_register
       ${whereClause}`,
      params
    );

    res.json({ ok: true, issues: result.rows, summary: countResult.rows[0] });
  } catch (e: any) {
    console.error(`${TAG} GET / error:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/issue-register/by-shift/:date ───────────────────────────────────
router.get("/by-shift/:date", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  await ensureTable();

  try {
    const result = await pool.query(
      `SELECT id, shift_date::text, issue_type, category, severity, title,
              status, assigned_to, created_at::text
       FROM issue_register
       WHERE shift_date = $1::date
       ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                created_at DESC`,
      [date]
    );

    const rows = result.rows;
    const openCount = rows.filter(r => r.status === "OPEN").length;
    const criticalCount = rows.filter(r => r.severity === "CRITICAL").length;

    res.json({ ok: true, date, issues: rows, openCount, criticalCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/issue-register/:id ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    const result = await pool.query(
      `SELECT id, shift_date::text, issue_type, category, severity, title, description,
              detected_by, source_page, source_ref, status, assigned_to,
              resolution_notes, metadata_json,
              created_at::text, updated_at::text, resolved_at::text, closed_at::text
       FROM issue_register WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, issue: result.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/issue-register — manual creation ───────────────────────────────
router.post("/", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  await ensureTable();

  const {
    shift_date, issue_type, category = "SYSTEM", severity = "MEDIUM",
    title, description, detected_by = "MANUAL", source_page, source_ref,
    assigned_to, metadata_json
  } = req.body;

  if (!shift_date || !issue_type || !title || !source_ref) {
    return res.status(400).json({ error: "shift_date, issue_type, title, source_ref required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shift_date)) {
    return res.status(400).json({ error: "shift_date must be YYYY-MM-DD" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO issue_register
         (shift_date, issue_type, category, severity, title, description,
          detected_by, source_page, source_ref, status, assigned_to, metadata_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10,$11)
       ON CONFLICT (shift_date, issue_type, source_ref) DO UPDATE SET
         updated_at = NOW()
       RETURNING id, shift_date::text, issue_type, category, severity, title,
                 status, created_at::text`,
      [
        shift_date, issue_type.toUpperCase(), category.toUpperCase(),
        severity.toUpperCase(), title, description ?? null,
        detected_by, source_page ?? null, source_ref,
        assigned_to ?? null,
        metadata_json ? JSON.stringify(metadata_json) : null,
      ]
    );
    res.status(201).json({ ok: true, issue: result.rows[0] });
  } catch (e: any) {
    console.error(`${TAG} POST / error:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/issue-register/:id ───────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const {
    status, assigned_to, resolution_notes, severity, title, description
  } = req.body;

  const current = await pool.query(
    `SELECT status FROM issue_register WHERE id = $1`, [id]
  );
  if (!current.rows.length) return res.status(404).json({ error: "Not found" });

  const currentStatus = current.rows[0].status as Status;

  if (status) {
    const newStatus = String(status).toUpperCase() as Status;
    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    if (!STATUS_TRANSITIONS[currentStatus].includes(newStatus)) {
      return res.status(409).json({
        error: `Cannot transition from ${currentStatus} to ${newStatus}`
      });
    }
  }

  const newStatus = status ? String(status).toUpperCase() : currentStatus;
  const now = new Date().toISOString();

  try {
    const result = await pool.query(
      `UPDATE issue_register SET
         status           = $2,
         assigned_to      = COALESCE($3, assigned_to),
         resolution_notes = COALESCE($4, resolution_notes),
         severity         = COALESCE($5, severity),
         title            = COALESCE($6, title),
         description      = COALESCE($7, description),
         updated_at       = NOW(),
         resolved_at      = CASE WHEN $2 = 'RESOLVED' AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
         closed_at        = CASE WHEN $2 = 'CLOSED'   AND closed_at   IS NULL THEN NOW() ELSE closed_at   END
       WHERE id = $1
       RETURNING id, shift_date::text, issue_type, category, severity, title, description,
                 detected_by, source_page, source_ref, status, assigned_to,
                 resolution_notes, metadata_json,
                 created_at::text, updated_at::text, resolved_at::text, closed_at::text`,
      [
        id, newStatus,
        assigned_to ?? null,
        resolution_notes ?? null,
        severity ? String(severity).toUpperCase() : null,
        title ?? null,
        description ?? null,
      ]
    );
    res.json({ ok: true, issue: result.rows[0] });
  } catch (e: any) {
    console.error(`${TAG} PATCH /:id error:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/issue-register/auto-create ────────────────────────────────────
// Reads existing reconciliation data — does NOT change any calculations.
router.post("/auto-create", async (req, res) => {
  const { date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date (YYYY-MM-DD) required" });
  }
  if (!pool) return res.status(503).json({ error: "Database unavailable" });
  await ensureTable();

  const created: string[] = [];
  const skipped: string[] = [];

  try {
    // ── 1. Usage reconciliation signals ──────────────────────────────────────
    const recon = await getUsageReconciliation(date);

    // 1a. Missing usage build
    if (!recon.engineBuilt) {
      await upsertIssue({
        shift_date: date,
        issue_type: "MISSING_USAGE_BUILD",
        category: "SYSTEM",
        severity: "CRITICAL",
        title: `Usage engine not built for ${date}`,
        description: `Receipt truth daily usage has not been built for ${date}. Stock reconciliation cannot proceed without this. Rebuild via Sales & Shift Analysis → Rebuild.`,
        source_ref: `MISSING_USAGE_BUILD::${date}`,
        metadata_json: { date, engineRowCount: recon.confidence.engineRowCount },
      });
      created.push("MISSING_USAGE_BUILD");
    } else {
      skipped.push("MISSING_USAGE_BUILD (engine built)");
    }

    // 1b. Buns variance
    if (recon.buns.variance !== null && Math.abs(recon.buns.variance) > 5) {
      const sev: Severity = Math.abs(recon.buns.variance) > 10 ? "CRITICAL" : "HIGH";
      const v = recon.buns.variance;
      await upsertIssue({
        shift_date: date,
        issue_type: "BUNS_VARIANCE",
        category: "STOCK",
        severity: sev,
        title: `Buns variance ${v > 0 ? "+" : ""}${v} for ${date}`,
        description: `Physical buns used (${recon.buns.physicalUsed}) differs from expected (${recon.buns.expected}) by ${v} buns. Threshold: warn >5, critical >10.`,
        source_ref: `BUNS_VARIANCE::${date}`,
        metadata_json: {
          variance: recon.buns.variance,
          expected: recon.buns.expected,
          physicalUsed: recon.buns.physicalUsed,
          opening: recon.buns.opening,
          received: recon.buns.received,
          closing: recon.buns.closing,
        },
      });
      created.push("BUNS_VARIANCE");
    } else {
      skipped.push("BUNS_VARIANCE (within threshold or unknown)");
    }

    // 1c. Meat variance
    if (recon.meat.varianceGrams !== null && Math.abs(recon.meat.varianceGrams) > 500) {
      const sev: Severity = Math.abs(recon.meat.varianceGrams) > 1000 ? "CRITICAL" : "HIGH";
      const v = recon.meat.varianceGrams;
      await upsertIssue({
        shift_date: date,
        issue_type: "MEAT_VARIANCE",
        category: "STOCK",
        severity: sev,
        title: `Meat variance ${v > 0 ? "+" : ""}${v}g for ${date}`,
        description: `Physical meat used (${recon.meat.physicalUsedGrams}g) differs from expected (${recon.meat.expectedGrams}g) by ${v}g. Threshold: warn >500g, critical >1000g.`,
        source_ref: `MEAT_VARIANCE::${date}`,
        metadata_json: {
          varianceGrams: recon.meat.varianceGrams,
          expectedGrams: recon.meat.expectedGrams,
          physicalUsedGrams: recon.meat.physicalUsedGrams,
          openingGrams: recon.meat.openingGrams,
          receivedGrams: recon.meat.receivedGrams,
          closingGrams: recon.meat.closingGrams,
        },
      });
      created.push("MEAT_VARIANCE");
    } else {
      skipped.push("MEAT_VARIANCE (within threshold or unknown)");
    }

    // 1d. Drink variance per type
    for (const row of recon.drinks.rows) {
      if (row.variance !== null && Math.abs(row.variance) > 2) {
        const sev: Severity = Math.abs(row.variance) > 4 ? "CRITICAL" : "HIGH";
        const v = row.variance;
        await upsertIssue({
          shift_date: date,
          issue_type: "DRINK_VARIANCE",
          category: "STOCK",
          severity: sev,
          title: `${row.label} variance ${v > 0 ? "+" : ""}${v} for ${date}`,
          description: `Physical ${row.label} used (${row.physicalUsed}) differs from expected (${row.expected}) by ${v}. Threshold: warn >2, critical >4.`,
          source_ref: `DRINK_VARIANCE::${row.field}::${date}`,
          metadata_json: {
            drinkField: row.field,
            drinkLabel: row.label,
            variance: row.variance,
            expected: row.expected,
            physicalUsed: row.physicalUsed,
            opening: row.opening,
            received: row.received,
            closing: row.closing,
          },
        });
        created.push(`DRINK_VARIANCE:${row.label}`);
      } else {
        skipped.push(`DRINK_VARIANCE:${row.label} (within threshold or unknown)`);
      }
    }

    // 1e. Invalid stock inputs (physicalUsed < 0 = impossible)
    if (recon.buns.physicalUsed !== null && recon.buns.physicalUsed < 0) {
      await upsertIssue({
        shift_date: date,
        issue_type: "INVALID_STOCK_INPUT",
        category: "DATA",
        severity: "HIGH",
        title: `Invalid buns stock count for ${date} — negative physical usage`,
        description: `Buns physical usage is ${recon.buns.physicalUsed}, which is impossible. Check opening (${recon.buns.opening}), received (${recon.buns.received}), and closing (${recon.buns.closing}) counts.`,
        source_ref: `INVALID_STOCK_INPUT::buns::${date}`,
        metadata_json: { field: "buns", physicalUsed: recon.buns.physicalUsed, opening: recon.buns.opening, received: recon.buns.received, closing: recon.buns.closing },
      });
      created.push("INVALID_STOCK_INPUT:buns");
    }
    if (recon.meat.physicalUsedGrams !== null && recon.meat.physicalUsedGrams < 0) {
      await upsertIssue({
        shift_date: date,
        issue_type: "INVALID_STOCK_INPUT",
        category: "DATA",
        severity: "HIGH",
        title: `Invalid meat stock count for ${date} — negative physical usage`,
        description: `Meat physical usage is ${recon.meat.physicalUsedGrams}g, which is impossible. Check opening (${recon.meat.openingGrams}g), received (${recon.meat.receivedGrams}g), and closing (${recon.meat.closingGrams}g) counts.`,
        source_ref: `INVALID_STOCK_INPUT::meat::${date}`,
        metadata_json: { field: "meat", physicalUsedGrams: recon.meat.physicalUsedGrams },
      });
      created.push("INVALID_STOCK_INPUT:meat");
    }
    for (const row of recon.drinks.rows) {
      if (row.physicalUsed !== null && row.physicalUsed < 0) {
        await upsertIssue({
          shift_date: date,
          issue_type: "INVALID_STOCK_INPUT",
          category: "DATA",
          severity: "HIGH",
          title: `Invalid ${row.label} stock count for ${date} — negative physical usage`,
          description: `${row.label} physical usage is ${row.physicalUsed}, which is impossible. Check counts.`,
          source_ref: `INVALID_STOCK_INPUT::${row.field}::${date}`,
          metadata_json: { field: row.field, physicalUsed: row.physicalUsed, opening: row.opening, received: row.received, closing: row.closing },
        });
        created.push(`INVALID_STOCK_INPUT:${row.label}`);
      }
    }

    // ── 2. POS vs Form mismatch ────────────────────────────────────────────
    try {
      const posResult = await pool.query(
        `SELECT ROUND(SUM(CASE WHEN receipt_type='SALE' THEN COALESCE(net_amount,0) ELSE 0 END)::numeric, 2) AS pos_total
         FROM receipt_truth_line WHERE receipt_date=$1::date`,
        [date]
      );
      const formResult = await pool.query(
        `SELECT ds."totalSales" AS form_total
         FROM daily_sales_v2 ds
         WHERE ds.shift_date = $1::date AND ds."deletedAt" IS NULL
         ORDER BY ds."createdAt" DESC LIMIT 1`,
        [date]
      );

      const posTotal = Number(posResult.rows[0]?.pos_total ?? 0);
      const formTotal = Number(formResult.rows[0]?.form_total ?? 0);

      if (posTotal > 0 && formTotal > 0) {
        const delta = Math.abs(formTotal - posTotal);
        const tolerance = Math.max(100, posTotal * 0.02); // ±฿100 or 2%
        if (delta > tolerance) {
          const sev: Severity = delta > 1000 ? "CRITICAL" : delta > 500 ? "HIGH" : "MEDIUM";
          await upsertIssue({
            shift_date: date,
            issue_type: "POS_FORM_MISMATCH",
            category: "FINANCIAL",
            severity: sev,
            title: `POS vs Form mismatch ฿${delta.toFixed(2)} for ${date}`,
            description: `Form total (฿${formTotal.toFixed(2)}) does not match POS total (฿${posTotal.toFixed(2)}). Difference: ฿${delta.toFixed(2)}. Tolerance: ฿${tolerance.toFixed(2)}.`,
            source_ref: `POS_FORM_MISMATCH::${date}`,
            metadata_json: { posTotal, formTotal, delta, tolerance },
          });
          created.push("POS_FORM_MISMATCH");
        } else {
          skipped.push("POS_FORM_MISMATCH (within tolerance)");
        }
      } else {
        skipped.push("POS_FORM_MISMATCH (missing data)");
      }
    } catch (e: any) {
      console.warn(`${TAG} POS/Form check failed:`, e.message);
      skipped.push("POS_FORM_MISMATCH (query failed)");
    }

    console.log(`${TAG} auto-create for ${date} — created: [${created.join(", ")}]`);
    res.json({ ok: true, date, created, skipped });
  } catch (e: any) {
    console.error(`${TAG} auto-create error:`, e.message);
    res.status(500).json({ error: e.message, created, skipped });
  }
});

export default router;
