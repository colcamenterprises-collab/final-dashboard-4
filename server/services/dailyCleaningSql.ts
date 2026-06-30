import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/prisma';


const APPROVED_DAILY_CLEANING_TASK_IDS = [
  'floors-under-benches',
  'grill-extraction-system',
  'benches-food-prep-areas',
  'outside-wash-area',
  'kitchen-ready-for-tomorrow',
] as const;

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

export const DAILY_CLEANING_INFRASTRUCTURE_MISSING = 'DAILY_CLEANING_INFRASTRUCTURE_MISSING';
export const DAILY_CLEANING_RECORDS_INFRASTRUCTURE_MISSING = 'DAILY_CLEANING_RECORDS_INFRASTRUCTURE_MISSING';

export class DailyCleaningInfrastructureUnavailableError extends Error {
  code: string;
  where: string;
  canonicalSource: string;

  constructor(code: string, message: string, where: string, canonicalSource: string) {
    super(message);
    this.name = 'DailyCleaningInfrastructureUnavailableError';
    this.code = code;
    this.where = where;
    this.canonicalSource = canonicalSource;
  }
}

export function isDailyCleaningInfrastructureUnavailableError(error: unknown): error is DailyCleaningInfrastructureUnavailableError {
  return error instanceof DailyCleaningInfrastructureUnavailableError;
}

export function dailyCleaningInfrastructureBlocker(error: DailyCleaningInfrastructureUnavailableError) {
  return dailyCleaningBlocker(error.code, error.message, error.where, error.canonicalSource);
}

function missingTaskDefinitionsError(where: string) {
  return new DailyCleaningInfrastructureUnavailableError(
    DAILY_CLEANING_INFRASTRUCTURE_MISSING,
    'Daily Cleaning infrastructure is not available. Please apply the database migration.',
    where,
    'daily_cleaning_task_definitions'
  );
}

function missingRecordsError(where: string) {
  return new DailyCleaningInfrastructureUnavailableError(
    DAILY_CLEANING_RECORDS_INFRASTRUCTURE_MISSING,
    'Daily Cleaning records infrastructure is not available. Please apply the database migration.',
    where,
    'daily_cleaning_records'
  );
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


export async function ensureApprovedDailyCleaningTasks(): Promise<void> {
  try {
    await db().$transaction([
      db().$executeRaw`
        INSERT INTO daily_cleaning_task_definitions (id, task_id, task_name, standard, module_type, task_type, frequency, photo_required, active, sort_order)
        VALUES
          ('clean_daily_floors_under_benches', 'floors-under-benches', 'Floors & Under Benches', '["Floors are mopped, under benches are clean, and no food scraps or rubbish remain."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 10),
          ('clean_daily_grill_extraction_system', 'grill-extraction-system', 'Grill & Extraction System', '["Grill, splashback, extraction hood and extraction filters/fans are clean and free from grease."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 20),
          ('clean_daily_benches_food_prep_areas', 'benches-food-prep-areas', 'Benches & Food Prep Areas', '["All benches, food preparation areas and equipment are cleaned and sanitised."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 30),
          ('clean_daily_outside_wash_area', 'outside-wash-area', 'Outside & Wash Area', '["Outside area is clean, rubbish removed, and sink/wash area is clean and tidy."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 40),
          ('clean_daily_kitchen_ready_tomorrow', 'kitchen-ready-for-tomorrow', 'Kitchen Ready for Tomorrow', '["Kitchen is clean, organised and ready for the next shift."]'::jsonb, 'daily_cleaning', 'cleaning', 'daily', TRUE, TRUE, 50)
        ON CONFLICT (task_id) DO UPDATE SET
          task_name = EXCLUDED.task_name,
          standard = EXCLUDED.standard,
          module_type = EXCLUDED.module_type,
          task_type = EXCLUDED.task_type,
          frequency = EXCLUDED.frequency,
          photo_required = TRUE,
          active = TRUE,
          sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
      `,
      db().$executeRaw`
        UPDATE daily_cleaning_task_definitions
        SET active = FALSE,
            updated_at = NOW()
        WHERE module_type = 'daily_cleaning'
          AND task_id NOT IN (${Prisma.join(APPROVED_DAILY_CLEANING_TASK_IDS)})
      `,
    ]);
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning task definition infrastructure while enforcing approved task seed.');
      throw missingTaskDefinitionsError('/api/daily-cleaning/tasks');
    }
    throw error;
  }
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
    await ensureApprovedDailyCleaningTasks();
    return await db().$queryRaw<DailyCleaningTaskDefinition[]>`
      ${taskSelectSql()}
      WHERE active = TRUE
        AND module_type = 'daily_cleaning'
        AND task_id IN (${Prisma.join(APPROVED_DAILY_CLEANING_TASK_IDS)})
      ORDER BY sort_order ASC, task_name ASC
    `;
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning task definition infrastructure. Apply migration 202606300001_daily_cleaning_infrastructure.');
      throw missingTaskDefinitionsError('/api/daily-cleaning/tasks');
    }
    throw error;
  }
}

export async function readActiveCleaningTask(taskId: string): Promise<DailyCleaningTaskDefinition | null> {
  try {
    await ensureApprovedDailyCleaningTasks();
    const rows = await db().$queryRaw<DailyCleaningTaskDefinition[]>`
      ${taskSelectSql()}
      WHERE active = TRUE
        AND module_type = 'daily_cleaning'
        AND task_id IN (${Prisma.join(APPROVED_DAILY_CLEANING_TASK_IDS)})
        AND task_id = ${taskId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingDailyCleaningInfrastructureError(error)) {
      console.error('[daily-cleaning] Missing Daily Cleaning task definition infrastructure while reading one task.');
      throw missingTaskDefinitionsError('/api/daily-cleaning/task');
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
      throw missingRecordsError('/api/daily-cleaning');
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
  followUpStatus: string | null;
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
      ${input.comments}, ${input.followUpAction}, ${input.assignedTo}, ${input.followUpStatus || null},
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
