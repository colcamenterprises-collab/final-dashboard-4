import { Router, type Request, type Response } from 'express';
import { db, pool } from '../db';
import {
  staffMembers,
  workAreas,
  shiftTemplates,
  shiftRosters,
  shiftStaffAssignments,
  cleaningTaskTemplates,
  shiftAttendanceLogs,
  staffUnavailability,
} from '../../shared/schema';
import { eq, asc, desc, and, gte, lte } from 'drizzle-orm';
import { getPinSessionUser } from './pinAuth';

const router = Router();
const LOC = 1;


type DailyFormsProgress = {
  form1: "complete";
  form2: "incomplete" | "complete";
  form3: "locked" | "available";
};

type DailyFormsResumeState = {
  id: string;
  shiftDate: string;
  completedBy: string;
  nextPath: string;
  progress: DailyFormsProgress;
};

function getDailyFormsUser(req: Request, res: Response) {
  const user = getPinSessionUser(req);
  if (!user) {
    res.status(401).json({
      ok: false,
      error: 'Your staff session has expired. Sign in again, then select Resume Forms.',
    });
    return null;
  }
  return user;
}

router.get('/daily-forms/resume', async (req, res) => {
  const user = getDailyFormsUser(req, res);
  if (!user) return;

  const canUseDailyForms =
    user.role === 'owner' ||
    user.permissions?.['forms.daily_sales'] === true ||
    user.permissions?.['forms.daily_cleaning'] === true ||
    user.permissions?.['forms.daily_stock'] === true;

  if (!canUseDailyForms) {
    return res.json({ ok: true, workflow: null });
  }

  try {
    const result = await pool.query(`
      SELECT
        d.id,
        COALESCE(NULLIF(d."shiftDate", ''), d.shift_date::text, d."createdAt"::date::text) AS "shiftDate",
        COALESCE(NULLIF(d."completedBy", ''), d.staff, '') AS "completedBy",
        CASE
          WHEN (
            SELECT COUNT(*)
            FROM daily_cleaning_task_definitions t
            WHERE t.active = TRUE AND t.module_type = 'daily_cleaning'
          ) = 0 THEN FALSE
          ELSE NOT EXISTS (
            SELECT 1
            FROM daily_cleaning_task_definitions t
            WHERE t.active = TRUE
              AND t.module_type = 'daily_cleaning'
              AND NOT EXISTS (
                SELECT 1
                FROM daily_cleaning_records c
                WHERE c.sales_id = d.id
                  AND c.task_id = t.task_id
                  AND c.status IN ('Pass', 'Requires Attention')
                  AND (t.photo_required = FALSE OR COALESCE(c.image_path, '') <> '')
                  AND (c.status <> 'Requires Attention' OR COALESCE(c.comments, '') <> '')
              )
          )
        END AS "cleaningComplete"
      FROM daily_sales_v2 d
      WHERE d."deletedAt" IS NULL
        AND COALESCE(NULLIF(d."shiftDate", '')::date, d.shift_date, d."createdAt"::date)
            >= CURRENT_DATE - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM daily_stock_v2 s WHERE s."salesId" = d.id
        )
      ORDER BY COALESCE(NULLIF(d."shiftDate", '')::timestamp, d.shift_date::timestamp, d."createdAt") DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ ok: true, workflow: null });
    }

    const row = result.rows[0];
    const cleaningComplete = row.cleaningComplete === true;
    const workflow: DailyFormsResumeState = {
      id: String(row.id),
      shiftDate: String(row.shiftDate || ''),
      completedBy: String(row.completedBy || ''),
      nextPath: cleaningComplete
        ? `/operations/daily-stock?shift=${encodeURIComponent(String(row.id))}`
        : `/operations/daily-cleaning?shift=${encodeURIComponent(String(row.id))}`,
      progress: cleaningComplete
        ? { form1: 'complete', form2: 'complete', form3: 'available' }
        : { form1: 'complete', form2: 'incomplete', form3: 'locked' },
    };

    return res.json({ ok: true, workflow });
  } catch (error: any) {
    console.error('[staff daily forms resume] lookup failed:', error);
    return res.status(503).json({
      ok: false,
      error: 'The unfinished daily forms could not be checked. Your saved forms were not changed.',
    });
  }
});

// ─── Staff Members ────────────────────────────────────────────────────────────

router.get('/members', async (req, res) => {
  try {
    const rows = await db.select().from(staffMembers)
      .where(eq(staffMembers.businessLocationId, LOC))
      .orderBy(asc(staffMembers.fullName));
    res.json({ members: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/members', async (req, res) => {
  try {
    const { fullName, displayName, primaryRole, canCashier, canBurgers, canSideOrders, canPrep, canCleaning, notes } = req.body;
    if (!fullName) return res.status(400).json({ error: 'fullName required' });
    const [row] = await db.insert(staffMembers).values({
      fullName,
      displayName: displayName || null,
      primaryRole: primaryRole || 'staff',
      canCashier: !!canCashier,
      canBurgers: !!canBurgers,
      canSideOrders: !!canSideOrders,
      canPrep: !!canPrep,
      canCleaning: canCleaning !== false,
      notes: notes || null,
      businessLocationId: LOC,
    }).returning();
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = ['fullName', 'displayName', 'primaryRole', 'canCashier', 'canBurgers', 'canSideOrders', 'canPrep', 'canCleaning', 'isActive', 'notes'];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of allowed) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [updated] = await db.update(staffMembers).set(updates).where(eq(staffMembers.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Work Areas ───────────────────────────────────────────────────────────────

router.get('/work-areas', async (req, res) => {
  try {
    const rows = await db.select().from(workAreas)
      .where(eq(workAreas.businessLocationId, LOC))
      .orderBy(asc(workAreas.sortOrder), asc(workAreas.name));
    res.json({ workAreas: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/work-areas', async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const [row] = await db.insert(workAreas).values({
      name,
      sortOrder: sortOrder ?? 0,
      businessLocationId: LOC,
    }).returning();
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Shift Templates ──────────────────────────────────────────────────────────

router.get('/templates', async (req, res) => {
  try {
    const rows = await db.select().from(shiftTemplates)
      .where(eq(shiftTemplates.businessLocationId, LOC))
      .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.startTime));
    res.json({ templates: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Rosters ──────────────────────────────────────────────────────────────────

router.get('/rosters', async (req, res) => {
  try {
    const { from, to } = req.query;
    let q = db.select().from(shiftRosters)
      .where(eq(shiftRosters.businessLocationId, LOC))
      .$dynamic();
    if (from) q = q.where(gte(shiftRosters.shiftDate, String(from)));
    if (to) q = q.where(lte(shiftRosters.shiftDate, String(to)));
    const rosters = await q.orderBy(desc(shiftRosters.shiftDate));
    res.json({ rosters });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rosters/:id/assignments', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const assignments = await db.select().from(shiftStaffAssignments)
      .where(eq(shiftStaffAssignments.shiftRosterId, id))
      .orderBy(asc(shiftStaffAssignments.scheduledStartTime));
    res.json({ assignments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Cleaning Tasks ───────────────────────────────────────────────────────────

router.get('/cleaning/templates', async (req, res) => {
  try {
    const rows = await db.select().from(cleaningTaskTemplates)
      .where(eq(cleaningTaskTemplates.businessLocationId, LOC))
      .orderBy(asc(cleaningTaskTemplates.sortOrder), asc(cleaningTaskTemplates.taskName));
    res.json({ templates: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Attendance ───────────────────────────────────────────────────────────────

router.get('/attendance', async (req, res) => {
  try {
    // Use raw SQL to avoid Drizzle enum/column-alias issues on this table
    const { sql: rawSql } = await import('drizzle-orm');
    const result = await db.execute(rawSql`
      SELECT id, shift_roster_id AS "shiftRosterId",
             shift_staff_assignment_id AS "shiftStaffAssignmentId",
             staff_member_id AS "staffMemberId",
             attendance_status AS "attendanceStatus",
             replacement_staff_id AS "replacementStaffId",
             lateness_minutes AS "latenessMinutes",
             clock_in_time AS "clockInTime",
             clock_out_time AS "clockOutTime",
             absence_reason AS "absenceReason",
             manager_notes AS "managerNotes",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM shift_attendance_logs
      ORDER BY created_at DESC, staff_member_id ASC
    `);
    res.json({ logs: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Unavailability ───────────────────────────────────────────────────────────

router.get('/unavailability', async (req, res) => {
  try {
    const rows = await db.select().from(staffUnavailability)
      .where(eq(staffUnavailability.businessLocationId, LOC))
      .orderBy(desc(staffUnavailability.startDate));
    res.json({ unavailability: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dashboard summary ────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [membersResult, rosterResult, cleaningResult] = await Promise.all([
      db.select().from(staffMembers).where(and(eq(staffMembers.businessLocationId, LOC), eq(staffMembers.isActive, true))),
      db.select().from(shiftRosters).where(eq(shiftRosters.businessLocationId, LOC)).orderBy(desc(shiftRosters.shiftDate)).limit(7),
      db.select().from(cleaningTaskTemplates).where(eq(cleaningTaskTemplates.businessLocationId, LOC)),
    ]);
    res.json({
      activeStaff: membersResult.length,
      recentRosters: rosterResult.length,
      cleaningTemplates: cleaningResult.length,
      lastRosterDate: rosterResult[0]?.shiftDate ?? null,
    });
  } catch (e: any) {
    res.status(200).json({ activeStaff: 0, recentRosters: 0, cleaningTemplates: 0, lastRosterDate: null, source: 'staff_ops_tables', blockers: [{ code: 'STAFF_DASHBOARD_UNAVAILABLE', message: e.message, where: '/api/staff/dashboard', canonical_source: 'staff_members + shift_rosters + cleaning_task_templates', auto_build_attempted: false }] });
  }
});

export default router;
