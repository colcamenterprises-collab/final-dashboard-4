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

// ─── Types ──────────────────────────────────────────────────────────────────────

type CleaningTask = {
  taskName: string;
  areaName: string;
  status: string;
  timing: string | null;
};

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
  cleaningTasks: CleaningTask[];
};

type ExportPayload = {
  weekStart: string;
  weekEnd: string;
  locationId: number;
  generatedAt: string;
  assignments: ExportAssignment[];
  validation: { blockers: string[]; warnings: string[] };
};

type DistributionArtifact = {
  type: 'team' | 'individual';
  locationId: number;
  weekStart: string;
  staffId?: number;
  fileName: string;
  pdfBytes: number;
};

// ─── Design constants ───────────────────────────────────────────────────────────

const MARGIN = 40;
const PAGE_W = 595;
const PAGE_H = 842;
const CW = PAGE_W - 2 * MARGIN; // 515pt content width

const C = {
  headerBg: '#0f172a',
  headerText: '#f8fafc',
  headerSub: '#94a3b8',
  shiftBg: '#1e3a5f',
  shiftText: '#dbeafe',
  shiftSub: '#93c5fd',
  colHdrBg: '#f1f5f9',
  colHdrText: '#64748b',
  rowAlt: '#f8fafc',
  textDark: '#0f172a',
  textMid: '#475569',
  textLight: '#94a3b8',
  divider: '#e2e8f0',
  okBg: '#f0fdf4',
  okBorder: '#16a34a',
  okText: '#15803d',
  warnBg: '#fef9c3',
  warnBorder: '#ca8a04',
  warnText: '#78350f',
  errBg: '#fee2e2',
  errBorder: '#dc2626',
  errText: '#7f1d1d',
  taskBg: '#f0f9ff',
  taskText: '#0369a1',
  taskStartBg: '#dcfce7',
  taskStartFg: '#166534',
  taskDuringBg: '#dbeafe',
  taskDuringFg: '#1d4ed8',
  taskEndBg: '#f3e8ff',
  taskEndFg: '#7c3aed',
};

const RESTRICTED_NOTE =
  'Restricted: payroll, sales, cash, attendance logs, private notes, and capability flags excluded.';

// ─── Utility helpers ────────────────────────────────────────────────────────────

function assertIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function streamFromBuffer(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_UPPER = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

function dayHeaderLabel(iso: string): string {
  const dt = new Date(`${iso}T12:00:00Z`);
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS_UPPER[dt.getUTCDay()]}  ·  ${d} ${MONTHS_LONG[m - 1].toUpperCase()} ${y}`;
}

function fmtGenerated(iso: string): string {
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getUTCDate())}/${p(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()} ${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())} UTC`;
}

function weekRange(start: string, end: string): string {
  return `${fmtDateLong(start)} – ${fmtDateLong(end)}`;
}

function timingLabel(t: string | null): string {
  switch (t) {
    case 'start_shift':  return 'START OF SHIFT';
    case 'during_shift': return 'DURING SHIFT';
    case 'end_shift':    return 'END OF SHIFT';
    default:             return 'OTHER TASKS';
  }
}

function timingColors(t: string | null): { bg: string; fg: string } {
  switch (t) {
    case 'start_shift':  return { bg: C.taskStartBg, fg: C.taskStartFg };
    case 'during_shift': return { bg: C.taskDuringBg, fg: C.taskDuringFg };
    case 'end_shift':    return { bg: C.taskEndBg,    fg: C.taskEndFg };
    default:             return { bg: C.colHdrBg,     fg: C.colHdrText };
  }
}

// ─── PDFKit helpers ─────────────────────────────────────────────────────────────

// PDFKit type shorthand
type Doc = InstanceType<typeof PDFDocument>;

/** Draw a horizontal rule at current doc.y */
function hRule(doc: Doc) {
  const y = doc.y;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .strokeColor(C.divider)
    .lineWidth(0.5)
    .stroke();
}

/** If remaining vertical space < needed, add a new page */
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > PAGE_H - MARGIN - 12) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

/** Draw a filled rectangle from doc.y, advance doc.y to bottom of rect. Returns bottom y. */
function fillBlock(doc: Doc, h: number, fill: string, accentLeft?: string): number {
  const top = doc.y;
  doc.rect(MARGIN, top, CW, h).fill(fill);
  if (accentLeft) doc.rect(MARGIN, top, 3, h).fill(accentLeft);
  doc.y = top + h;
  return top;
}

// ─── Database fetch ─────────────────────────────────────────────────────────────

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

  const assignmentRows =
    rosterIds.length > 0
      ? await db
          .select()
          .from(shiftStaffAssignments)
          .where(inArray(shiftStaffAssignments.shiftRosterId, rosterIds))
          .orderBy(asc(shiftStaffAssignments.shiftRosterId), asc(shiftStaffAssignments.scheduledStartTime))
      : [];

  const staffIds = [...new Set(assignmentRows.map((a) => a.staffMemberId))];
  const staffRows =
    staffIds.length > 0
      ? await db.select().from(staffMembers).where(inArray(staffMembers.id, staffIds))
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
            timing: cleaningTaskTemplates.timing,
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

  const cleaningMap = new Map<string, CleaningTask[]>();
  for (const task of cleaningRows) {
    if (!task.assignedStaffId) continue;
    const key = `${task.shiftRosterId}:${task.assignedStaffId}`;
    const bucket = cleaningMap.get(key) ?? [];
    bucket.push({
      taskName: task.taskName ?? 'Unmapped task',
      areaName: task.areaName ?? 'Unmapped area',
      status: task.status,
      timing: task.timing ?? null,
    });
    cleaningMap.set(key, bucket);
  }

  const assignments: ExportAssignment[] = assignmentRows.map((a) => {
    const roster = rosterMap.get(a.shiftRosterId);
    const staff = staffMap.get(a.staffMemberId);
    return {
      rosterId: a.shiftRosterId,
      shiftDate: roster?.shiftDate ?? 'UNMAPPED',
      shiftName: roster?.shiftName ?? 'UNMAPPED',
      shiftStartTime: roster?.shiftStartTime ?? 'UNMAPPED',
      shiftEndTime: roster?.shiftEndTime ?? 'UNMAPPED',
      staffMemberId: a.staffMemberId,
      staffName: staff?.fullName ?? `UNMAPPED STAFF #${a.staffMemberId}`,
      staffRole: staff?.primaryRole ?? 'UNMAPPED',
      scheduledStartTime: a.scheduledStartTime,
      scheduledEndTime: a.scheduledEndTime,
      primaryStation: a.primaryStation,
      secondaryStation: a.secondaryStation,
      isPrepStarter: a.isPrepStarter,
      cleaningTasks: cleaningMap.get(`${a.shiftRosterId}:${a.staffMemberId}`) ?? [],
    };
  });

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (rosterRows.length === 0) blockers.push('No rosters found for week and location.');
  const unmapped = assignments.filter((a) => a.staffName.startsWith('UNMAPPED'));
  if (unmapped.length > 0) blockers.push(`Missing staff records for ${unmapped.length} assignment(s).`);
  const badTimes = assignments.filter(
    (a) => !/^\d{2}:\d{2}$/.test(a.scheduledStartTime) || !/^\d{2}:\d{2}$/.test(a.scheduledEndTime)
  );
  if (badTimes.length > 0) blockers.push(`Invalid scheduled times in ${badTimes.length} assignment(s).`);
  const roleGaps = assignments.filter((a) => a.staffRole === 'UNMAPPED').length;
  if (roleGaps > 0) blockers.push(`Missing staff roles in ${roleGaps} assignment(s).`);
  const noTasks = assignments.filter((a) => a.cleaningTasks.length === 0).length;
  if (noTasks > 0) warnings.push(`No cleaning tasks linked for ${noTasks} assignment(s).`);

  return { weekStart, weekEnd, locationId, generatedAt: new Date().toISOString(), assignments, validation: { blockers, warnings } };
}

// ─── HTML template helpers (exported for API / email use) ──────────────────────

export function renderRosterPdfStyles(): string {
  return `
    body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 12px 0 4px; color: #1e3a5f; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
    .header { background: #0f172a; color: #f8fafc; padding: 14px 16px; border-radius: 4px; margin-bottom: 12px; }
    .header p { margin: 3px 0 0; color: #94a3b8; font-size: 9px; }
    .valid-ok { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 6px 10px; margin-bottom: 10px; font-size: 9px; color: #15803d; }
    .valid-warn { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 6px 10px; margin-bottom: 10px; font-size: 9px; color: #78350f; }
    .valid-err { background: #fee2e2; border-left: 3px solid #dc2626; padding: 6px 10px; margin-bottom: 10px; font-size: 9px; color: #7f1d1d; }
    .day-header { background: #0f172a; color: #f8fafc; padding: 5px 10px; font-size: 10px; font-weight: bold; margin-top: 14px; }
    .shift-bar { background: #1e3a5f; color: #dbeafe; padding: 4px 10px; font-size: 9px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-top: 2px; }
    th { background: #f1f5f9; color: #64748b; font-size: 8px; text-align: left; padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 4px 6px; font-size: 9px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) td { background: #f8fafc; }
    .task-bar { background: #f0f9ff; color: #0369a1; padding: 4px 10px; font-size: 8px; margin-top: 2px; }
    .timing-start { background: #dcfce7; color: #166534; font-weight: bold; font-size: 8px; padding: 3px 8px; margin: 6px 0 2px; }
    .timing-during { background: #dbeafe; color: #1d4ed8; font-weight: bold; font-size: 8px; padding: 3px 8px; margin: 6px 0 2px; }
    .timing-end { background: #f3e8ff; color: #7c3aed; font-weight: bold; font-size: 8px; padding: 3px 8px; margin: 6px 0 2px; }
    .task-item { padding: 2px 8px 2px 20px; font-size: 9px; color: #0f172a; position: relative; }
    .task-item::before { content: "•"; position: absolute; left: 8px; }
    .task-area { color: #94a3b8; margin-left: 6px; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 7.5px; color: #94a3b8; text-align: center; }
  `;
}

export function renderTeamRosterHtml(payload: ExportPayload): string {
  const { weekStart, weekEnd, generatedAt, assignments, validation, locationId } = payload;

  const hasBlockers = validation.blockers.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  const validationHtml =
    !hasBlockers && !hasWarnings
      ? `<div class="valid-ok">✓ Validation passed — no blockers, no warnings</div>`
      : `<div class="${hasBlockers ? 'valid-err' : 'valid-warn'}">
           <strong>VALIDATION</strong>
           ${validation.blockers.map((b) => `<div>⚠ ${b}</div>`).join('')}
           ${validation.warnings.map((w) => `<div>• ${w}</div>`).join('')}
         </div>`;

  const byDate = new Map<string, ExportAssignment[]>();
  for (const a of assignments) {
    const arr = byDate.get(a.shiftDate) ?? [];
    arr.push(a);
    byDate.set(a.shiftDate, arr);
  }

  const dayBlocks = [...byDate.keys()].sort().map((date) => {
    const dayRows = byDate.get(date)!;
    const byRoster = new Map<number, ExportAssignment[]>();
    for (const a of dayRows) {
      const arr = byRoster.get(a.rosterId) ?? [];
      arr.push(a);
      byRoster.set(a.rosterId, arr);
    }

    const rosterBlocks = [...byRoster.values()].map((rA) => {
      const first = rA[0];
      const allTasks = rA.flatMap((a) => a.cleaningTasks);
      const tS = allTasks.filter((t) => t.timing === 'start_shift').length;
      const tD = allTasks.filter((t) => t.timing === 'during_shift').length;
      const tE = allTasks.filter((t) => t.timing === 'end_shift').length;
      const staffRows = rA.map((a) => `
        <tr>
          <td><strong>${a.staffName}</strong></td>
          <td>${a.primaryStation ?? '—'}</td>
          <td style="color:#94a3b8">${a.secondaryStation ?? '—'}</td>
        </tr>`).join('');
      const taskSummary =
        allTasks.length > 0
          ? `<div class="task-bar">Cleaning tasks assigned &nbsp;·&nbsp; Start: ${tS} &nbsp;·&nbsp; During: ${tD} &nbsp;·&nbsp; End: ${tE} &nbsp;·&nbsp; Total: ${allTasks.length}</div>`
          : `<div style="font-size:8px;color:#94a3b8;padding:4px 10px">No cleaning tasks linked.</div>`;
      return `
        <div class="shift-bar">
          <span><strong>SHIFT:</strong> ${first.shiftName}</span>
          <span>${first.shiftStartTime} – ${first.shiftEndTime}</span>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Primary Station</th><th>Secondary Station</th></tr></thead>
          <tbody>${staffRows}</tbody>
        </table>
        ${taskSummary}`;
    }).join('');

    return `
      <div class="day-header">${dayHeaderLabel(date)}</div>
      ${rosterBlocks}`;
  }).join('');

  const totalShifts = new Set(assignments.map((a) => a.rosterId)).size;
  const totalStaff = new Set(assignments.map((a) => a.staffMemberId)).size;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Weekly Team Roster — ${weekRange(weekStart, weekEnd)}</title>
    <style>${renderRosterPdfStyles()}</style></head><body>
    <div class="header">
      <h1>Weekly Team Roster</h1>
      <p>Week: ${weekRange(weekStart, weekEnd)} &nbsp;·&nbsp; Generated: ${fmtGenerated(generatedAt)} &nbsp;·&nbsp; Location #${locationId}</p>
      <p>Shifts: ${totalShifts} &nbsp;·&nbsp; Staff scheduled: ${totalStaff} &nbsp;·&nbsp; Warnings: ${validation.warnings.length}</p>
    </div>
    ${validationHtml}
    ${dayBlocks}
    <div class="footer">${RESTRICTED_NOTE}</div>
    </body></html>`;
}

export function renderIndividualRosterHtml(payload: ExportPayload, staffId: number): string {
  const { weekStart, weekEnd, generatedAt, assignments, validation } = payload;
  const mine = assignments.filter((a) => a.staffMemberId === staffId);
  const staffName = mine[0]?.staffName ?? `Staff #${staffId}`;
  const staffRole = mine[0]?.staffRole ?? '—';

  const hasBlockers = validation.blockers.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  const validationHtml =
    !hasBlockers && !hasWarnings
      ? `<div class="valid-ok">✓ Validation passed — no blockers, no warnings</div>`
      : `<div class="${hasBlockers ? 'valid-err' : 'valid-warn'}">
           <strong>VALIDATION</strong>
           ${validation.blockers.map((b) => `<div>⚠ ${b}</div>`).join('')}
           ${validation.warnings.map((w) => `<div>• ${w}</div>`).join('')}
         </div>`;

  if (mine.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>${renderRosterPdfStyles()}</style></head><body>
      <div class="header"><h1>${staffName}</h1><p>${staffRole} &nbsp;·&nbsp; Weekly Individual Roster</p>
        <p>Week: ${weekRange(weekStart, weekEnd)} &nbsp;·&nbsp; Generated: ${fmtGenerated(generatedAt)}</p></div>
      ${validationHtml}
      <p style="color:#94a3b8;font-size:10px;margin-top:24px">No shifts scheduled for this staff member this week.</p>
      <div class="footer">${RESTRICTED_NOTE}</div></body></html>`;
  }

  const TIMING_ORDER = ['start_shift', 'during_shift', 'end_shift'];
  const timingClass: Record<string, string> = {
    start_shift: 'timing-start', during_shift: 'timing-during', end_shift: 'timing-end',
  };

  const shiftBlocks = [...mine].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)).map((a) => {
    const taskGroups = TIMING_ORDER.map((t) => {
      const tasks = a.cleaningTasks.filter((ct) => ct.timing === t);
      if (tasks.length === 0) return '';
      const items = tasks.map((ct) =>
        `<div class="task-item">${ct.taskName} <span class="task-area">${ct.areaName}</span></div>`
      ).join('');
      return `<div class="${timingClass[t] ?? 'timing-start'}">${timingLabel(t)}</div>${items}`;
    }).join('');
    const noTasks = a.cleaningTasks.length === 0
      ? `<p style="color:#94a3b8;font-size:8px;padding:0 8px">No cleaning tasks assigned.</p>` : '';

    return `
      <div class="day-header">${dayHeaderLabel(a.shiftDate)}</div>
      <div class="shift-bar">
        <span><strong>SHIFT:</strong> ${a.shiftName}</span>
        <span>${a.scheduledStartTime} – ${a.scheduledEndTime}</span>
      </div>
      <div style="padding:5px 10px 2px;font-size:9px;color:#475569">
        Station: <strong>${a.primaryStation ?? '—'}</strong> (primary)
        &nbsp;·&nbsp; ${a.secondaryStation ?? '—'} (secondary)
      </div>
      <div style="padding:2px 0 8px">
        ${taskGroups}${noTasks}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${staffName} — Individual Roster — ${weekRange(weekStart, weekEnd)}</title>
    <style>${renderRosterPdfStyles()}</style></head><body>
    <div class="header">
      <h1>${staffName}</h1>
      <p style="color:#dbeafe;font-size:10px;margin:2px 0">${staffRole} &nbsp;·&nbsp; Weekly Individual Roster</p>
      <p>Week: ${weekRange(weekStart, weekEnd)} &nbsp;·&nbsp; Generated: ${fmtGenerated(generatedAt)}</p>
    </div>
    ${validationHtml}
    ${shiftBlocks}
    <div class="footer">${RESTRICTED_NOTE}</div>
    </body></html>`;
}

// ─── PDF Renderers (PDFKit) ─────────────────────────────────────────────────────

function renderTeamRosterPdf(doc: Doc, payload: ExportPayload): void {
  const { weekStart, weekEnd, generatedAt, assignments, validation, locationId } = payload;

  // ── Page header ─────────────────────────────────────────────────────────────
  doc.y = MARGIN;
  const hdrTop = fillBlock(doc, 60, C.headerBg);
  doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(17)
    .text('Weekly Team Roster', MARGIN + 12, hdrTop + 8, { width: CW - 24, lineBreak: false });
  doc.fillColor(C.headerSub).font('Helvetica').fontSize(8.5)
    .text(`Week: ${weekRange(weekStart, weekEnd)}`, MARGIN + 12, hdrTop + 30, { width: CW - 24, lineBreak: false })
    .text(`Generated: ${fmtGenerated(generatedAt)}  ·  Location #${locationId}`, MARGIN + 12, hdrTop + 42, { width: CW - 24, lineBreak: false });
  doc.y += 8;

  // ── Validation ──────────────────────────────────────────────────────────────
  _drawValidation(doc, payload.validation);

  // ── Day sections ────────────────────────────────────────────────────────────
  const byDate = new Map<string, ExportAssignment[]>();
  for (const a of assignments) {
    const arr = byDate.get(a.shiftDate) ?? [];
    arr.push(a);
    byDate.set(a.shiftDate, arr);
  }

  for (const date of [...byDate.keys()].sort()) {
    const dayRows = byDate.get(date)!;
    const byRoster = new Map<number, ExportAssignment[]>();
    for (const a of dayRows) {
      const arr = byRoster.get(a.rosterId) ?? [];
      arr.push(a);
      byRoster.set(a.rosterId, arr);
    }

    ensureSpace(doc, 100);
    doc.y += 8;

    // Day header bar
    const dhTop = fillBlock(doc, 24, C.headerBg);
    doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(10)
      .text(dayHeaderLabel(date), MARGIN + 10, dhTop + 7, { width: CW - 20, lineBreak: false });
    doc.y += 4;

    for (const rAssignments of byRoster.values()) {
      const first = rAssignments[0];
      const estimatedH = 18 + 16 + rAssignments.length * 17 + 22;
      ensureSpace(doc, estimatedH);

      // Shift subheader
      const shTop = fillBlock(doc, 18, C.shiftBg);
      doc.fillColor(C.shiftSub).font('Helvetica-Bold').fontSize(8)
        .text('SHIFT:', MARGIN + 8, shTop + 5, { width: 38, lineBreak: false });
      doc.fillColor(C.shiftText).font('Helvetica-Bold').fontSize(8)
        .text(first.shiftName, MARGIN + 48, shTop + 5, { width: 230, lineBreak: false });
      doc.fillColor(C.headerSub).font('Helvetica').fontSize(8)
        .text(`${first.shiftStartTime} – ${first.shiftEndTime}`, MARGIN + 370, shTop + 5, { width: CW - 380, lineBreak: false });
      doc.y = shTop + 18;

      // Column headers
      const chTop = fillBlock(doc, 16, C.colHdrBg);
      doc.fillColor(C.colHdrText).font('Helvetica-Bold').fontSize(7.5)
        .text('NAME', MARGIN + 6, chTop + 4, { width: 130, lineBreak: false })
        .text('PRIMARY STATION', MARGIN + 142, chTop + 4, { width: 160, lineBreak: false })
        .text('SECONDARY STATION', MARGIN + 308, chTop + 4, { width: 155, lineBreak: false });
      doc.y = chTop + 16;
      hRule(doc);

      // Staff rows
      for (let i = 0; i < rAssignments.length; i++) {
        const a = rAssignments[i];
        const rowTop = doc.y;
        if (i % 2 === 0) doc.rect(MARGIN, rowTop, CW, 17).fill(C.rowAlt);
        doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(8.5)
          .text(a.staffName, MARGIN + 6, rowTop + 4, { width: 130, lineBreak: false });
        doc.fillColor(C.textMid).font('Helvetica').fontSize(8.5)
          .text(a.primaryStation ?? '—', MARGIN + 142, rowTop + 4, { width: 160, lineBreak: false });
        doc.fillColor(C.textLight).font('Helvetica').fontSize(8.5)
          .text(a.secondaryStation ?? '—', MARGIN + 308, rowTop + 4, { width: 155, lineBreak: false });
        doc.y = rowTop + 17;
      }

      // Task count summary
      const allTasks = rAssignments.flatMap((a) => a.cleaningTasks);
      const tS = allTasks.filter((t) => t.timing === 'start_shift').length;
      const tD = allTasks.filter((t) => t.timing === 'during_shift').length;
      const tE = allTasks.filter((t) => t.timing === 'end_shift').length;
      const tbTop = fillBlock(doc, 18, allTasks.length > 0 ? C.taskBg : C.rowAlt);
      if (allTasks.length > 0) {
        doc.fillColor(C.taskText).font('Helvetica').fontSize(7.5)
          .text(
            `Cleaning tasks assigned  ·  Start: ${tS}  ·  During: ${tD}  ·  End: ${tE}  ·  Total: ${allTasks.length}`,
            MARGIN + 10, tbTop + 5, { width: CW - 20, lineBreak: false }
          );
      } else {
        doc.fillColor(C.textLight).font('Helvetica').fontSize(7.5)
          .text('No cleaning tasks linked to this shift.', MARGIN + 10, tbTop + 5, { lineBreak: false });
      }
      doc.y += 4;
    }
  }

  // Footer
  doc.y += 16;
  hRule(doc);
  doc.y += 4;
  doc.fillColor(C.textLight).font('Helvetica').fontSize(6.5)
    .text(RESTRICTED_NOTE, MARGIN, doc.y, { width: CW, align: 'center' });
}

function renderIndividualRosterPdf(doc: Doc, payload: ExportPayload, staffId: number): void {
  const { weekStart, weekEnd, generatedAt, assignments, validation } = payload;
  const mine = assignments.filter((a) => a.staffMemberId === staffId);
  const staffName = mine[0]?.staffName ?? `Staff #${staffId}`;
  const staffRole = mine[0]?.staffRole ?? '—';

  // ── Page header ─────────────────────────────────────────────────────────────
  doc.y = MARGIN;
  const hdrTop = fillBlock(doc, 66, C.headerBg);
  doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(17)
    .text(staffName, MARGIN + 12, hdrTop + 8, { width: CW - 24, lineBreak: false });
  doc.fillColor('#93c5fd').font('Helvetica').fontSize(9.5)
    .text(staffRole, MARGIN + 12, hdrTop + 30, { width: CW - 24, lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(8)
    .text('Weekly Individual Roster', MARGIN + 12, hdrTop + 44, { width: CW - 24, lineBreak: false });
  doc.fillColor(C.headerSub).font('Helvetica').fontSize(7.5)
    .text(`Week: ${weekRange(weekStart, weekEnd)}  ·  Generated: ${fmtGenerated(generatedAt)}`, MARGIN + 12, hdrTop + 56, { width: CW - 24, lineBreak: false });
  doc.y += 8;

  // ── Validation ──────────────────────────────────────────────────────────────
  _drawValidation(doc, validation);

  // ── Shifts ──────────────────────────────────────────────────────────────────
  if (mine.length === 0) {
    doc.y += 16;
    doc.fillColor(C.textLight).font('Helvetica').fontSize(9)
      .text('No shifts scheduled for this staff member in the selected week.', MARGIN, doc.y, { width: CW, align: 'center' });
    return;
  }

  const TIMING_ORDER = ['start_shift', 'during_shift', 'end_shift'] as const;
  const sorted = [...mine].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));

  for (const a of sorted) {
    ensureSpace(doc, 110);
    doc.y += 8;

    // Day header
    const dhTop = fillBlock(doc, 24, C.headerBg);
    doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(10)
      .text(dayHeaderLabel(a.shiftDate), MARGIN + 10, dhTop + 7, { width: CW - 20, lineBreak: false });
    doc.y += 4;

    // Shift bar
    const shTop = fillBlock(doc, 18, C.shiftBg);
    doc.fillColor(C.shiftSub).font('Helvetica-Bold').fontSize(8)
      .text('SHIFT:', MARGIN + 8, shTop + 5, { width: 38, lineBreak: false });
    doc.fillColor(C.shiftText).font('Helvetica-Bold').fontSize(8)
      .text(a.shiftName, MARGIN + 48, shTop + 5, { width: 230, lineBreak: false });
    doc.fillColor(C.headerSub).font('Helvetica').fontSize(8)
      .text(`${a.scheduledStartTime} – ${a.scheduledEndTime}`, MARGIN + 370, shTop + 5, { width: CW - 380, lineBreak: false });
    doc.y = shTop + 18;

    // Station line
    doc.y += 5;
    doc.fillColor(C.textMid).font('Helvetica').fontSize(8.5)
      .text(
        `Station:  ${a.primaryStation ?? '—'} (primary)   ·   ${a.secondaryStation ?? '—'} (secondary)`,
        MARGIN + 6, doc.y, { width: CW - 12, lineBreak: false }
      );
    doc.y += 14;
    hRule(doc);
    doc.y += 6;

    // Tasks grouped by timing
    if (a.cleaningTasks.length === 0) {
      doc.fillColor(C.textLight).font('Helvetica').fontSize(8)
        .text('No cleaning tasks assigned for this shift.', MARGIN + 6, doc.y, { lineBreak: false });
      doc.y += 14;
    } else {
      for (const timing of TIMING_ORDER) {
        const tasks = a.cleaningTasks.filter((t) => t.timing === timing);
        if (tasks.length === 0) continue;

        ensureSpace(doc, 15 + tasks.length * 14);

        // Timing group header
        const tc = timingColors(timing);
        const tgTop = fillBlock(doc, 15, tc.bg);
        doc.fillColor(tc.fg).font('Helvetica-Bold').fontSize(7.5)
          .text(timingLabel(timing), MARGIN + 8, tgTop + 4, { width: CW - 16, lineBreak: false });
        doc.y += 2;

        // Task bullet list
        for (const task of tasks) {
          const taskRowY = doc.y;
          doc.fillColor(C.textDark).font('Helvetica').fontSize(8.5)
            .text('•', MARGIN + 10, taskRowY, { width: 10, lineBreak: false })
            .text(task.taskName, MARGIN + 22, taskRowY, { width: CW - 110, lineBreak: false });
          doc.fillColor(C.textLight).font('Helvetica').fontSize(7.5)
            .text(task.areaName, MARGIN + 22 + (CW - 110) + 6, taskRowY, { width: 85, lineBreak: false });
          doc.y = taskRowY + 13;
        }
        doc.y += 4;
      }
    }
  }

  // Footer
  doc.y += 16;
  hRule(doc);
  doc.y += 4;
  doc.fillColor(C.textLight).font('Helvetica').fontSize(6.5)
    .text(RESTRICTED_NOTE, MARGIN, doc.y, { width: CW, align: 'center' });
}

/** Shared validation box renderer */
function _drawValidation(doc: Doc, validation: { blockers: string[]; warnings: string[] }) {
  const hasBlockers = validation.blockers.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  if (!hasBlockers && !hasWarnings) {
    const top = fillBlock(doc, 20, C.okBg, C.okBorder);
    doc.fillColor(C.okText).font('Helvetica').fontSize(8)
      .text('✓  Validation passed — no blockers, no warnings', MARGIN + 10, top + 6, { lineBreak: false });
    doc.y += 6;
    return;
  }

  const items = [
    ...validation.blockers.map((b) => ({ label: b, blocker: true })),
    ...validation.warnings.map((w) => ({ label: w, blocker: false })),
  ];
  const boxH = 18 + items.length * 13 + 6;
  const bg = hasBlockers ? C.errBg : C.warnBg;
  const border = hasBlockers ? C.errBorder : C.warnBorder;
  const fg = hasBlockers ? C.errText : C.warnText;
  const top = fillBlock(doc, boxH, bg, border);
  doc.fillColor(fg).font('Helvetica-Bold').fontSize(7.5)
    .text('VALIDATION', MARGIN + 10, top + 6, { lineBreak: false });
  let lineY = top + 18;
  for (const item of items) {
    doc.fillColor(fg).font('Helvetica').fontSize(7.5)
      .text(`${item.blocker ? '⚠ ' : '• '}${item.label}`, MARGIN + 10, lineY, { width: CW - 20, lineBreak: false });
    lineY += 13;
  }
  doc.y += 6;
}

// ─── Buffer builders ────────────────────────────────────────────────────────────

function buildTeamPdfBuffer(payload: ExportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderTeamRosterPdf(doc, payload);
    doc.end();
  });
}

function buildIndividualPdfBuffer(payload: ExportPayload, staffId: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderIndividualRosterPdf(doc, payload, staffId);
    doc.end();
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function generateTeamRosterPDF(weekStart: string, locationId: number): Promise<Readable> {
  const payload = await buildExportPayload(weekStart, locationId);
  const buffer = await buildTeamPdfBuffer(payload);
  return streamFromBuffer(buffer);
}

export async function generateIndividualRosterPDF(
  staffId: number,
  weekStart: string,
  locationId = 1
): Promise<Readable> {
  const payload = await buildExportPayload(weekStart, locationId);
  const buffer = await buildIndividualPdfBuffer(payload, staffId);
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

  const teamBuffer = await buildTeamPdfBuffer(payload);
  artifacts.push({
    type: 'team',
    locationId,
    weekStart,
    fileName: `team-roster-${locationId}-${weekStart}.pdf`,
    pdfBytes: teamBuffer.byteLength,
  });

  const staffIds = [...new Set(payload.assignments.map((a) => a.staffMemberId))];
  for (const staffId of staffIds) {
    const indBuffer = await buildIndividualPdfBuffer(payload, staffId);
    artifacts.push({
      type: 'individual',
      locationId,
      weekStart,
      staffId,
      fileName: `staff-roster-${staffId}-${weekStart}.pdf`,
      pdfBytes: indBuffer.byteLength,
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
