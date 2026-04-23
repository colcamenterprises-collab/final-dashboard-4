/**
 * Staff Operations Routes — Phase 1
 * Mounted at: /api/operations/staff
 *
 * Multi-business / multi-location ready. businessLocationId defaults
 * to 1 for single-location deployments and is passed on every query.
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  operationsSettings,
  operatingHours,
  workAreas,
  shiftTemplates,
  staffMembers,
  staffAvailability,
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
  insertStaffMemberSchema,
  insertStaffAvailabilitySchema,
  insertShiftRosterSchema,
  insertShiftStaffAssignmentSchema,
  insertShiftBreakSchema,
  insertCleaningTaskTemplateSchema,
  insertShiftCleaningTaskSchema,
  insertDeepCleaningTaskSchema,
  insertShiftAttendanceLogSchema,
} from "../../shared/schema";
import {
  getOperationsSettings,
  updateOperationsSettings,
  createShiftRoster,
  updateShiftRoster,
  createShiftAssignment,
  updateShiftAssignment,
  generateBreaksForRoster,
  generateCleaningTasksForRoster,
  logAttendanceStatus,
  replaceStaffOnShift,
  writeShiftChangeLog,
} from "../services/staffOpsService";

const router = Router();

const DEFAULT_LOCATION = 1;

function getLocationId(req: any): number {
  return Number(req.query.locationId ?? req.body?.businessLocationId ?? DEFAULT_LOCATION);
}

function handleError(res: any, err: unknown, context: string) {
  console.error(`[STAFF_OPS] ${context}:`, err);
  res.status(500).json({ error: `Failed: ${context}`, detail: String(err) });
}

// ----------------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------------

router.get("/settings", async (req, res) => {
  try {
    const data = await getOperationsSettings(getLocationId(req));
    res.json(data);
  } catch (err) { handleError(res, err, "getSettings"); }
});

router.patch("/settings", async (req, res) => {
  try {
    const parsed = insertOperationsSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const data = await updateOperationsSettings(getLocationId(req), parsed.data);
    res.json(data);
  } catch (err) { handleError(res, err, "updateSettings"); }
});

// ----------------------------------------------------------------
// OPERATING HOURS
// ----------------------------------------------------------------

router.get("/operating-hours", async (req, res) => {
  try {
    const rows = await db.select().from(operatingHours)
      .where(eq(operatingHours.businessLocationId, getLocationId(req)))
      .orderBy(asc(operatingHours.dayOfWeek));
    res.json(rows);
  } catch (err) { handleError(res, err, "getOperatingHours"); }
});

router.post("/operating-hours", async (req, res) => {
  try {
    const parsed = insertOperatingHoursSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(operatingHours).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createOperatingHours"); }
});

router.patch("/operating-hours/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertOperatingHoursSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(operatingHours).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(operatingHours.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateOperatingHours"); }
});

// ----------------------------------------------------------------
// WORK AREAS
// ----------------------------------------------------------------

router.get("/work-areas", async (req, res) => {
  try {
    const rows = await db.select().from(workAreas)
      .where(eq(workAreas.businessLocationId, getLocationId(req)))
      .orderBy(asc(workAreas.sortOrder), asc(workAreas.name));
    res.json(rows);
  } catch (err) { handleError(res, err, "getWorkAreas"); }
});

router.post("/work-areas", async (req, res) => {
  try {
    const parsed = insertWorkAreaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(workAreas).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createWorkArea"); }
});

router.patch("/work-areas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertWorkAreaSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(workAreas).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(workAreas.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateWorkArea"); }
});

router.delete("/work-areas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(workAreas).where(eq(workAreas.id, id));
    res.json({ ok: true });
  } catch (err) { handleError(res, err, "deleteWorkArea"); }
});

// ----------------------------------------------------------------
// SHIFT TEMPLATES
// ----------------------------------------------------------------

router.get("/shift-templates", async (req, res) => {
  try {
    const rows = await db.select().from(shiftTemplates)
      .where(eq(shiftTemplates.businessLocationId, getLocationId(req)))
      .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.templateName));
    res.json(rows);
  } catch (err) { handleError(res, err, "getShiftTemplates"); }
});

router.post("/shift-templates", async (req, res) => {
  try {
    const parsed = insertShiftTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(shiftTemplates).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createShiftTemplate"); }
});

router.patch("/shift-templates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(shiftTemplates).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateShiftTemplate"); }
});

router.delete("/shift-templates/:id", async (req, res) => {
  try {
    await db.delete(shiftTemplates).where(eq(shiftTemplates.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) { handleError(res, err, "deleteShiftTemplate"); }
});

// ----------------------------------------------------------------
// STAFF MEMBERS
// ----------------------------------------------------------------

router.get("/members", async (req, res) => {
  try {
    const rows = await db.select().from(staffMembers)
      .where(eq(staffMembers.businessLocationId, getLocationId(req)))
      .orderBy(asc(staffMembers.fullName));
    res.json(rows);
  } catch (err) { handleError(res, err, "getStaffMembers"); }
});

router.get("/members/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(staffMembers).where(eq(staffMembers.id, Number(req.params.id))).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "getStaffMember"); }
});

router.post("/members", async (req, res) => {
  try {
    const parsed = insertStaffMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(staffMembers).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createStaffMember"); }
});

router.patch("/members/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertStaffMemberSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(staffMembers).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(staffMembers.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateStaffMember"); }
});

router.patch("/members/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "isActive (boolean) required" });
    const [row] = await db.update(staffMembers).set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(staffMembers.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateStaffMemberStatus"); }
});

// ----------------------------------------------------------------
// STAFF AVAILABILITY
// ----------------------------------------------------------------

router.get("/availability", async (req, res) => {
  try {
    const staffMemberId = req.query.staffMemberId ? Number(req.query.staffMemberId) : undefined;
    const query = db.select().from(staffAvailability);
    const rows = staffMemberId
      ? await query.where(eq(staffAvailability.staffMemberId, staffMemberId)).orderBy(asc(staffAvailability.dayOfWeek))
      : await query.orderBy(asc(staffAvailability.staffMemberId), asc(staffAvailability.dayOfWeek));
    res.json(rows);
  } catch (err) { handleError(res, err, "getStaffAvailability"); }
});

router.post("/availability", async (req, res) => {
  try {
    const parsed = insertStaffAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(staffAvailability).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createStaffAvailability"); }
});

router.patch("/availability/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertStaffAvailabilitySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(staffAvailability).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(staffAvailability.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateStaffAvailability"); }
});

// ----------------------------------------------------------------
// ROSTERS
// ----------------------------------------------------------------

router.get("/rosters", async (req, res) => {
  try {
    const rows = await db.select().from(shiftRosters)
      .where(eq(shiftRosters.businessLocationId, getLocationId(req)))
      .orderBy(desc(shiftRosters.shiftDate), asc(shiftRosters.shiftStartTime));
    res.json(rows);
  } catch (err) { handleError(res, err, "getRosters"); }
});

router.get("/rosters/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(shiftRosters).where(eq(shiftRosters.id, Number(req.params.id))).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "getRoster"); }
});

router.post("/rosters", async (req, res) => {
  try {
    const parsed = insertShiftRosterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const roster = await createShiftRoster(parsed.data);
    res.status(201).json(roster);
  } catch (err) { handleError(res, err, "createRoster"); }
});

router.patch("/rosters/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftRosterSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const roster = await updateShiftRoster(id, parsed.data, req.body.changedBy ?? "manager");
    res.json(roster);
  } catch (err) { handleError(res, err, "updateRoster"); }
});

// ----------------------------------------------------------------
// ASSIGNMENTS
// ----------------------------------------------------------------

router.post("/rosters/:id/assignments", async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const parsed = insertShiftStaffAssignmentSchema.safeParse({ ...req.body, shiftRosterId });
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const assignment = await createShiftAssignment(parsed.data, req.body.changedBy ?? "manager");
    res.status(201).json(assignment);
  } catch (err) { handleError(res, err, "createAssignment"); }
});

router.patch("/assignments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftStaffAssignmentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const assignment = await updateShiftAssignment(id, parsed.data, req.body.changedBy ?? "manager");
    res.json(assignment);
  } catch (err) { handleError(res, err, "updateAssignment"); }
});

router.delete("/assignments/:id", async (req, res) => {
  try {
    await db.delete(shiftStaffAssignments).where(eq(shiftStaffAssignments.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) { handleError(res, err, "deleteAssignment"); }
});

// ----------------------------------------------------------------
// BREAKS
// ----------------------------------------------------------------

router.post("/rosters/:id/breaks/auto-generate", async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const locationId = getLocationId(req);
    const breaks = await generateBreaksForRoster(shiftRosterId, locationId);
    res.status(201).json(breaks);
  } catch (err) { handleError(res, err, "autoGenerateBreaks"); }
});

router.get("/assignments/:id/breaks", async (req, res) => {
  try {
    const rows = await db.select().from(shiftBreaks)
      .where(eq(shiftBreaks.shiftStaffAssignmentId, Number(req.params.id)))
      .orderBy(asc(shiftBreaks.plannedStartTime));
    res.json(rows);
  } catch (err) { handleError(res, err, "getBreaks"); }
});

router.post("/assignments/:id/breaks", async (req, res) => {
  try {
    const shiftStaffAssignmentId = Number(req.params.id);
    const parsed = insertShiftBreakSchema.safeParse({ ...req.body, shiftStaffAssignmentId });
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(shiftBreaks).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createBreak"); }
});

router.patch("/breaks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftBreakSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(shiftBreaks).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftBreaks.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateBreak"); }
});

router.delete("/breaks/:id", async (req, res) => {
  try {
    await db.delete(shiftBreaks).where(eq(shiftBreaks.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) { handleError(res, err, "deleteBreak"); }
});

// ----------------------------------------------------------------
// CLEANING TEMPLATES
// ----------------------------------------------------------------

router.get("/cleaning/templates", async (req, res) => {
  try {
    const rows = await db.select().from(cleaningTaskTemplates)
      .where(eq(cleaningTaskTemplates.businessLocationId, getLocationId(req)))
      .orderBy(asc(cleaningTaskTemplates.sortOrder), asc(cleaningTaskTemplates.taskName));
    res.json(rows);
  } catch (err) { handleError(res, err, "getCleaningTemplates"); }
});

router.post("/cleaning/templates", async (req, res) => {
  try {
    const parsed = insertCleaningTaskTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(cleaningTaskTemplates).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createCleaningTemplate"); }
});

router.patch("/cleaning/templates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertCleaningTaskTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(cleaningTaskTemplates).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cleaningTaskTemplates.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateCleaningTemplate"); }
});

// ----------------------------------------------------------------
// CLEANING TASKS (per roster)
// ----------------------------------------------------------------

router.get("/rosters/:id/cleaning", async (req, res) => {
  try {
    const rows = await db.select().from(shiftCleaningTasks)
      .where(eq(shiftCleaningTasks.shiftRosterId, Number(req.params.id)))
      .orderBy(asc(shiftCleaningTasks.id));
    res.json(rows);
  } catch (err) { handleError(res, err, "getRosterCleaning"); }
});

router.post("/rosters/:id/cleaning/generate", async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const locationId = getLocationId(req);
    const tasks = await generateCleaningTasksForRoster(shiftRosterId, locationId);
    res.status(201).json(tasks);
  } catch (err) { handleError(res, err, "generateCleaningTasks"); }
});

router.patch("/cleaning/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftCleaningTaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(shiftCleaningTasks).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftCleaningTasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateCleaningTask"); }
});

// ----------------------------------------------------------------
// DEEP CLEANING
// ----------------------------------------------------------------

router.get("/deep-cleaning", async (req, res) => {
  try {
    const rows = await db.select().from(deepCleaningTasks)
      .where(eq(deepCleaningTasks.businessLocationId, getLocationId(req)))
      .orderBy(asc(deepCleaningTasks.dueDate));
    res.json(rows);
  } catch (err) { handleError(res, err, "getDeepCleaning"); }
});

router.post("/deep-cleaning", async (req, res) => {
  try {
    const parsed = insertDeepCleaningTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.insert(deepCleaningTasks).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { handleError(res, err, "createDeepCleaning"); }
});

router.patch("/deep-cleaning/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertDeepCleaningTaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(deepCleaningTasks).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(deepCleaningTasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateDeepCleaning"); }
});

router.post("/deep-cleaning/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.update(deepCleaningTasks)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(deepCleaningTasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "completeDeepCleaning"); }
});

router.post("/deep-cleaning/:id/rollover", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(deepCleaningTasks).where(eq(deepCleaningTasks.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const newDueDate = req.body.newDueDate ?? existing.dueDate;
    const [row] = await db.update(deepCleaningTasks)
      .set({ status: "rolled_over", dueDate: newDueDate, rolloverCount: (existing.rolloverCount ?? 0) + 1, updatedAt: new Date() })
      .where(eq(deepCleaningTasks.id, id)).returning();
    res.json(row);
  } catch (err) { handleError(res, err, "rolloverDeepCleaning"); }
});

// ----------------------------------------------------------------
// ATTENDANCE
// ----------------------------------------------------------------

router.get("/rosters/:id/attendance", async (req, res) => {
  try {
    const rows = await db.select().from(shiftAttendanceLogs)
      .where(eq(shiftAttendanceLogs.shiftRosterId, Number(req.params.id)))
      .orderBy(desc(shiftAttendanceLogs.createdAt));
    res.json(rows);
  } catch (err) { handleError(res, err, "getRosterAttendance"); }
});

router.post("/rosters/:id/attendance", async (req, res) => {
  try {
    const shiftRosterId = Number(req.params.id);
    const parsed = insertShiftAttendanceLogSchema.safeParse({ ...req.body, shiftRosterId });
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const log = await logAttendanceStatus(parsed.data, req.body.changedBy ?? "manager");
    res.status(201).json(log);
  } catch (err) { handleError(res, err, "createAttendance"); }
});

router.patch("/attendance/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertShiftAttendanceLogSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const [row] = await db.update(shiftAttendanceLogs).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shiftAttendanceLogs.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { handleError(res, err, "updateAttendance"); }
});

// Convenience status setters
const statusRoutes: Record<string, typeof shiftAttendanceLogs.$inferSelect["attendanceStatus"]> = {
  "mark-present": "present",
  "mark-late": "late",
  "mark-sick": "sick",
  "mark-absent": "absent",
  "mark-left-early": "left_early",
};

Object.entries(statusRoutes).forEach(([path, status]) => {
  router.post(`/attendance/:id/${path}`, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const extra: Record<string, any> = {};
      if (status === "late" && req.body.latenessMinutes) extra.latenessMinutes = Number(req.body.latenessMinutes);
      if (req.body.clockInTime) extra.clockInTime = req.body.clockInTime;
      if (req.body.clockOutTime) extra.clockOutTime = req.body.clockOutTime;
      if (req.body.absenceReason) extra.absenceReason = req.body.absenceReason;
      if (req.body.managerNotes) extra.managerNotes = req.body.managerNotes;
      const [row] = await db.update(shiftAttendanceLogs)
        .set({ attendanceStatus: status, ...extra, updatedAt: new Date() })
        .where(eq(shiftAttendanceLogs.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err) { handleError(res, err, `attendance/${path}`); }
  });
});

// ----------------------------------------------------------------
// REPLACEMENT
// ----------------------------------------------------------------

router.post("/attendance/:id/replace", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ replacementStaffId: z.number(), changedBy: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "replacementStaffId (number) required" });
    const updated = await replaceStaffOnShift(id, parsed.data.replacementStaffId, parsed.data.changedBy ?? "manager");
    res.json(updated);
  } catch (err) { handleError(res, err, "replaceStaff"); }
});

// ----------------------------------------------------------------
// CHANGE LOG
// ----------------------------------------------------------------

router.get("/rosters/:id/change-log", async (req, res) => {
  try {
    const rows = await db.select().from(shiftChangeLog)
      .where(eq(shiftChangeLog.shiftRosterId, Number(req.params.id)))
      .orderBy(desc(shiftChangeLog.changedAt));
    res.json(rows);
  } catch (err) { handleError(res, err, "getChangeLog"); }
});

export default router;
