/**
 * Staff Operations Service — Phase 1
 * All logic is configuration-driven; nothing is hardcoded to a specific
 * business, shift time, role, or cleaning task.
 */

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
  type InsertOperationsSettings,
  type InsertShiftRoster,
  type InsertShiftStaffAssignment,
  type InsertShiftAttendanceLog,
  type InsertShiftCleaningTask,
  type InsertShiftChangeLog,
} from "../../shared/schema";

const DEFAULT_LOCATION = 1;

// ----------------------------------------------------------------
// Settings
// ----------------------------------------------------------------

export async function getOperationsSettings(businessLocationId = DEFAULT_LOCATION) {
  const rows = await db
    .select()
    .from(operationsSettings)
    .where(eq(operationsSettings.businessLocationId, businessLocationId))
    .limit(1);

  if (rows.length > 0) return rows[0];

  // Auto-create defaults for first access
  const inserted = await db
    .insert(operationsSettings)
    .values({ businessLocationId })
    .returning();
  return inserted[0];
}

export async function updateOperationsSettings(
  businessLocationId = DEFAULT_LOCATION,
  data: Partial<InsertOperationsSettings>
) {
  const existing = await getOperationsSettings(businessLocationId);
  const updated = await db
    .update(operationsSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(operationsSettings.id, existing.id))
    .returning();
  return updated[0];
}

// ----------------------------------------------------------------
// Rosters
// ----------------------------------------------------------------

export async function createShiftRoster(data: InsertShiftRoster) {
  const inserted = await db.insert(shiftRosters).values(data).returning();
  const roster = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: roster.id,
    entityType: "roster",
    entityId: roster.id,
    changeType: "create",
    afterJson: roster,
    changedBy: data.createdBy ?? "system",
    reason: "Roster created",
  });

  return roster;
}

export async function updateShiftRoster(
  id: number,
  data: Partial<InsertShiftRoster>,
  changedBy = "system"
) {
  const before = await db.select().from(shiftRosters).where(eq(shiftRosters.id, id)).limit(1);
  const updated = await db
    .update(shiftRosters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shiftRosters.id, id))
    .returning();

  await writeShiftChangeLog({
    shiftRosterId: id,
    entityType: "roster",
    entityId: id,
    changeType: "update",
    beforeJson: before[0] ?? null,
    afterJson: updated[0],
    changedBy,
    reason: "Roster updated",
  });

  return updated[0];
}

// ----------------------------------------------------------------
// Assignments
// ----------------------------------------------------------------

export async function createShiftAssignment(
  data: InsertShiftStaffAssignment,
  changedBy = "system"
) {
  const inserted = await db.insert(shiftStaffAssignments).values(data).returning();
  const assignment = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: data.shiftRosterId,
    entityType: "assignment",
    entityId: assignment.id,
    changeType: "create",
    afterJson: assignment,
    changedBy,
    reason: "Staff assigned to shift",
  });

  return assignment;
}

export async function updateShiftAssignment(
  id: number,
  data: Partial<InsertShiftStaffAssignment>,
  changedBy = "system"
) {
  const before = await db.select().from(shiftStaffAssignments).where(eq(shiftStaffAssignments.id, id)).limit(1);
  const updated = await db
    .update(shiftStaffAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shiftStaffAssignments.id, id))
    .returning();

  if (before[0]) {
    await writeShiftChangeLog({
      shiftRosterId: before[0].shiftRosterId,
      entityType: "assignment",
      entityId: id,
      changeType: "update",
      beforeJson: before[0],
      afterJson: updated[0],
      changedBy,
      reason: "Assignment updated",
    });
  }

  return updated[0];
}

// ----------------------------------------------------------------
// Breaks — generated from settings config, not hardcoded constants
// ----------------------------------------------------------------

export async function generateBreaksForRoster(
  shiftRosterId: number,
  businessLocationId = DEFAULT_LOCATION
) {
  const settings = await getOperationsSettings(businessLocationId);
  const assignments = await db
    .select()
    .from(shiftStaffAssignments)
    .where(and(eq(shiftStaffAssignments.shiftRosterId, shiftRosterId), eq(shiftStaffAssignments.isOffDay, false)));

  const created: typeof shiftBreaks.$inferSelect[] = [];

  for (const assignment of assignments) {
    const [startH, startM] = assignment.scheduledStartTime.split(":").map(Number);
    const [endH, endM] = assignment.scheduledEndTime.split(":").map(Number);
    const totalMins = (endH * 60 + endM) - (startH * 60 + startM);

    // Main break: at ~midpoint
    if (totalMins > 0) {
      const midStart = startH * 60 + startM + Math.floor(totalMins / 2);
      const midEnd = midStart + settings.breakMainMinutes;
      const [mb] = await db.insert(shiftBreaks).values({
        shiftStaffAssignmentId: assignment.id,
        breakType: "main",
        plannedStartTime: minsToHHMM(midStart),
        plannedEndTime: minsToHHMM(midEnd),
      }).returning();
      created.push(mb);
    }

    // Short breaks: evenly spaced
    for (let i = 0; i < settings.breakShortCount; i++) {
      const offset = Math.floor(totalMins / (settings.breakShortCount + 1)) * (i + 1);
      const bStart = startH * 60 + startM + offset;
      const bEnd = bStart + settings.breakShortMinutes;
      const [sb] = await db.insert(shiftBreaks).values({
        shiftStaffAssignmentId: assignment.id,
        breakType: "short",
        plannedStartTime: minsToHHMM(bStart),
        plannedEndTime: minsToHHMM(bEnd),
      }).returning();
      created.push(sb);
    }
  }

  return created;
}

function minsToHHMM(totalMins: number) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ----------------------------------------------------------------
// Cleaning — generated from templates, not hardcoded task names
// ----------------------------------------------------------------

export async function generateCleaningTasksForRoster(
  shiftRosterId: number,
  businessLocationId = DEFAULT_LOCATION
) {
  const templates = await db
    .select()
    .from(cleaningTaskTemplates)
    .where(
      and(
        eq(cleaningTaskTemplates.businessLocationId, businessLocationId),
        eq(cleaningTaskTemplates.isActive, true),
        eq(cleaningTaskTemplates.taskType, "daily")
      )
    )
    .orderBy(asc(cleaningTaskTemplates.sortOrder));

  const tasks: InsertShiftCleaningTask[] = templates.map((t) => ({
    shiftRosterId,
    cleaningTaskTemplateId: t.id,
  }));

  if (tasks.length === 0) return [];

  return await db.insert(shiftCleaningTasks).values(tasks).returning();
}

// ----------------------------------------------------------------
// Attendance
// ----------------------------------------------------------------

export async function logAttendanceStatus(
  data: InsertShiftAttendanceLog,
  changedBy = "system"
) {
  const inserted = await db.insert(shiftAttendanceLogs).values(data).returning();
  const log = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: data.shiftRosterId,
    entityType: "attendance",
    entityId: log.id,
    changeType: "attendance",
    afterJson: log,
    changedBy,
    reason: `Attendance: ${data.attendanceStatus}`,
  });

  return log;
}

/**
 * Replace a staff member on a shift. Saves a snapshot of the original
 * assignment before creating the replacement attendance record.
 */
export async function replaceStaffOnShift(
  attendanceLogId: number,
  replacementStaffId: number,
  changedBy = "system"
) {
  const [log] = await db
    .select()
    .from(shiftAttendanceLogs)
    .where(eq(shiftAttendanceLogs.id, attendanceLogId))
    .limit(1);

  if (!log) throw new Error(`Attendance log ${attendanceLogId} not found`);

  // Snapshot the original assignment for audit
  const [originalAssignment] = await db
    .select()
    .from(shiftStaffAssignments)
    .where(eq(shiftStaffAssignments.id, log.shiftStaffAssignmentId))
    .limit(1);

  await db
    .update(shiftStaffAssignments)
    .set({ originalAssignmentSnapshot: originalAssignment, updatedAt: new Date() })
    .where(eq(shiftStaffAssignments.id, log.shiftStaffAssignmentId));

  // Mark original as sick/replaced
  const [updated] = await db
    .update(shiftAttendanceLogs)
    .set({ attendanceStatus: "replaced", replacementStaffId, updatedAt: new Date() })
    .where(eq(shiftAttendanceLogs.id, attendanceLogId))
    .returning();

  await writeShiftChangeLog({
    shiftRosterId: log.shiftRosterId,
    entityType: "attendance",
    entityId: attendanceLogId,
    changeType: "replace",
    beforeJson: log,
    afterJson: updated,
    changedBy,
    reason: `Replaced by staff #${replacementStaffId}`,
  });

  return updated;
}

// ----------------------------------------------------------------
// Change log
// ----------------------------------------------------------------

export async function writeShiftChangeLog(data: InsertShiftChangeLog) {
  return await db.insert(shiftChangeLog).values(data).returning();
}
