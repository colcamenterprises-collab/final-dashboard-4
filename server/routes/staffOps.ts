/**
 * Staff Operations Routes — Phase 1
 * Mounted at: /api/operations/staff
 *
 * Multi-business / multi-location ready. businessLocationId defaults
 * to 1 for single-location deployments and is passed on every query.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq, and, desc, asc, gte, lte, ne, inArray, sql } from 'drizzle-orm';
import {
  operationsSettings,
  operatingHours,
  workAreas,
  shiftTemplates,
  shiftTemplateStationRequirements,
  staffMembers,
  staffAvailability,
  staffUnavailability,
  shiftRosters,
  shiftStaffAssignments,
  shiftBreaks,
  cleaningTaskTemplates,
  shiftCleaningTasks,
  deepCleaningTasks,
  shiftAttendanceLogs,
  shiftChangeLog,
  insertOperationsSettingsSchema,
  insertOperatingHoursSchema,
  insertWorkAreaSchema,
  insertShiftTemplateSchema,
  insertShiftTemplateStationRequirementSchema,
  insertStaffMemberSchema,
  insertStaffAvailabilitySchema,
  insertStaffUnavailabilitySchema,
  insertShiftRosterSchema,
  insertShiftStaffAssignmentSchema,
  insertShiftBreakSchema,
  insertCleaningTaskTemplateSchema,
  insertShiftCleaningTaskSchema,
  insertDeepCleaningTaskSchema,
  insertShiftAttendanceLogSchema,
} from '../../shared/schema';
import {
  getOperationsSettings,
  updateOperationsSettings,
  autoGenerateWeeklyRoster,
  createShiftRoster,
  updateShiftRoster,
  deleteShiftRoster,
  createShiftAssignment,
  updateShiftAssignment,
  generateBreaksForRoster,
  generateCleaningTasksForRoster,
  logAttendanceStatus,
  replaceStaffOnShift,
  writeShiftChangeLog,
} from '../services/staffOpsService';
import {
  generateIndividualRosterPDF,
  generateTeamRosterPDF,
} from '../services/rosterExportService';

const router = Router();

const DEFAULT_LOCATION = 1;

const nullablePositiveNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num) || num < 0) return null;
    if (num === 0) return null; // 0 = no limit
    return num;
  },
  z.number().nonnegative().nullable().optional()
);

const autoGenerateWeekSchema = z.object({
  businessLocationId: z.coerce.number().int().positive().default(DEFAULT_LOCATION),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(['draft', 'publish']).default('draft'),
  overwriteExistingDrafts: z.boolean().default(false),
  targetFairnessMode: z.enum(['equal_hours', 'equal_shifts']).default('equal_hours'),
  includeDailyCleaning: z.boolean().default(true),
  includeDeepCleaning: z.boolean().default(true),
  ownerRules: z
    .object({
      maxShiftsPerStaffPerWeek: nullablePositiveNumber,
      minHoursPerStaffPerWeek: z.coerce.number().nonnegative().nullable().optional(),
      maxHoursPerStaffPerWeek: nullablePositiveNumber,
      preferredBusyDayStaffCount: nullablePositiveNumber,
      allowBackToBackCloseOpen: z.boolean().nullable().optional(),
    })
    .optional(),
});

function getLocationId(req: any): number {
  return Number(req.query.locationId ?? req.body?.businessLocationId ?? DEFAULT_LOCATION);
}

function handleError(res: any, err: unknown, context: string) {
  console.error(`[STAFF_OPS] ${context}:`, err);
  res.status(500).json({ error: `Failed: ${context}`, detail: String(err) });
}

function addDaysISO(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextDueDateFromFrequency(currentDueDate: string, frequency: string) {
  if (frequency === 'daily') return addDaysISO(currentDueDate, 1);
  if (frequency === 'weekly') return addDaysISO(currentDueDate, 7);
  if (frequency === 'fortnightly') return addDaysISO(currentDueDate, 14);
  if (frequency === 'monthly') return addDaysISO(currentDueDate, 30);
  if (frequency === 'quarterly') return addDaysISO(currentDueDate, 90);
  return currentDueDate;
}

// ----------------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------------

router.get('/settings', async (req, res) => {
  try {
    const data = await getOperationsSettings(getLocationId(req));
    res.json(data);
  } catch (err) {
    handleError(res, err, 'getSettings');
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const parsed = insertOperationsSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const data = await updateOperationsSettings(getLocationId(req), parsed.data);
    res.json(data);
  } catch (err) {
    handleError(res, err, 'updateSettings');
  }
});

// ----------------------------------------------------------------
// OPERATING HOURS
// ----------------------------------------------------------------

router.get('/operating-hours', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(operatingHours)
      .where(eq(operatingHours.businessLocationId, getLocationId(req)))
      .orderBy(asc(operatingHours.dayOfWeek));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getOperatingHours');
  }
});

router.post('/operating-hours', async (req, res) => {
  try {
    const parsed = insertOperatingHoursSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(operatingHours).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createOperatingHours');
  }
});

router.patch('/operating-hours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertOperatingHoursSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(operatingHours)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(operatingHours.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateOperatingHours');
  }
});

// ----------------------------------------------------------------
// WORK AREAS
// ----------------------------------------------------------------

router.get('/work-areas', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(workAreas)
      .where(eq(workAreas.businessLocationId, getLocationId(req)))
      .orderBy(asc(workAreas.sortOrder), asc(workAreas.name));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getWorkAreas');
  }
});

router.post('/work-areas', async (req, res) => {
  try {
    const parsed = insertWorkAreaSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(workAreas).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createWorkArea');
  }
});

router.patch('/work-areas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertWorkAreaSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(workAreas)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(workAreas.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateWorkArea');
  }
});

router.delete('/work-areas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(workAreas).where(eq(workAreas.id, id));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteWorkArea');
  }
});

// ----------------------------------------------------------------
// SHIFT TEMPLATES
// ----------------------------------------------------------------

router.get('/shift-templates', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(shiftTemplates)
      .where(eq(shiftTemplates.businessLocationId, getLocationId(req)))
      .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.templateName));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getShiftTemplates');
  }
});

router.post('/shift-templates', async (req, res) => {
  try {
    const parsed = insertShiftTemplateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(shiftTemplates).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createShiftTemplate');
  }
});

router.patch('/shift-templates/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(shiftTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateShiftTemplate');
  }
});

router.delete('/shift-templates/:id', async (req, res) => {
  try {
    await db.delete(shiftTemplates).where(eq(shiftTemplates.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteShiftTemplate');
  }
});

// ----------------------------------------------------------------
// STATION REQUIREMENTS (per shift template)
// ----------------------------------------------------------------

router.get('/templates/:templateId/station-requirements', async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    const rows = await db
      .select({
        req: shiftTemplateStationRequirements,
        area: workAreas,
      })
      .from(shiftTemplateStationRequirements)
      .leftJoin(workAreas, eq(shiftTemplateStationRequirements.workAreaId, workAreas.id))
      .where(eq(shiftTemplateStationRequirements.shiftTemplateId, templateId))
      .orderBy(asc(shiftTemplateStationRequirements.priority), asc(shiftTemplateStationRequirements.id));

    res.json(
      rows.map((r) => ({
        ...r.req,
        workAreaName: r.area?.name ?? null,
      }))
    );
  } catch (err) {
    handleError(res, err, 'getStationRequirements');
  }
});

router.post('/templates/:templateId/station-requirements', async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    const parsed = insertShiftTemplateStationRequirementSchema.safeParse({
      ...req.body,
      shiftTemplateId: templateId,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [row] = await db
      .insert(shiftTemplateStationRequirements)
      .values(parsed.data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createStationRequirement');
  }
});

router.patch('/templates/:templateId/station-requirements/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .update(shiftTemplateStationRequirements)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(shiftTemplateStationRequirements.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateStationRequirement');
  }
});

router.delete('/templates/:templateId/station-requirements/:id', async (req, res) => {
  try {
    await db
      .delete(shiftTemplateStationRequirements)
      .where(eq(shiftTemplateStationRequirements.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteStationRequirement');
  }
});

// ----------------------------------------------------------------
// STAFF UNAVAILABILITY
// ----------------------------------------------------------------

router.get('/unavailability', async (req, res) => {
  try {
    const locationId = getLocationId(req);
    const staffIdParam = req.query.staffMemberId ? Number(req.query.staffMemberId) : null;
    const conditions = [eq(staffUnavailability.businessLocationId, locationId)];
    if (staffIdParam) conditions.push(eq(staffUnavailability.staffMemberId, staffIdParam));
    const rows = await db
      .select()
      .from(staffUnavailability)
      .where(and(...conditions))
      .orderBy(desc(staffUnavailability.startDate));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getUnavailability');
  }
});

router.post('/unavailability', async (req, res) => {
  try {
    const parsed = insertStaffUnavailabilitySchema.safeParse({
      ...req.body,
      businessLocationId: getLocationId(req),
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [row] = await db.insert(staffUnavailability).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createUnavailability');
  }
});

router.patch('/unavailability/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .update(staffUnavailability)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(staffUnavailability.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateUnavailability');
  }
});

router.delete('/unavailability/:id', async (req, res) => {
  try {
    await db
      .delete(staffUnavailability)
      .where(eq(staffUnavailability.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteUnavailability');
  }
});

// ----------------------------------------------------------------
// STAFF MEMBERS
// ----------------------------------------------------------------

router.get('/members', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.businessLocationId, getLocationId(req)))
      .orderBy(asc(staffMembers.fullName));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getStaffMembers');
  }
});

router.get('/members/:id', async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, Number(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'getStaffMember');
  }
});

function sanitizeMember(body: Record<string, unknown>) {
  const out = { ...body };
  if (out.displayName === '') out.displayName = null;
  if (out.notes === '') out.notes = null;
  if (out.secondaryRoles === undefined) out.secondaryRoles = [];
  if (out.customCapabilities === undefined) out.customCapabilities = {};
  return out;
}

router.post('/members', async (req, res) => {
  try {
    const parsed = insertStaffMemberSchema.safeParse(sanitizeMember(req.body));
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(staffMembers).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createStaffMember');
  }
});

router.patch('/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertStaffMemberSchema.partial().safeParse(sanitizeMember(req.body));
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(staffMembers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateStaffMember');
  }
});

router.patch('/members/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'isActive (boolean) required' });
    const [row] = await db
      .update(staffMembers)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateStaffMemberStatus');
  }
});

// ----------------------------------------------------------------
// STAFF AVAILABILITY
// ----------------------------------------------------------------

router.get('/availability', async (req, res) => {
  try {
    const staffMemberId = req.query.staffMemberId ? Number(req.query.staffMemberId) : undefined;
    const query = db.select().from(staffAvailability);
    const rows = staffMemberId
      ? await query
          .where(eq(staffAvailability.staffMemberId, staffMemberId))
          .orderBy(asc(staffAvailability.dayOfWeek))
      : await query.orderBy(asc(staffAvailability.staffMemberId), asc(staffAvailability.dayOfWeek));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getStaffAvailability');
  }
});

router.post('/availability', async (req, res) => {
  try {
    const parsed = insertStaffAvailabilitySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(staffAvailability).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createStaffAvailability');
  }
});

router.patch('/availability/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertStaffAvailabilitySchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(staffAvailability)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(staffAvailability.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateStaffAvailability');
  }
});

// ----------------------------------------------------------------
// ROSTERS
// ----------------------------------------------------------------

router.get('/rosters', async (req, res) => {
  try {
    const locationId = getLocationId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    const conditions = [
      eq(shiftRosters.businessLocationId, locationId),
      ne(shiftRosters.status, 'cancelled'),
    ];
    if (from) conditions.push(gte(shiftRosters.shiftDate, from));
    if (to) conditions.push(lte(shiftRosters.shiftDate, to));
    const rows = await db
      .select()
      .from(shiftRosters)
      .where(and(...conditions))
      .orderBy(desc(shiftRosters.shiftDate), asc(shiftRosters.shiftStartTime));

    // Attach assignment counts so the collapsed card can display "X/Y staff"
    if (rows.length > 0) {
      const rosterIds = rows.map((r) => r.id);
      const countRows = await db
        .select({
          shiftRosterId: shiftStaffAssignments.shiftRosterId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(shiftStaffAssignments)
        .where(inArray(shiftStaffAssignments.shiftRosterId, rosterIds))
        .groupBy(shiftStaffAssignments.shiftRosterId);
      const cleaningRows = await db
        .select({
          shiftRosterId: shiftCleaningTasks.shiftRosterId,
          total: sql<number>`cast(count(*) as int)`,
          completed: sql<number>`cast(sum(case when ${shiftCleaningTasks.status} = 'completed' then 1 else 0 end) as int)`,
        })
        .from(shiftCleaningTasks)
        .where(inArray(shiftCleaningTasks.shiftRosterId, rosterIds))
        .groupBy(shiftCleaningTasks.shiftRosterId);
      const countMap: Record<number, number> = {};
      for (const c of countRows) countMap[c.shiftRosterId] = c.count;
      const cleaningMap: Record<number, { total: number; completed: number }> = {};
      for (const c of cleaningRows)
        cleaningMap[c.shiftRosterId] = { total: c.total ?? 0, completed: c.completed ?? 0 };

      const from = rows.map((r) => r.shiftDate).sort()[0];
      const to = rows
        .map((r) => r.shiftDate)
        .sort()
        .slice(-1)[0];
      const deepRows =
        from && to
          ? await db
              .select()
              .from(deepCleaningTasks)
              .where(
                and(
                  eq(deepCleaningTasks.businessLocationId, locationId),
                  gte(deepCleaningTasks.dueDate, from),
                  lte(deepCleaningTasks.dueDate, to),
                  ne(deepCleaningTasks.status, 'completed')
                )
              )
          : [];

      return res.json(
        rows.map((r) => {
          const clean = cleaningMap[r.id] ?? { total: 0, completed: 0 };
          const deepAssigned = deepRows.filter(
            (d) => d.dueDate === r.shiftDate && d.assignedStaffId !== null
          ).length;
          return {
            ...r,
            assignmentCount: countMap[r.id] ?? 0,
            dailyCleaningTaskCount: clean.total,
            dailyCleaningCompletedCount: clean.completed,
            deepCleaningAssignedCount: deepAssigned,
            cleaningIncomplete: clean.total > clean.completed,
          };
        })
      );
    }
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getRosters');
  }
});

router.get('/rosters/export/team', async (req, res) => {
  try {
    const locationId = getLocationId(req);
    const weekStart = String(req.query.weekStart ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ error: 'weekStart query param required (YYYY-MM-DD)' });
    }

    const stream = await generateTeamRosterPDF(weekStart, locationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=team-roster-location-${locationId}-${weekStart}.pdf`
    );
    stream.pipe(res);
  } catch (err) {
    handleError(res, err, 'exportTeamRosterPdf');
  }
});

router.get('/rosters/export/staff/:id', async (req, res) => {
  try {
    const locationId = getLocationId(req);
    const staffId = Number(req.params.id);
    const weekStart = String(req.query.weekStart ?? '');
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return res.status(400).json({ error: 'Invalid staff id' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ error: 'weekStart query param required (YYYY-MM-DD)' });
    }

    const stream = await generateIndividualRosterPDF(staffId, weekStart, locationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=staff-roster-${staffId}-${weekStart}.pdf`
    );
    stream.pipe(res);
  } catch (err) {
    handleError(res, err, 'exportIndividualRosterPdf');
  }
});

router.get('/rosters/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(shiftRosters).where(eq(shiftRosters.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const assignments = await db
      .select()
      .from(shiftStaffAssignments)
      .where(eq(shiftStaffAssignments.shiftRosterId, id))
      .orderBy(asc(shiftStaffAssignments.scheduledStartTime));
    res.json({ ...row, assignments });
  } catch (err) {
    handleError(res, err, 'getRoster');
  }
});

// Normalize "HH:mm", "H:mm", "HH:mm:ss", "h:mm AM/PM" → "HH:mm"
function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  // Already HH:mm or H:mm
  const hhmm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
  // 12h AM/PM  e.g. "6:00 PM"
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  return null;
}

const createRosterBodySchema = z.object({
  shiftName: z.string().min(1, 'Roster name is required'),
  shiftDate: z.string().min(8, 'shiftDate required (YYYY-MM-DD)'),
  shiftStartTime: z.string().min(1, 'Start time required'),
  shiftEndTime: z.string().min(1, 'End time required'),
  maxStaff: z.coerce.number().int().min(1).max(50).default(5),
  isCustomShift: z.boolean().default(true),
  templateId: z.coerce.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional().default('draft'),
  createdBy: z.string().optional().default('manager'),
});

router.post('/rosters', async (req, res) => {
  try {
    const parsed = createRosterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const d = parsed.data;
    const startTime = normalizeTime(d.shiftStartTime);
    const endTime = normalizeTime(d.shiftEndTime);
    if (!startTime)
      return res
        .status(400)
        .json({ error: 'Invalid start time format', received: d.shiftStartTime });
    if (!endTime)
      return res.status(400).json({ error: 'Invalid end time format', received: d.shiftEndTime });

    const insertData = {
      businessLocationId: getLocationId(req),
      shiftDate: d.shiftDate,
      shiftName: d.shiftName.trim(),
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      maxStaff: d.maxStaff,
      isCustomShift: d.isCustomShift,
      templateId: d.templateId ?? null,
      notes: d.notes?.trim() || null,
      status: (d.status as any) ?? 'draft',
      createdBy: d.createdBy ?? 'manager',
    };

    const roster = await createShiftRoster(insertData as any);
    res.status(201).json(roster);
  } catch (err) {
    handleError(res, err, 'createRoster');
  }
});

router.post('/rosters/auto-generate-week', async (req, res) => {
  try {
    const parsed = autoGenerateWeekSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const payload = { ...parsed.data, changedBy: req.body?.changedBy ?? 'manager' };
    const result = await autoGenerateWeeklyRoster(payload);
    res.status(201).json(result);
  } catch (err) {
    if (String(err).includes('No active shift templates found')) {
      return res
        .status(400)
        .json({ error: 'No active shift templates found. Create shift templates first.' });
    }
    handleError(res, err, 'autoGenerateWeek');
  }
});

router.patch('/rosters/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftRosterSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const roster = await updateShiftRoster(id, parsed.data, req.body.changedBy ?? 'manager');
    res.json(roster);
  } catch (err) {
    handleError(res, err, 'updateRoster');
  }
});

router.delete('/rosters/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const changedBy = typeof req.body?.changedBy === 'string' ? req.body.changedBy : 'manager';
    const result = await deleteShiftRoster(id, changedBy, reason);
    res.json(result);
  } catch (err) {
    if (String(err).includes('not found')) return res.status(404).json({ error: String(err) });
    handleError(res, err, 'deleteRoster');
  }
});

// ----------------------------------------------------------------
// ASSIGNMENTS
// ----------------------------------------------------------------

router.post('/rosters/:id/assignments', async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const parsed = insertShiftStaffAssignmentSchema.safeParse({ ...req.body, shiftRosterId });
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const assignment = await createShiftAssignment(parsed.data, req.body.changedBy ?? 'manager');
    res.status(201).json(assignment);
  } catch (err) {
    handleError(res, err, 'createAssignment');
  }
});

router.patch('/assignments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftStaffAssignmentSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const assignment = await updateShiftAssignment(
      id,
      parsed.data,
      req.body.changedBy ?? 'manager'
    );
    res.json(assignment);
  } catch (err) {
    handleError(res, err, 'updateAssignment');
  }
});

router.delete('/assignments/:id', async (req, res) => {
  try {
    await db
      .delete(shiftStaffAssignments)
      .where(eq(shiftStaffAssignments.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteAssignment');
  }
});

// ----------------------------------------------------------------
// BREAKS
// ----------------------------------------------------------------

router.get('/rosters/:id/all-breaks', async (req, res) => {
  try {
    const rosterId = Number(req.params.id);
    const rows = await db
      .select({ brk: shiftBreaks })
      .from(shiftBreaks)
      .innerJoin(shiftStaffAssignments, eq(shiftBreaks.shiftStaffAssignmentId, shiftStaffAssignments.id))
      .where(eq(shiftStaffAssignments.shiftRosterId, rosterId))
      .orderBy(asc(shiftBreaks.plannedStartTime));
    res.json(rows.map((r) => r.brk));
  } catch (err) {
    handleError(res, err, 'getAllRosterBreaks');
  }
});

router.post('/rosters/:id/breaks/auto-generate', async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const locationId = getLocationId(req);
    const breaks = await generateBreaksForRoster(shiftRosterId, locationId);
    res.status(201).json(breaks);
  } catch (err) {
    handleError(res, err, 'autoGenerateBreaks');
  }
});

router.get('/assignments/:id/breaks', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(shiftBreaks)
      .where(eq(shiftBreaks.shiftStaffAssignmentId, Number(req.params.id)))
      .orderBy(asc(shiftBreaks.plannedStartTime));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getBreaks');
  }
});

router.post('/assignments/:id/breaks', async (req, res) => {
  try {
    const shiftStaffAssignmentId = Number(req.params.id);
    const parsed = insertShiftBreakSchema.safeParse({ ...req.body, shiftStaffAssignmentId });
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(shiftBreaks).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createBreak');
  }
});

router.patch('/breaks/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftBreakSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(shiftBreaks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftBreaks.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateBreak');
  }
});

router.delete('/breaks/:id', async (req, res) => {
  try {
    await db.delete(shiftBreaks).where(eq(shiftBreaks.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'deleteBreak');
  }
});

// ----------------------------------------------------------------
// CLEANING TEMPLATES
// ----------------------------------------------------------------

router.get('/cleaning/templates', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(cleaningTaskTemplates)
      .where(eq(cleaningTaskTemplates.businessLocationId, getLocationId(req)))
      .orderBy(asc(cleaningTaskTemplates.sortOrder), asc(cleaningTaskTemplates.taskName));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getCleaningTemplates');
  }
});

router.post('/cleaning/templates', async (req, res) => {
  try {
    const parsed = insertCleaningTaskTemplateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(cleaningTaskTemplates).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createCleaningTemplate');
  }
});

router.patch('/cleaning/templates/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertCleaningTaskTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(cleaningTaskTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cleaningTaskTemplates.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateCleaningTemplate');
  }
});

// ----------------------------------------------------------------
// CLEANING TEMPLATES — SEED (idempotent, only inserts if count is 0)
// ----------------------------------------------------------------

router.post('/cleaning/templates/seed', async (req, res) => {
  try {
    const locationId = getLocationId(req);

    type TaskSeed = { taskName: string; areaName: string; timing: string; role: string; estimatedMinutes: number; required: boolean; sortOrder: number };
    const ALL_TASKS: TaskSeed[] = [
      // --- START OF SHIFT ---
      { taskName: 'Staff in full uniform and presentable', areaName: 'Staff Readiness', timing: 'start_shift', role: 'manager', estimatedMinutes: 2, required: true, sortOrder: 10 },
      { taskName: 'All staff clocked in on time', areaName: 'Staff Readiness', timing: 'start_shift', role: 'manager', estimatedMinutes: 2, required: true, sortOrder: 11 },
      { taskName: 'Roles assigned and understood', areaName: 'Staff Readiness', timing: 'start_shift', role: 'manager', estimatedMinutes: 3, required: true, sortOrder: 12 },
      { taskName: 'Staff have required tools and equipment', areaName: 'Staff Readiness', timing: 'start_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 13 },
      { taskName: 'POS system powered on and tested', areaName: 'Systems & Setup', timing: 'start_shift', role: 'manager', estimatedMinutes: 3, required: true, sortOrder: 20 },
      { taskName: 'Grab system online and accepting orders', areaName: 'Systems & Setup', timing: 'start_shift', role: 'manager', estimatedMinutes: 2, required: true, sortOrder: 21 },
      { taskName: 'Receipt printer test completed', areaName: 'Systems & Setup', timing: 'start_shift', role: 'manager', estimatedMinutes: 2, required: false, sortOrder: 22 },
      { taskName: 'Tablets cleaned and operational', areaName: 'Systems & Setup', timing: 'start_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 23 },
      { taskName: 'Drinks fridge fully stocked', areaName: 'Stock & Prep', timing: 'start_shift', role: 'kitchen', estimatedMinutes: 5, required: true, sortOrder: 30 },
      { taskName: 'Napkins restocked at front', areaName: 'Stock & Prep', timing: 'start_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 31 },
      { taskName: 'Ingredients prepped and ready', areaName: 'Stock & Prep', timing: 'start_shift', role: 'kitchen', estimatedMinutes: 10, required: true, sortOrder: 32 },
      { taskName: 'Expired items checked and removed', areaName: 'Stock & Prep', timing: 'start_shift', role: 'kitchen', estimatedMinutes: 5, required: true, sortOrder: 33 },
      { taskName: 'Benches wiped down', areaName: 'Opening Clean', timing: 'start_shift', role: 'all', estimatedMinutes: 5, required: true, sortOrder: 40 },
      { taskName: 'Under-bench areas checked and cleaned', areaName: 'Opening Clean', timing: 'start_shift', role: 'kitchen', estimatedMinutes: 5, required: false, sortOrder: 41 },
      { taskName: 'External area swept', areaName: 'Opening Clean', timing: 'start_shift', role: 'all', estimatedMinutes: 5, required: true, sortOrder: 42 },
      { taskName: 'Signage and displays cleaned', areaName: 'Opening Clean', timing: 'start_shift', role: 'all', estimatedMinutes: 3, required: false, sortOrder: 43 },
      { taskName: 'POS devices and tablets wiped clean', areaName: 'Opening Clean', timing: 'start_shift', role: 'all', estimatedMinutes: 3, required: false, sortOrder: 44 },
      { taskName: 'Fryer alarms checked and working', areaName: 'Safety', timing: 'start_shift', role: 'manager', estimatedMinutes: 3, required: true, sortOrder: 50 },
      { taskName: 'Cooking areas safe and compliant', areaName: 'Safety', timing: 'start_shift', role: 'manager', estimatedMinutes: 3, required: true, sortOrder: 51 },

      // --- DURING SHIFT ---
      { taskName: 'Staff remain in assigned stations', areaName: 'Staff Performance', timing: 'during_shift', role: 'manager', estimatedMinutes: 2, required: false, sortOrder: 110 },
      { taskName: 'Staff performing efficiently', areaName: 'Staff Performance', timing: 'during_shift', role: 'manager', estimatedMinutes: 2, required: false, sortOrder: 111 },
      { taskName: 'Hygiene standards maintained throughout', areaName: 'Staff Performance', timing: 'during_shift', role: 'all', estimatedMinutes: 2, required: true, sortOrder: 112 },
      { taskName: 'Customer issues handled promptly', areaName: 'Staff Performance', timing: 'during_shift', role: 'manager', estimatedMinutes: 3, required: false, sortOrder: 113 },
      { taskName: 'Prep areas wiped between orders', areaName: 'Ongoing Cleaning', timing: 'during_shift', role: 'kitchen', estimatedMinutes: 3, required: true, sortOrder: 120 },
      { taskName: 'Tables cleaned after each customer', areaName: 'Ongoing Cleaning', timing: 'during_shift', role: 'all', estimatedMinutes: 2, required: true, sortOrder: 121 },
      { taskName: 'Seating kept organised', areaName: 'Ongoing Cleaning', timing: 'during_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 122 },
      { taskName: 'Trash bins emptied when full', areaName: 'Ongoing Cleaning', timing: 'during_shift', role: 'all', estimatedMinutes: 3, required: true, sortOrder: 123 },
      { taskName: 'Menus and displays kept clean', areaName: 'Ongoing Cleaning', timing: 'during_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 124 },
      { taskName: 'Handwashing protocols followed', areaName: 'Food Safety', timing: 'during_shift', role: 'all', estimatedMinutes: 1, required: true, sortOrder: 130 },
      { taskName: 'Meat handling guidelines followed', areaName: 'Food Safety', timing: 'during_shift', role: 'kitchen', estimatedMinutes: 1, required: true, sortOrder: 131 },
      { taskName: 'Prep areas kept sanitary', areaName: 'Food Safety', timing: 'during_shift', role: 'kitchen', estimatedMinutes: 2, required: true, sortOrder: 132 },

      // --- END OF SHIFT ---
      { taskName: 'Grill cleaned thoroughly', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 15, required: true, sortOrder: 210 },
      { taskName: 'Fryer cleaned including underneath', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 15, required: true, sortOrder: 211 },
      { taskName: 'Fans and ventilation cleaned', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 10, required: false, sortOrder: 212 },
      { taskName: 'Grease removed from all surfaces', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 10, required: true, sortOrder: 213 },
      { taskName: 'Grease traps cleaned', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 10, required: true, sortOrder: 214 },
      { taskName: 'Cooking areas sanitised', areaName: 'Kitchen Deep Clean', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 10, required: true, sortOrder: 215 },
      { taskName: 'All benches cleaned inside and out', areaName: 'General Cleaning', timing: 'end_shift', role: 'all', estimatedMinutes: 10, required: true, sortOrder: 220 },
      { taskName: 'Dishwashing area cleaned and organised', areaName: 'General Cleaning', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 8, required: true, sortOrder: 221 },
      { taskName: 'All utensils washed and sanitised', areaName: 'General Cleaning', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 10, required: true, sortOrder: 222 },
      { taskName: 'Prep surfaces sanitised', areaName: 'General Cleaning', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 5, required: true, sortOrder: 223 },
      { taskName: 'Tables and chairs cleaned', areaName: 'Front of House', timing: 'end_shift', role: 'all', estimatedMinutes: 10, required: true, sortOrder: 230 },
      { taskName: 'Chairs aligned and tidy', areaName: 'Front of House', timing: 'end_shift', role: 'all', estimatedMinutes: 3, required: false, sortOrder: 231 },
      { taskName: 'Counters cleaned', areaName: 'Front of House', timing: 'end_shift', role: 'all', estimatedMinutes: 5, required: true, sortOrder: 232 },
      { taskName: 'Napkin holders cleaned and restocked', areaName: 'Front of House', timing: 'end_shift', role: 'all', estimatedMinutes: 3, required: false, sortOrder: 233 },
      { taskName: 'Signage wiped down', areaName: 'Front of House', timing: 'end_shift', role: 'all', estimatedMinutes: 3, required: false, sortOrder: 234 },
      { taskName: 'POS devices cleaned and stored', areaName: 'Front of House', timing: 'end_shift', role: 'cashier', estimatedMinutes: 5, required: true, sortOrder: 235 },
      { taskName: 'Drinks fridge restocked for next shift', areaName: 'Stock Reset', timing: 'end_shift', role: 'kitchen', estimatedMinutes: 5, required: true, sortOrder: 240 },
      { taskName: 'Napkins restocked', areaName: 'Stock Reset', timing: 'end_shift', role: 'all', estimatedMinutes: 2, required: false, sortOrder: 241 },
      { taskName: 'Shelves organised and tidy', areaName: 'Stock Reset', timing: 'end_shift', role: 'all', estimatedMinutes: 5, required: false, sortOrder: 242 },
      { taskName: 'Incorrect items removed from display', areaName: 'Stock Reset', timing: 'end_shift', role: 'manager', estimatedMinutes: 3, required: false, sortOrder: 243 },
      { taskName: 'All rubbish removed from shop', areaName: 'Waste & External', timing: 'end_shift', role: 'all', estimatedMinutes: 5, required: true, sortOrder: 250 },
      { taskName: 'Front and side areas cleared', areaName: 'Waste & External', timing: 'end_shift', role: 'all', estimatedMinutes: 5, required: true, sortOrder: 251 },
      { taskName: 'External area cleaned', areaName: 'Waste & External', timing: 'end_shift', role: 'all', estimatedMinutes: 5, required: false, sortOrder: 252 },
      { taskName: 'Starting cash verified for next shift', areaName: 'Cash & Reporting', timing: 'end_shift', role: 'manager', estimatedMinutes: 5, required: true, sortOrder: 258 },
      { taskName: 'Mid-shift cash count completed', areaName: 'Cash & Reporting', timing: 'end_shift', role: 'manager', estimatedMinutes: 5, required: false, sortOrder: 259 },
      { taskName: 'End-of-shift cash counted and logged', areaName: 'Cash & Reporting', timing: 'end_shift', role: 'manager', estimatedMinutes: 10, required: true, sortOrder: 260 },
      { taskName: 'Grab/online sales reconciled', areaName: 'Cash & Reporting', timing: 'end_shift', role: 'manager', estimatedMinutes: 5, required: true, sortOrder: 261 },
      { taskName: 'Shift report completed', areaName: 'Cash & Reporting', timing: 'end_shift', role: 'manager', estimatedMinutes: 5, required: true, sortOrder: 262 },
    ];

    // Idempotent: only insert tasks not already present (matched by taskName + businessLocationId)
    const existing = await db
      .select({ taskName: cleaningTaskTemplates.taskName })
      .from(cleaningTaskTemplates)
      .where(eq(cleaningTaskTemplates.businessLocationId, locationId));
    const existingNames = new Set(existing.map((r) => r.taskName));
    const toInsert = ALL_TASKS.filter((t) => !existingNames.has(t.taskName));

    if (toInsert.length === 0) {
      return res.json({ seeded: 0, message: `All ${existing.length} templates already present — nothing to add.` });
    }

    const inserted = await db
      .insert(cleaningTaskTemplates)
      .values(toInsert.map((t) => ({ ...t, businessLocationId: locationId, taskType: 'daily' as const })))
      .returning({ id: cleaningTaskTemplates.id });

    res.status(201).json({ seeded: inserted.length, total: existing.length + inserted.length, message: `Added ${inserted.length} missing task template(s). Total: ${existing.length + inserted.length}.` });
  } catch (err) {
    handleError(res, err, 'seedCleaningTemplates');
  }
});

// ----------------------------------------------------------------
// CLEANING TASKS (per roster)
// ----------------------------------------------------------------

router.get('/rosters/:id/cleaning', async (req, res) => {
  try {
    const rosterId = Number(req.params.id);
    const tasks = await db
      .select()
      .from(shiftCleaningTasks)
      .where(eq(shiftCleaningTasks.shiftRosterId, rosterId))
      .orderBy(asc(shiftCleaningTasks.id));
    if (tasks.length === 0) return res.json([]);
    const templates = await db
      .select()
      .from(cleaningTaskTemplates)
      .where(and(eq(cleaningTaskTemplates.businessLocationId, getLocationId(req))));
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const enriched = tasks.map((t) => ({
      ...t,
      template: templateMap.get(t.cleaningTaskTemplateId) ?? null,
    }));
    res.json(enriched);
  } catch (err) {
    handleError(res, err, 'getRosterCleaning');
  }
});

router.post('/rosters/:id/cleaning/generate', async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const locationId = getLocationId(req);
    const tasks = await generateCleaningTasksForRoster(shiftRosterId, locationId);
    res.status(201).json(tasks);
  } catch (err) {
    handleError(res, err, 'generateCleaningTasks');
  }
});

router.patch('/cleaning/tasks/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftCleaningTaskSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(shiftCleaningTasks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftCleaningTasks.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateCleaningTask');
  }
});

// ----------------------------------------------------------------
// DEEP CLEANING
// ----------------------------------------------------------------

router.get('/deep-cleaning', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(deepCleaningTasks)
      .where(eq(deepCleaningTasks.businessLocationId, getLocationId(req)))
      .orderBy(asc(deepCleaningTasks.dueDate));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getDeepCleaning');
  }
});

router.post('/deep-cleaning', async (req, res) => {
  try {
    const parsed = insertDeepCleaningTaskSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db.insert(deepCleaningTasks).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err, 'createDeepCleaning');
  }
});

router.patch('/deep-cleaning/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertDeepCleaningTaskSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(deepCleaningTasks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(deepCleaningTasks.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateDeepCleaning');
  }
});

router.post('/deep-cleaning/:id/complete', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(deepCleaningTasks)
      .where(eq(deepCleaningTasks.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const nextDueDate =
      req.body.nextDueDate ?? nextDueDateFromFrequency(existing.dueDate, existing.frequency);
    const [row] = await db
      .update(deepCleaningTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        notes: typeof req.body?.notes === 'string' ? req.body.notes : existing.notes,
        dueDate: nextDueDate,
        updatedAt: new Date(),
      })
      .where(eq(deepCleaningTasks.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    handleError(res, err, 'completeDeepCleaning');
  }
});

router.post('/deep-cleaning/:id/rollover', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(deepCleaningTasks)
      .where(eq(deepCleaningTasks.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const newDueDate =
      req.body.newDueDate ?? nextDueDateFromFrequency(existing.dueDate, existing.frequency);
    const [row] = await db
      .update(deepCleaningTasks)
      .set({
        status: 'rolled_over',
        dueDate: newDueDate,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : existing.notes,
        rolloverCount: (existing.rolloverCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(deepCleaningTasks.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    handleError(res, err, 'rolloverDeepCleaning');
  }
});

router.delete('/deep-cleaning/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .update(deepCleaningTasks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(deepCleaningTasks.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, id, isActive: false });
  } catch (err) {
    handleError(res, err, 'deactivateDeepCleaning');
  }
});

// ----------------------------------------------------------------
// ATTENDANCE
// ----------------------------------------------------------------

router.get('/rosters/:id/attendance', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(shiftAttendanceLogs)
      .where(eq(shiftAttendanceLogs.shiftRosterId, Number(req.params.id)))
      .orderBy(desc(shiftAttendanceLogs.createdAt));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getRosterAttendance');
  }
});

router.post('/rosters/:id/attendance', async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const parsed = insertShiftAttendanceLogSchema.safeParse({ ...req.body, shiftRosterId });
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const log = await logAttendanceStatus(parsed.data, req.body.changedBy ?? 'manager');
    res.status(201).json(log);
  } catch (err) {
    handleError(res, err, 'createAttendance');
  }
});

router.patch('/attendance/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftAttendanceLogSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const [row] = await db
      .update(shiftAttendanceLogs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftAttendanceLogs.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleError(res, err, 'updateAttendance');
  }
});

// Convenience status setters
const statusRoutes: Record<string, (typeof shiftAttendanceLogs.$inferSelect)['attendanceStatus']> =
  {
    'mark-present': 'present',
    'mark-late': 'late',
    'mark-sick': 'sick',
    'mark-absent': 'absent',
    'mark-left-early': 'left_early',
  };

Object.entries(statusRoutes).forEach(([path, status]) => {
  router.post(`/attendance/:id/${path}`, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const extra: Record<string, any> = {};
      if (status === 'late' && req.body.latenessMinutes)
        extra.latenessMinutes = Number(req.body.latenessMinutes);
      if (req.body.clockInTime) extra.clockInTime = req.body.clockInTime;
      if (req.body.clockOutTime) extra.clockOutTime = req.body.clockOutTime;
      if (req.body.absenceReason) extra.absenceReason = req.body.absenceReason;
      if (req.body.managerNotes) extra.managerNotes = req.body.managerNotes;
      const [row] = await db
        .update(shiftAttendanceLogs)
        .set({ attendanceStatus: status, ...extra, updatedAt: new Date() })
        .where(eq(shiftAttendanceLogs.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      handleError(res, err, `attendance/${path}`);
    }
  });
});

// ----------------------------------------------------------------
// REPLACEMENT
// ----------------------------------------------------------------

router.post('/attendance/:id/replace', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ replacementStaffId: z.number(), changedBy: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'replacementStaffId (number) required' });
    const updated = await replaceStaffOnShift(
      id,
      parsed.data.replacementStaffId,
      parsed.data.changedBy ?? 'manager'
    );
    res.json(updated);
  } catch (err) {
    handleError(res, err, 'replaceStaff');
  }
});

// ----------------------------------------------------------------
// CHANGE LOG
// ----------------------------------------------------------------

router.get('/rosters/:id/change-log', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(shiftChangeLog)
      .where(eq(shiftChangeLog.shiftRosterId, Number(req.params.id)))
      .orderBy(desc(shiftChangeLog.changedAt));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getChangeLog');
  }
});

export default router;
