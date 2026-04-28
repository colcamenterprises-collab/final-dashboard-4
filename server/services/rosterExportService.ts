import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  cleaningTaskTemplates,
  shiftCleaningTasks,
  shiftRosters,
  shiftStaffAssignments,
  staffMembers,
} from '../../shared/schema';

type AssignmentRow = typeof shiftStaffAssignments.$inferSelect;
type StaffRow = typeof staffMembers.$inferSelect;

type ExportAssignment = {
  rosterId: number;
  shiftDate: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  staffMemberId: number;
  staffName: string;
  staffRole: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  primaryStation: string | null;
  secondaryStation: string | null;
  isPrepStarter: boolean;
  cleaningTasks: Array<{ taskName: string; areaName: string; status: string }>;
};

type ExportPayload = {
  weekStart: string;
  weekEnd: string;
  locationId: number;
  generatedAt: string;
  assignments: ExportAssignment[];
  validation: {
    blockers: string[];
    warnings: string[];
  };
};

type DistributionArtifact = {
  type: 'team' | 'individual';
  locationId: number;
  weekStart: string;
  staffId?: number;
  fileName: string;
  pdfBytes: number;
};

const RESTRICTED_NOTE =
  'Restricted fields excluded: staff notes, capabilities flags, attendance logs, payroll, and contact metadata.';

function assertIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pdfBufferFromHtmlTemplate(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 32, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines = html
      .replaceAll('</tr>', '\n')
      .replaceAll('</p>', '\n')
      .replaceAll('</h1>', '\n')
      .replaceAll('</h2>', '\n')
      .replaceAll('</h3>', '\n')
      .replaceAll('</li>', '\n')
      .replaceAll('<br/>', '\n')
      .replaceAll('<br>', '\n')
      .split('\n')
      .map((line) => stripTags(line))
      .map((line) => line.trim())
      .filter(Boolean);

    doc.fontSize(10).fillColor('#111827');
    lines.forEach((line, idx) => {
      const isTitle = idx === 0;
      if (isTitle) doc.fontSize(16).fillColor('#111827');
      else doc.fontSize(10).fillColor('#111827');
      doc.text(line, { width: 530 });
      if (isTitle) doc.moveDown(0.5);
    });

    doc.end();
  });
}

function streamFromBuffer(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

async function buildExportPayload(weekStart: string, locationId: number): Promise<ExportPayload> {
  assertIsoDate(weekStart, 'weekStart');

  const weekEnd = addDaysISO(weekStart, 6);
  const rosterRows = await db
    .select()
    .from(shiftRosters)
    .where(
      and(
        eq(shiftRosters.businessLocationId, locationId),
        gte(shiftRosters.shiftDate, weekStart),
        lte(shiftRosters.shiftDate, weekEnd),
        ne(shiftRosters.status, 'cancelled')
      )
    )
    .orderBy(asc(shiftRosters.shiftDate), asc(shiftRosters.shiftStartTime));

  const rosterIds = rosterRows.map((r) => r.id);
  const assignmentRows: AssignmentRow[] =
    rosterIds.length > 0
      ? await db
          .select()
          .from(shiftStaffAssignments)
          .where(inArray(shiftStaffAssignments.shiftRosterId, rosterIds))
          .orderBy(asc(shiftStaffAssignments.shiftRosterId), asc(shiftStaffAssignments.scheduledStartTime))
      : [];

  const staffIds = [...new Set(assignmentRows.map((a) => a.staffMemberId))];
  const staffRows: StaffRow[] =
    staffIds.length > 0
      ? await db
          .select()
          .from(staffMembers)
          .where(inArray(staffMembers.id, staffIds))
      : [];

  const cleaningRows =
    rosterIds.length > 0
      ? await db
          .select({
            shiftRosterId: shiftCleaningTasks.shiftRosterId,
            assignedStaffId: shiftCleaningTasks.assignedStaffId,
            status: shiftCleaningTasks.status,
            taskName: cleaningTaskTemplates.taskName,
            areaName: cleaningTaskTemplates.areaName,
          })
          .from(shiftCleaningTasks)
          .leftJoin(
            cleaningTaskTemplates,
            eq(shiftCleaningTasks.cleaningTaskTemplateId, cleaningTaskTemplates.id)
          )
          .where(inArray(shiftCleaningTasks.shiftRosterId, rosterIds))
      : [];

  const rosterMap = new Map(rosterRows.map((r) => [r.id, r]));
  const staffMap = new Map(staffRows.map((s) => [s.id, s]));

  const cleaningMap = new Map<string, Array<{ taskName: string; areaName: string; status: string }>>();
  for (const task of cleaningRows) {
    if (!task.assignedStaffId) continue;
    const key = `${task.shiftRosterId}:${task.assignedStaffId}`;
    const bucket = cleaningMap.get(key) ?? [];
    bucket.push({
      taskName: task.taskName ?? 'Unmapped task',
      areaName: task.areaName ?? 'Unmapped area',
      status: task.status,
    });
    cleaningMap.set(key, bucket);
  }

  const assignments: ExportAssignment[] = assignmentRows.map((assignment) => {
    const roster = rosterMap.get(assignment.shiftRosterId);
    const staff = staffMap.get(assignment.staffMemberId);
    return {
      rosterId: assignment.shiftRosterId,
      shiftDate: roster?.shiftDate ?? 'UNMAPPED',
      shiftName: roster?.shiftName ?? 'UNMAPPED',
      shiftStartTime: roster?.shiftStartTime ?? 'UNMAPPED',
      shiftEndTime: roster?.shiftEndTime ?? 'UNMAPPED',
      staffMemberId: assignment.staffMemberId,
      staffName: staff?.fullName ?? `UNMAPPED STAFF #${assignment.staffMemberId}`,
      staffRole: staff?.primaryRole ?? 'UNMAPPED',
      scheduledStartTime: assignment.scheduledStartTime,
      scheduledEndTime: assignment.scheduledEndTime,
      primaryStation: assignment.primaryStation,
      secondaryStation: assignment.secondaryStation,
      isPrepStarter: assignment.isPrepStarter,
      cleaningTasks: cleaningMap.get(`${assignment.shiftRosterId}:${assignment.staffMemberId}`) ?? [],
    };
  });

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (rosterRows.length === 0) blockers.push('No rosters found for week and location.');

  const unmappedAssignments = assignments.filter((a) => a.staffName.startsWith('UNMAPPED'));
  if (unmappedAssignments.length > 0) {
    blockers.push(`Missing staff records for ${unmappedAssignments.length} assignment(s).`);
  }

  const invalidTimes = assignments.filter(
    (a) => !/^\d{2}:\d{2}$/.test(a.scheduledStartTime) || !/^\d{2}:\d{2}$/.test(a.scheduledEndTime)
  );
  if (invalidTimes.length > 0) blockers.push(`Invalid scheduled times in ${invalidTimes.length} assignment(s).`);

  const roleGaps = assignments.filter((a) => a.staffRole === 'UNMAPPED').length;
  if (roleGaps > 0) blockers.push(`Missing staff roles in ${roleGaps} assignment(s).`);

  const cleaningMissing = assignments.filter((a) => a.cleaningTasks.length === 0).length;
  if (cleaningMissing > 0) {
    warnings.push(`No cleaning task assignments linked for ${cleaningMissing} assignment(s).`);
  }

  return {
    weekStart,
    weekEnd,
    locationId,
    generatedAt: new Date().toISOString(),
    assignments,
    validation: { blockers, warnings },
  };
}

function buildTeamRosterHtml(payload: ExportPayload): string {
  const rows = payload.assignments
    .map((a) => {
      const cleaning = a.cleaningTasks.map((t) => `${t.taskName} (${t.status})`).join(', ') || 'UNASSIGNED';
      return `<tr>
        <td>${escapeHtml(a.shiftDate)}</td>
        <td>${escapeHtml(a.shiftName)}</td>
        <td>${escapeHtml(a.staffName)}</td>
        <td>${escapeHtml(a.staffRole)}</td>
        <td>${escapeHtml(`${a.scheduledStartTime} - ${a.scheduledEndTime}`)}</td>
        <td>${escapeHtml(a.primaryStation ?? '-')}</td>
        <td>${escapeHtml(cleaning)}</td>
      </tr>`;
    })
    .join('');

  return `
  <html>
    <body>
      <h1>Weekly Team Roster</h1>
      <p>Location: ${payload.locationId}</p>
      <p>Week: ${payload.weekStart} to ${payload.weekEnd}</p>
      <p>Generated At (UTC): ${payload.generatedAt}</p>
      <p>${RESTRICTED_NOTE}</p>
      <h2>Validation</h2>
      <p>Blockers: ${payload.validation.blockers.length ? escapeHtml(payload.validation.blockers.join(' | ')) : 'None'}</p>
      <p>Warnings: ${payload.validation.warnings.length ? escapeHtml(payload.validation.warnings.join(' | ')) : 'None'}</p>
      <h2>Assignments</h2>
      <table>
        ${rows}
      </table>
    </body>
  </html>`;
}

function buildIndividualRosterHtml(payload: ExportPayload, staffId: number): string {
  const staffAssignments = payload.assignments.filter((a) => a.staffMemberId === staffId);
  const staffName = staffAssignments[0]?.staffName ?? `UNMAPPED STAFF #${staffId}`;
  const staffRole = staffAssignments[0]?.staffRole ?? 'UNMAPPED';

  const rows = staffAssignments
    .map((a) => {
      const cleaning = a.cleaningTasks.map((t) => `${t.taskName} (${t.status})`).join(', ') || 'UNASSIGNED';
      return `<tr>
        <td>${escapeHtml(a.shiftDate)}</td>
        <td>${escapeHtml(a.shiftName)}</td>
        <td>${escapeHtml(`${a.scheduledStartTime} - ${a.scheduledEndTime}`)}</td>
        <td>${escapeHtml(a.primaryStation ?? '-')}</td>
        <td>${escapeHtml(a.secondaryStation ?? '-')}</td>
        <td>${escapeHtml(cleaning)}</td>
      </tr>`;
    })
    .join('');

  return `
  <html>
    <body>
      <h1>Weekly Individual Roster</h1>
      <p>Staff: ${escapeHtml(staffName)}</p>
      <p>Role: ${escapeHtml(staffRole)}</p>
      <p>Location: ${payload.locationId}</p>
      <p>Week: ${payload.weekStart} to ${payload.weekEnd}</p>
      <p>Generated At (UTC): ${payload.generatedAt}</p>
      <p>${RESTRICTED_NOTE}</p>
      <h2>Validation</h2>
      <p>Blockers: ${payload.validation.blockers.length ? escapeHtml(payload.validation.blockers.join(' | ')) : 'None'}</p>
      <p>Warnings: ${payload.validation.warnings.length ? escapeHtml(payload.validation.warnings.join(' | ')) : 'None'}</p>
      <h2>Assignments</h2>
      <table>
        ${rows || '<tr><td>NO ASSIGNMENTS FOUND</td></tr>'}
      </table>
    </body>
  </html>`;
}

export async function generateTeamRosterPDF(weekStart: string, locationId: number): Promise<Readable> {
  const payload = await buildExportPayload(weekStart, locationId);
  const html = buildTeamRosterHtml(payload);
  const buffer = await pdfBufferFromHtmlTemplate(html);
  return streamFromBuffer(buffer);
}

export async function generateIndividualRosterPDF(
  staffId: number,
  weekStart: string,
  locationId = 1
): Promise<Readable> {
  const payload = await buildExportPayload(weekStart, locationId);
  const html = buildIndividualRosterHtml(payload, staffId);
  const buffer = await pdfBufferFromHtmlTemplate(html);
  return streamFromBuffer(buffer);
}

export async function prepareWeeklyRosterDistribution(
  weekStart: string,
  locationId: number
): Promise<{
  weekStart: string;
  locationId: number;
  generatedAt: string;
  artifacts: DistributionArtifact[];
  distributionPlan: { email: 'pending'; line: 'pending'; dedupeKey: string };
}> {
  const payload = await buildExportPayload(weekStart, locationId);
  const artifacts: DistributionArtifact[] = [];

  const teamHtml = buildTeamRosterHtml(payload);
  const teamBuffer = await pdfBufferFromHtmlTemplate(teamHtml);
  artifacts.push({
    type: 'team',
    locationId,
    weekStart,
    fileName: `team-roster-${locationId}-${weekStart}.pdf`,
    pdfBytes: teamBuffer.byteLength,
  });

  const staffIds = [...new Set(payload.assignments.map((a) => a.staffMemberId))];
  for (const staffId of staffIds) {
    const individualHtml = buildIndividualRosterHtml(payload, staffId);
    const individualBuffer = await pdfBufferFromHtmlTemplate(individualHtml);
    artifacts.push({
      type: 'individual',
      locationId,
      weekStart,
      staffId,
      fileName: `staff-roster-${staffId}-${weekStart}.pdf`,
      pdfBytes: individualBuffer.byteLength,
    });
  }

  return {
    weekStart,
    locationId,
    generatedAt: payload.generatedAt,
    artifacts,
    distributionPlan: {
      email: 'pending',
      line: 'pending',
      dedupeKey: `weekly-roster:${locationId}:${weekStart}`,
    },
  };
}

export async function getLocationsWithRostersInWeek(weekStart: string): Promise<number[]> {
  assertIsoDate(weekStart, 'weekStart');
  const weekEnd = addDaysISO(weekStart, 6);
  const rows = await db
    .select({ locationId: shiftRosters.businessLocationId })
    .from(shiftRosters)
    .where(and(gte(shiftRosters.shiftDate, weekStart), lte(shiftRosters.shiftDate, weekEnd)))
    .groupBy(shiftRosters.businessLocationId)
    .orderBy(sql`${shiftRosters.businessLocationId} asc`);

  return rows.map((r) => r.locationId);
}
