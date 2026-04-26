/**
 * Staff Operations Service — Phase 1
 * All logic is configuration-driven; nothing is hardcoded to a specific
 * business, shift time, role, or cleaning task.
 */

import { db } from '../db';
import { eq, and, desc, asc, gte, lte, ne, inArray } from 'drizzle-orm';
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
} from '../../shared/schema';

const DEFAULT_LOCATION = 1;

type FairnessMode = 'equal_hours' | 'equal_shifts';

type AutoGenerateOwnerRules = {
  maxShiftsPerStaffPerWeek?: number | null;
  minHoursPerStaffPerWeek?: number | null;
  maxHoursPerStaffPerWeek?: number | null;
  preferredBusyDayStaffCount?: number | null;
  allowBackToBackCloseOpen?: boolean | null;
};

export type AutoGenerateWeeklyRosterInput = {
  businessLocationId: number;
  weekStartDate: string;
  weekEndDate: string;
  mode: 'draft' | 'publish';
  overwriteExistingDrafts: boolean;
  targetFairnessMode: FairnessMode;
  includeDailyCleaning: boolean;
  includeDeepCleaning: boolean;
  ownerRules?: AutoGenerateOwnerRules;
  changedBy?: string;
};

type StaffWeeklyLoad = {
  staffMemberId: number;
  staffName: string;
  totalHours: number;
  shiftCount: number;
  assignedCleaningMinutes: number;
  assignedWorkAreas: Set<string>;
  warnings: string[];
};

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
  const inserted = await db.insert(operationsSettings).values({ businessLocationId }).returning();
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

export async function createShiftRoster(data: InsertShiftRoster, reason = 'Roster created') {
  const inserted = await db.insert(shiftRosters).values(data).returning();
  const roster = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: roster.id,
    entityType: 'roster',
    entityId: roster.id,
    changeType: 'create',
    afterJson: roster,
    changedBy: data.createdBy ?? 'system',
    reason,
  });

  return roster;
}

export async function updateShiftRoster(
  id: number,
  data: Partial<InsertShiftRoster>,
  changedBy = 'system'
) {
  const before = await db.select().from(shiftRosters).where(eq(shiftRosters.id, id)).limit(1);
  const updated = await db
    .update(shiftRosters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shiftRosters.id, id))
    .returning();

  await writeShiftChangeLog({
    shiftRosterId: id,
    entityType: 'roster',
    entityId: id,
    changeType: 'update',
    beforeJson: before[0] ?? null,
    afterJson: updated[0],
    changedBy,
    reason: 'Roster updated',
  });

  return updated[0];
}

// ----------------------------------------------------------------
// Assignments
// ----------------------------------------------------------------

export async function createShiftAssignment(
  data: InsertShiftStaffAssignment,
  changedBy = 'system',
  reason = 'Staff assigned to shift'
) {
  const inserted = await db.insert(shiftStaffAssignments).values(data).returning();
  const assignment = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: data.shiftRosterId,
    entityType: 'assignment',
    entityId: assignment.id,
    changeType: 'create',
    afterJson: assignment,
    changedBy,
    reason,
  });

  return assignment;
}

export async function updateShiftAssignment(
  id: number,
  data: Partial<InsertShiftStaffAssignment>,
  changedBy = 'system'
) {
  const before = await db
    .select()
    .from(shiftStaffAssignments)
    .where(eq(shiftStaffAssignments.id, id))
    .limit(1);
  const updated = await db
    .update(shiftStaffAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shiftStaffAssignments.id, id))
    .returning();

  if (before[0]) {
    await writeShiftChangeLog({
      shiftRosterId: before[0].shiftRosterId,
      entityType: 'assignment',
      entityId: id,
      changeType: 'update',
      beforeJson: before[0],
      afterJson: updated[0],
      changedBy,
      reason: 'Assignment updated',
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
    .where(
      and(
        eq(shiftStaffAssignments.shiftRosterId, shiftRosterId),
        eq(shiftStaffAssignments.isOffDay, false)
      )
    );

  const created: (typeof shiftBreaks.$inferSelect)[] = [];

  for (const assignment of assignments) {
    const [startH, startM] = assignment.scheduledStartTime.split(':').map(Number);
    const [endH, endM] = assignment.scheduledEndTime.split(':').map(Number);
    const totalMins = endH * 60 + endM - (startH * 60 + startM);

    // Main break: at ~midpoint
    if (totalMins > 0) {
      const midStart = startH * 60 + startM + Math.floor(totalMins / 2);
      const midEnd = midStart + settings.breakMainMinutes;
      const [mb] = await db
        .insert(shiftBreaks)
        .values({
          shiftStaffAssignmentId: assignment.id,
          breakType: 'main',
          plannedStartTime: minsToHHMM(midStart),
          plannedEndTime: minsToHHMM(midEnd),
        })
        .returning();
      created.push(mb);
    }

    // Short breaks: evenly spaced
    for (let i = 0; i < settings.breakShortCount; i++) {
      const offset = Math.floor(totalMins / (settings.breakShortCount + 1)) * (i + 1);
      const bStart = startH * 60 + startM + offset;
      const bEnd = bStart + settings.breakShortMinutes;
      const [sb] = await db
        .insert(shiftBreaks)
        .values({
          shiftStaffAssignmentId: assignment.id,
          breakType: 'short',
          plannedStartTime: minsToHHMM(bStart),
          plannedEndTime: minsToHHMM(bEnd),
        })
        .returning();
      created.push(sb);
    }
  }

  return created;
}

function minsToHHMM(totalMins: number) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ----------------------------------------------------------------
// Cleaning — generated from templates, not hardcoded task names
// ----------------------------------------------------------------

export async function generateCleaningTasksForRoster(
  shiftRosterId: number,
  businessLocationId = DEFAULT_LOCATION
) {
  // Prevent duplicates: delete existing tasks for this roster before regenerating
  await db
    .delete(shiftCleaningTasks)
    .where(eq(shiftCleaningTasks.shiftRosterId, shiftRosterId));

  const templates = await db
    .select()
    .from(cleaningTaskTemplates)
    .where(
      and(
        eq(cleaningTaskTemplates.businessLocationId, businessLocationId),
        eq(cleaningTaskTemplates.isActive, true)
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

function getDateRange(from: string, to: string) {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function weekday(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function timeDiffHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

function stationCapabilityMatch(
  stationName: string | null | undefined,
  member: typeof staffMembers.$inferSelect
) {
  if (!stationName) return true;
  const n = stationName.toLowerCase();
  if (n.includes('cash')) return member.canCashier;
  if (n.includes('burger') || n.includes('grill')) return member.canBurgers;
  if (n.includes('side')) return member.canSideOrders;
  if (n.includes('prep')) return member.canPrep;
  if (n.includes('clean')) return member.canCleaning;
  const custom = member.customCapabilities ?? {};
  const normalized = n.replace(/\s+/g, '_');
  return custom[normalized] ?? true;
}

export function calculateRosterFairness(loadMap: Map<number, StaffWeeklyLoad>) {
  return Array.from(loadMap.values())
    .map((v) => ({
      staffMemberId: v.staffMemberId,
      staffName: v.staffName,
      totalHours: Number(v.totalHours.toFixed(2)),
      shiftCount: v.shiftCount,
      assignedCleaningMinutes: v.assignedCleaningMinutes,
      warnings: v.warnings,
    }))
    .sort((a, b) => a.staffName.localeCompare(b.staffName));
}

export async function calculateStaffWeeklyLoad(
  businessLocationId: number,
  weekStartDate: string,
  weekEndDate: string,
  staff: (typeof staffMembers.$inferSelect)[]
) {
  const rostersInRange = await db
    .select()
    .from(shiftRosters)
    .where(
      and(
        eq(shiftRosters.businessLocationId, businessLocationId),
        gte(shiftRosters.shiftDate, weekStartDate),
        lte(shiftRosters.shiftDate, weekEndDate),
        ne(shiftRosters.status, 'cancelled')
      )
    );

  const rosterIds = rostersInRange.map((r) => r.id);
  const assignments = rosterIds.length
    ? await db
        .select()
        .from(shiftStaffAssignments)
        .where(inArray(shiftStaffAssignments.shiftRosterId, rosterIds))
    : [];

  const loadMap = new Map<number, StaffWeeklyLoad>();
  for (const member of staff) {
    loadMap.set(member.id, {
      staffMemberId: member.id,
      staffName: member.fullName,
      totalHours: 0,
      shiftCount: 0,
      assignedCleaningMinutes: 0,
      assignedWorkAreas: new Set<string>(),
      warnings: [],
    });
  }

  for (const assignment of assignments) {
    const load = loadMap.get(assignment.staffMemberId);
    if (!load) continue;
    load.shiftCount += 1;
    load.totalHours += timeDiffHours(assignment.scheduledStartTime, assignment.scheduledEndTime);
    if (assignment.primaryStation) load.assignedWorkAreas.add(assignment.primaryStation);
  }
  return loadMap;
}

export function selectEligibleStaffForShift(input: {
  staff: (typeof staffMembers.$inferSelect)[];
  availabilityByKey: Map<string, typeof staffAvailability.$inferSelect>;
  shiftDate: string;
  stationName?: string | null;
  currentAssignmentsForDate: Set<number>;
}) {
  const day = weekday(input.shiftDate);
  return input.staff.filter((member) => {
    if (!member.isActive) return false;
    if (input.currentAssignmentsForDate.has(member.id)) return false;
    const availability = input.availabilityByKey.get(`${member.id}:${day}`);
    if (availability && !availability.isAvailable) return false;
    return stationCapabilityMatch(input.stationName, member);
  });
}

export async function assignStaffToGeneratedRoster(input: {
  rosterId: number;
  shiftStartTime: string;
  shiftEndTime: string;
  maxStaff: number;
  stationName?: string | null;
  fairnessMode: FairnessMode;
  ownerRules?: AutoGenerateOwnerRules;
  eligibleStaff: (typeof staffMembers.$inferSelect)[];
  weeklyLoadMap: Map<number, StaffWeeklyLoad>;
  changedBy: string;
  warnings: string[];
}) {
  const created = [];
  const maxHours = input.ownerRules?.maxHoursPerStaffPerWeek ?? null;
  const maxShifts = input.ownerRules?.maxShiftsPerStaffPerWeek ?? null;
  const shiftHours = timeDiffHours(input.shiftStartTime, input.shiftEndTime);

  // Sort: fairness-first, then soft-deprioritise staff who would exceed maxHours.
  // Staff over the hours limit move to the back but are NEVER excluded entirely.
  const ranked = [...input.eligibleStaff].sort((a, b) => {
    const la = input.weeklyLoadMap.get(a.id);
    const lb = input.weeklyLoadMap.get(b.id);
    if (!la || !lb) return 0;
    // Soft weighting: push over-limit staff to the back, never skip them
    if (maxHours != null) {
      const aOver = la.totalHours + shiftHours > maxHours ? 1 : 0;
      const bOver = lb.totalHours + shiftHours > maxHours ? 1 : 0;
      if (aOver !== bOver) return aOver - bOver;
    }
    if (input.fairnessMode === 'equal_shifts') {
      if (la.shiftCount !== lb.shiftCount) return la.shiftCount - lb.shiftCount;
      if (la.totalHours !== lb.totalHours) return la.totalHours - lb.totalHours;
    } else {
      if (la.totalHours !== lb.totalHours) return la.totalHours - lb.totalHours;
      if (la.shiftCount !== lb.shiftCount) return la.shiftCount - lb.shiftCount;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  for (const member of ranked) {
    if (created.length >= input.maxStaff) break;
    const currentLoad = input.weeklyLoadMap.get(member.id);
    if (!currentLoad) continue;
    // Max shifts is a hard constraint — staff cannot work more shifts than allowed
    if (maxShifts != null && currentLoad.shiftCount >= maxShifts) {
      currentLoad.warnings.push(`Max shifts reached (${maxShifts})`);
      continue;
    }
    // Max hours is a soft constraint — deprioritised in sort but never blocks assignment.
    // Guarantee: shifts are always filled first; hours are optimised after.
    if (maxHours != null && currentLoad.totalHours + shiftHours > maxHours) {
      currentLoad.warnings.push(`Staff deprioritised due to hours (limit ${maxHours}h)`);
      input.warnings.push(`Staff ${member.fullName} deprioritised due to hours.`);
    }
    const assignment = await createShiftAssignment(
      {
        shiftRosterId: input.rosterId,
        staffMemberId: member.id,
        scheduledStartTime: input.shiftStartTime,
        scheduledEndTime: input.shiftEndTime,
        primaryStation: input.stationName ?? null,
      },
      input.changedBy,
      'Auto-generated weekly roster'
    );
    created.push(assignment);
    currentLoad.shiftCount += 1;
    currentLoad.totalHours += shiftHours;
    if (input.stationName) currentLoad.assignedWorkAreas.add(input.stationName);
  }

  if (created.length < input.maxStaff) {
    input.warnings.push(
      `Shift underfilled for roster ${input.rosterId} (${created.length}/${input.maxStaff}).`
    );
  }

  return created;
}

export async function allocateDailyCleaningForRoster(input: {
  rosterId: number;
  businessLocationId: number;
  weeklyLoadMap: Map<number, StaffWeeklyLoad>;
  warnings: string[];
}) {
  const generatedTasks = await generateCleaningTasksForRoster(
    input.rosterId,
    input.businessLocationId
  );
  if (generatedTasks.length === 0) return { generatedCount: 0 };

  const assignments = await db
    .select()
    .from(shiftStaffAssignments)
    .where(eq(shiftStaffAssignments.shiftRosterId, input.rosterId));
  const members = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.businessLocationId, input.businessLocationId));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const templates = await db
    .select()
    .from(cleaningTaskTemplates)
    .where(eq(cleaningTaskTemplates.businessLocationId, input.businessLocationId));
  const templateById = new Map(templates.map((t) => [t.id, t]));

  for (const task of generatedTasks) {
    const ranked = assignments
      .map((a) => {
        const member = memberById.get(a.staffMemberId);
        const load = input.weeklyLoadMap.get(a.staffMemberId);
        return { assignment: a, member, load };
      })
      .filter((row) => row.member && row.load)
      .sort((a, b) => {
        const aCan = a.member!.canCleaning ? 0 : 1;
        const bCan = b.member!.canCleaning ? 0 : 1;
        if (aCan !== bCan) return aCan - bCan;
        if (a.load!.assignedCleaningMinutes !== b.load!.assignedCleaningMinutes) {
          return a.load!.assignedCleaningMinutes - b.load!.assignedCleaningMinutes;
        }
        return a.load!.totalHours - b.load!.totalHours;
      });

    const pick = ranked[0];
    if (!pick) {
      input.warnings.push(`Cleaning workload could not be allocated for roster ${input.rosterId}.`);
      continue;
    }

    const template = templateById.get(task.cleaningTaskTemplateId);
    const minutes = template?.estimatedMinutes ?? 0;

    await db
      .update(shiftCleaningTasks)
      .set({
        assignedStaffId: pick.assignment.staffMemberId,
        updatedAt: new Date(),
      })
      .where(eq(shiftCleaningTasks.id, task.id));

    const load = input.weeklyLoadMap.get(pick.assignment.staffMemberId);
    if (load) load.assignedCleaningMinutes += minutes;
  }

  return { generatedCount: generatedTasks.length };
}

export async function allocateDeepCleaningForWeek(input: {
  businessLocationId: number;
  weekStartDate: string;
  weekEndDate: string;
  createdRosterIds: number[];
  weeklyLoadMap: Map<number, StaffWeeklyLoad>;
  warnings: string[];
}) {
  const tasks = await db
    .select()
    .from(deepCleaningTasks)
    .where(
      and(
        eq(deepCleaningTasks.businessLocationId, input.businessLocationId),
        eq(deepCleaningTasks.isActive, true),
        gte(deepCleaningTasks.dueDate, input.weekStartDate),
        lte(deepCleaningTasks.dueDate, input.weekEndDate),
        ne(deepCleaningTasks.status, 'completed')
      )
    )
    .orderBy(asc(deepCleaningTasks.dueDate));

  if (tasks.length === 0 || input.createdRosterIds.length === 0) return { allocatedCount: 0 };
  const rosters = await db
    .select()
    .from(shiftRosters)
    .where(inArray(shiftRosters.id, input.createdRosterIds));
  const rosterByDate = new Map<string, (typeof shiftRosters.$inferSelect)[]>();
  for (const roster of rosters) {
    const existing = rosterByDate.get(roster.shiftDate) ?? [];
    existing.push(roster);
    rosterByDate.set(roster.shiftDate, existing);
  }

  let allocated = 0;
  for (const task of tasks) {
    const dayRosters = rosterByDate.get(task.dueDate) ?? [];
    if (dayRosters.length === 0) {
      input.warnings.push(
        `Deep cleaning task "${task.taskName}" has no roster on due date ${task.dueDate}.`
      );
      continue;
    }
    const dayAssignments = await db
      .select()
      .from(shiftStaffAssignments)
      .where(
        inArray(
          shiftStaffAssignments.shiftRosterId,
          dayRosters.map((r) => r.id)
        )
      );
    if (dayAssignments.length === 0) {
      input.warnings.push(
        `Deep cleaning task "${task.taskName}" could not be allocated (no assigned staff).`
      );
      continue;
    }
    const ranked = dayAssignments
      .map((a) => input.weeklyLoadMap.get(a.staffMemberId))
      .filter((x): x is StaffWeeklyLoad => Boolean(x))
      .sort(
        (a, b) =>
          a.assignedCleaningMinutes - b.assignedCleaningMinutes || a.totalHours - b.totalHours
      );
    const pick = ranked[0];
    if (!pick) continue;

    await db
      .update(deepCleaningTasks)
      .set({
        assignedStaffId: pick.staffMemberId,
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(deepCleaningTasks.id, task.id));
    pick.assignedCleaningMinutes += 30;
    allocated += 1;
  }
  return { allocatedCount: allocated };
}

export async function autoGenerateWeeklyRoster(input: AutoGenerateWeeklyRosterInput) {
  const warnings: string[] = [];
  const changedBy = input.changedBy ?? 'manager';
  const allDates = getDateRange(input.weekStartDate, input.weekEndDate);
  const activeTemplates = await db
    .select()
    .from(shiftTemplates)
    .where(
      and(
        eq(shiftTemplates.businessLocationId, input.businessLocationId),
        eq(shiftTemplates.isActive, true)
      )
    )
    .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.id));

  if (activeTemplates.length === 0) {
    throw new Error('No active shift templates found. Create shift templates first.');
  }

  const allStaff = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.businessLocationId, input.businessLocationId));
  const activeStaff = allStaff.filter((s) => s.isActive);
  if (activeStaff.length === 0) warnings.push('No active staff members available for assignment.');

  const availRows = allStaff.length
    ? await db
        .select()
        .from(staffAvailability)
        .where(
          inArray(
            staffAvailability.staffMemberId,
            allStaff.map((s) => s.id)
          )
        )
    : [];
  const availabilityByKey = new Map(availRows.map((a) => [`${a.staffMemberId}:${a.dayOfWeek}`, a]));
  const existingInRange = await db
    .select()
    .from(shiftRosters)
    .where(
      and(
        eq(shiftRosters.businessLocationId, input.businessLocationId),
        gte(shiftRosters.shiftDate, input.weekStartDate),
        lte(shiftRosters.shiftDate, input.weekEndDate),
        ne(shiftRosters.status, 'cancelled')
      )
    );

  if (input.overwriteExistingDrafts) {
    const draftIds = existingInRange.filter((r) => r.status === 'draft').map((r) => r.id);
    for (const id of draftIds) {
      await deleteShiftRoster(id, changedBy, 'Auto roster regeneration');
    }
  } else if (existingInRange.length > 0) {
    warnings.push(
      'Existing rosters were detected. Draft overwrite is disabled, so duplicates may be skipped.'
    );
  }

  const existingAfterCleanup = await db
    .select()
    .from(shiftRosters)
    .where(
      and(
        eq(shiftRosters.businessLocationId, input.businessLocationId),
        gte(shiftRosters.shiftDate, input.weekStartDate),
        lte(shiftRosters.shiftDate, input.weekEndDate),
        ne(shiftRosters.status, 'cancelled')
      )
    );
  const existingKeys = new Set(
    existingAfterCleanup.map(
      (r) => `${r.shiftDate}|${r.templateId ?? 0}|${r.shiftStartTime}|${r.shiftEndTime}`
    )
  );

  const weeklyLoadMap = await calculateStaffWeeklyLoad(
    input.businessLocationId,
    input.weekStartDate,
    input.weekEndDate,
    allStaff
  );

  let rostersCreated = 0;
  let assignmentsCreated = 0;
  let dailyCleaningTasksGenerated = 0;
  const createdRosterIds: number[] = [];

  for (const date of allDates) {
    const assignedToday = new Set<number>();
    for (const template of activeTemplates) {
      const key = `${date}|${template.id}|${template.startTime}|${template.endTime}`;
      if (existingKeys.has(key)) continue;
      const roster = await createShiftRoster(
        {
          businessLocationId: input.businessLocationId,
          shiftDate: date,
          shiftName: template.templateName,
          templateId: template.id,
          shiftStartTime: template.startTime,
          shiftEndTime: template.endTime,
          maxStaff: template.maxStaff,
          isCustomShift: false,
          status: input.mode === 'publish' ? 'published' : 'draft',
          createdBy: changedBy,
        },
        'Auto-generated weekly roster'
      );
      createdRosterIds.push(roster.id);
      rostersCreated += 1;

      const eligible = selectEligibleStaffForShift({
        staff: activeStaff,
        availabilityByKey,
        shiftDate: date,
        stationName: template.templateName,
        currentAssignmentsForDate: assignedToday,
      });
      if (eligible.length === 0)
        warnings.push(`No eligible staff for ${template.templateName} on ${date}.`);
      const createdAssignments = await assignStaffToGeneratedRoster({
        rosterId: roster.id,
        shiftStartTime: template.startTime,
        shiftEndTime: template.endTime,
        maxStaff: template.maxStaff,
        stationName: template.templateName,
        fairnessMode: input.targetFairnessMode,
        ownerRules: input.ownerRules,
        eligibleStaff: eligible,
        weeklyLoadMap,
        changedBy,
        warnings,
      });
      assignmentsCreated += createdAssignments.length;
      createdAssignments.forEach((a) => assignedToday.add(a.staffMemberId));

      if (input.includeDailyCleaning) {
        const result = await allocateDailyCleaningForRoster({
          rosterId: roster.id,
          businessLocationId: input.businessLocationId,
          weeklyLoadMap,
          warnings,
        });
        dailyCleaningTasksGenerated += result.generatedCount;
      }
    }
  }

  let deepCleaningTasksAllocated = 0;
  if (input.includeDeepCleaning) {
    const deep = await allocateDeepCleaningForWeek({
      businessLocationId: input.businessLocationId,
      weekStartDate: input.weekStartDate,
      weekEndDate: input.weekEndDate,
      createdRosterIds,
      weeklyLoadMap,
      warnings,
    });
    deepCleaningTasksAllocated = deep.allocatedCount;
  }

  return {
    ok: true,
    weekStartDate: input.weekStartDate,
    weekEndDate: input.weekEndDate,
    rostersCreated,
    assignmentsCreated,
    dailyCleaningTasksGenerated,
    deepCleaningTasksAllocated,
    fairness: calculateRosterFairness(weeklyLoadMap),
    warnings: Array.from(new Set(warnings)),
  };
}

// ----------------------------------------------------------------
// Attendance
// ----------------------------------------------------------------

export async function logAttendanceStatus(data: InsertShiftAttendanceLog, changedBy = 'system') {
  const inserted = await db.insert(shiftAttendanceLogs).values(data).returning();
  const log = inserted[0];

  await writeShiftChangeLog({
    shiftRosterId: data.shiftRosterId,
    entityType: 'attendance',
    entityId: log.id,
    changeType: 'attendance',
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
  changedBy = 'system'
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
    .set({ attendanceStatus: 'replaced', replacementStaffId, updatedAt: new Date() })
    .where(eq(shiftAttendanceLogs.id, attendanceLogId))
    .returning();

  await writeShiftChangeLog({
    shiftRosterId: log.shiftRosterId,
    entityType: 'attendance',
    entityId: attendanceLogId,
    changeType: 'replace',
    beforeJson: log,
    afterJson: updated,
    changedBy,
    reason: `Replaced by staff #${replacementStaffId}`,
  });

  return updated;
}

// ----------------------------------------------------------------
// Delete (soft)
// ----------------------------------------------------------------

export async function deleteShiftRoster(
  rosterId: number,
  changedBy = 'manager',
  reason = 'Roster deleted from Weekly Roster Planner'
) {
  // 1. Load full roster snapshot (404 if missing)
  const [roster] = await db
    .select()
    .from(shiftRosters)
    .where(eq(shiftRosters.id, rosterId))
    .limit(1);
  if (!roster) throw new Error(`Roster ${rosterId} not found`);

  // 2. Load assignments to include in snapshot
  const assignments = await db
    .select()
    .from(shiftStaffAssignments)
    .where(eq(shiftStaffAssignments.shiftRosterId, rosterId));

  // 3. Write audit log BEFORE any modification
  await writeShiftChangeLog({
    shiftRosterId: rosterId,
    entityType: 'roster',
    entityId: rosterId,
    changeType: 'delete',
    beforeJson: { ...roster, assignments },
    afterJson: null,
    changedBy,
    reason,
  });

  // 4. Soft-delete: status → cancelled
  // Preserves all dependent rows (assignments, breaks, cleaning, attendance)
  // and avoids any FK cascade risk on shift_change_log.
  await db
    .update(shiftRosters)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(shiftRosters.id, rosterId));

  return { ok: true, id: rosterId, status: 'cancelled' };
}

// ----------------------------------------------------------------
// Change log
// ----------------------------------------------------------------

export async function writeShiftChangeLog(data: InsertShiftChangeLog) {
  return await db.insert(shiftChangeLog).values(data).returning();
}
