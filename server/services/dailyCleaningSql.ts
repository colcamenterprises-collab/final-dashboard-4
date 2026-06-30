import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/prisma';

export interface DailyCleaningTaskDefinition {
  id: string;
  taskId: string;
  taskName: string;
  standard: unknown;
  moduleType: string;
  taskType: string;
  frequency: string;
  photoRequired: boolean;
  active: boolean;
  sortOrder: number;
}

export interface DailyCleaningRecord {
  cleaningRecordId: string;
  salesId: string;
  shiftDate: string;
  store: string;
  manager: string;
  taskId: string;
  taskName: string;
  imagePath: string;
  timestamp: Date;
  status: string;
  comments: string | null;
  followUpAction: string | null;
  assignedTo: string | null;
  followUpStatus: string | null;
  cleaningScore: number;
  moduleType: string;
}

export function dailyCleaningBlocker(code: string, message: string, where: string, canonicalSource: string) {
  return { code, message, where, canonical_source: canonicalSource, auto_build_attempted: false };
}

export function safeDailyCleaningErrorMessage(action: string) {
  return `Daily Cleaning ${action} is currently unavailable. Please contact an administrator.`;
}

export function isMissingDailyCleaningInfrastructureError(error: unknown) {
  const err = error as { code?: string; meta?: { code?: string; message?: string }; message?: string };
  const message = `${err?.message || ''} ${err?.meta?.message || ''}`;
  return err?.code === 'P2021'
    || err?.meta?.code === '42P01'
    || /daily_cleaning_(task_definitions|records)/i.test(message) && /(does not exist|doesn't exist|relation .* does not exist|42P01)/i.test(message);
}

function taskSelectSql() {
  return Prisma.sql`
    SELECT
      id,
      task_id AS "taskId",
      task_name AS "taskName",
      standard,
      module_type AS "moduleType",
      task_type AS "taskType",
      frequency,
      photo_required AS "photoRequired",
      active,
      sort_order AS "sortOrder"
    FROM daily_cleaning_task_definitions
  `;
}

export async function readActiveCleaningTasks(): Promise<DailyCleaningTaskDefinition[]> {
  try {
    return await db().$queryRaw<DailyCleaningTaskDefinition[]>`
      ${taskSelectSql()}
      WHERE active = TRUE
      ORDER BY sort_order ASC, task_name ASC
    `;
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning task definition infrastructure. Apply migration 202606300001_daily_cleaning_infrastructure.');
      return [];
    }
    throw error;
  }
}

export async function readActiveCleaningTask(taskId: string): Promise<DailyCleaningTaskDefinition | null> {
  try {
    const rows = await db().$queryRaw<DailyCleaningTaskDefinition[]>`
      ${taskSelectSql()}
      WHERE active = TRUE AND task_id = ${taskId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning task definition infrastructure while reading one task.');
      return null;
    }
    throw error;
  }
}

function recordSelectSql() {
  return Prisma.sql`
    SELECT
      cleaning_record_id AS "cleaningRecordId",
      sales_id AS "salesId",
      shift_date AS "shiftDate",
      store,
      manager,
      task_id AS "taskId",
      task_name AS "taskName",
      image_path AS "imagePath",
      timestamp,
      status,
      comments,
      follow_up_action AS "followUpAction",
      assigned_to AS "assignedTo",
      follow_up_status AS "followUpStatus",
      cleaning_score AS "cleaningScore",
      module_type AS "moduleType"
    FROM daily_cleaning_records
  `;
}

export async function readCleaningRecords(filters: { shiftDate?: string; salesId?: string } = {}): Promise<DailyCleaningRecord[]> {
  const conditions: Prisma.Sql[] = [];
  if (filters.shiftDate) conditions.push(Prisma.sql`shift_date = ${filters.shiftDate}`);
  if (filters.salesId) conditions.push(Prisma.sql`sales_id = ${filters.salesId}`);
  const whereSql = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
  try {
    return await db().$queryRaw<DailyCleaningRecord[]>`
      ${recordSelectSql()}
      ${whereSql}
      ORDER BY shift_date DESC, task_name ASC
    `;
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning records infrastructure. Apply migration 202606300001_daily_cleaning_infrastructure.');
      return [];
    }
    throw error;
  }
}

export async function readCleaningRecordsForSales(salesId: string): Promise<DailyCleaningRecord[]> {
  return readCleaningRecords({ salesId });
}

export async function upsertCleaningRecord(input: {
  salesId: string;
  shiftDate: string;
  store: string;
  manager: string;
  task: DailyCleaningTaskDefinition;
  imagePath: string;
  status: string;
  comments: string;
  followUpAction: string;
  assignedTo: string;
  followUpStatus: string;
}): Promise<DailyCleaningRecord> {
  try {
    const rows = await db().$queryRaw<DailyCleaningRecord[]>`
    INSERT INTO daily_cleaning_records (
      cleaning_record_id, sales_id, shift_date, store, manager, task_id, task_name,
      image_path, timestamp, status, comments, follow_up_action, assigned_to,
      follow_up_status, cleaning_score, module_type, created_at, updated_at
    ) VALUES (
      ${uuidv4()}, ${input.salesId}, ${input.shiftDate}, ${input.store}, ${input.manager},
      ${input.task.taskId}, ${input.task.taskName}, ${input.imagePath}, NOW(), ${input.status},
      ${input.comments}, ${input.followUpAction}, ${input.assignedTo}, ${input.followUpStatus},
      0, ${input.task.moduleType}, NOW(), NOW()
    )
    ON CONFLICT (sales_id, task_id) DO UPDATE SET
      shift_date = EXCLUDED.shift_date,
      store = EXCLUDED.store,
      manager = EXCLUDED.manager,
      task_name = EXCLUDED.task_name,
      image_path = EXCLUDED.image_path,
      timestamp = EXCLUDED.timestamp,
      status = EXCLUDED.status,
      comments = EXCLUDED.comments,
      follow_up_action = EXCLUDED.follow_up_action,
      assigned_to = EXCLUDED.assigned_to,
      follow_up_status = EXCLUDED.follow_up_status,
      module_type = EXCLUDED.module_type,
      updated_at = NOW()
    RETURNING
      cleaning_record_id AS "cleaningRecordId", sales_id AS "salesId", shift_date AS "shiftDate",
      store, manager, task_id AS "taskId", task_name AS "taskName", image_path AS "imagePath",
      timestamp, status, comments, follow_up_action AS "followUpAction", assigned_to AS "assignedTo",
      follow_up_status AS "followUpStatus", cleaning_score AS "cleaningScore", module_type AS "moduleType"
  `;
    return rows[0];
  } catch (error) {
    console.error('[daily-cleaning] Failed to upsert Daily Cleaning record:', error);
    throw error;
  }
}

export async function updateCleaningScoreForSales(salesId: string, cleaningScore: number): Promise<void> {
  try {
    await db().$executeRaw`
      UPDATE daily_cleaning_records
      SET cleaning_score = ${cleaningScore}, updated_at = NOW()
      WHERE sales_id = ${salesId}
    `;
  } catch (error) {
    console.error('[daily-cleaning] Failed to update Daily Cleaning score:', error);
    throw error;
  }
}

export function missingCleaningTasks(tasks: DailyCleaningTaskDefinition[], records: DailyCleaningRecord[]) {
  const cleaningByTask = new Map(records.map((record) => [record.taskId, record]));
  return tasks.filter((task) => {
    const record = cleaningByTask.get(task.taskId);
    return !record || !record.status || !record.imagePath || (record.status === 'Requires Attention' && (!record.comments?.trim() || !record.followUpAction?.trim() || !record.assignedTo?.trim() || !record.followUpStatus?.trim()));
  });
}
