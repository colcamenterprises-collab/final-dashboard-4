import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../lib/prisma';

const router = express.Router();
const VALID_STATUSES = new Set(['Pass', 'Requires Attention']);

type CleaningTask = {
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
  createdAt?: Date;
  updatedAt?: Date;
};

type CleaningRecord = {
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
  createdAt?: Date;
  updatedAt?: Date;
};

function dateParts(shiftDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return null;
  const [year, month, day] = shiftDate.split('-');
  return { year, month, day };
}

function uploadDirFor(shiftDate: string) {
  const parts = dateParts(shiftDate);
  if (!parts) return null;
  return path.join(process.cwd(), 'uploads', 'cleaning', parts.year, parts.month, parts.day);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const shiftDate = String(req.body.shiftDate || '');
    const dir = uploadDirFor(shiftDate);
    if (!dir) return cb(new Error('shiftDate must be YYYY-MM-DD'), '');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const taskId = String(req.body.taskId || 'task').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${taskId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

function taskFromRow(row: any): CleaningTask {
  return {
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    standard: row.standard ?? [],
    moduleType: row.module_type,
    taskType: row.task_type,
    frequency: row.frequency,
    photoRequired: row.photo_required,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordFromRow(row: any): CleaningRecord {
  return {
    cleaningRecordId: row.cleaning_record_id,
    salesId: row.sales_id,
    shiftDate: row.shift_date,
    store: row.store,
    manager: row.manager,
    taskId: row.task_id,
    taskName: row.task_name,
    imagePath: row.image_path,
    timestamp: row.timestamp,
    status: row.status,
    comments: row.comments,
    followUpAction: row.follow_up_action,
    assignedTo: row.assigned_to,
    followUpStatus: row.follow_up_status,
    cleaningScore: row.cleaning_score,
    moduleType: row.module_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function activeTasks(): Promise<CleaningTask[]> {
  const rows = await db().$queryRawUnsafe<any[]>(`
    SELECT id, task_id, task_name, standard, module_type, task_type, frequency, photo_required, active, sort_order, created_at, updated_at
    FROM daily_cleaning_task_definitions
    WHERE active = true
    ORDER BY sort_order ASC, task_name ASC
  `);
  return rows.map(taskFromRow);
}

async function cleaningRecords(where: { shiftDate?: string; salesId?: string }): Promise<CleaningRecord[]> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (where.shiftDate) { params.push(where.shiftDate); clauses.push(`shift_date = $${params.length}`); }
  if (where.salesId) { params.push(where.salesId); clauses.push(`sales_id = $${params.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db().$queryRawUnsafe<any[]>(`
    SELECT cleaning_record_id, sales_id, shift_date, store, manager, task_id, task_name, image_path, timestamp, status, comments,
           follow_up_action, assigned_to, follow_up_status, cleaning_score, module_type, created_at, updated_at
    FROM daily_cleaning_records
    ${whereSql}
    ORDER BY shift_date DESC, task_name ASC
  `, ...params);
  return rows.map(recordFromRow);
}

function missingRequiredTasks(tasks: CleaningTask[], rows: CleaningRecord[]) {
  const rowByTask = new Map(rows.map((row) => [row.taskId, row]));
  return tasks.filter((task) => {
    const row = rowByTask.get(task.taskId);
    return !row || !row.status || !row.imagePath || (row.status === 'Requires Attention' && (!row.comments?.trim() || !row.followUpAction?.trim() || !row.assignedTo?.trim() || !row.followUpStatus?.trim()));
  });
}

router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await activeTasks();
    res.json({ ok: true, source: 'daily_cleaning_task_definitions', data: tasks, blockers: [] });
  } catch (error: any) {
    res.status(200).json({
      ok: false,
      source: 'daily_cleaning_task_definitions',
      data: [],
      blockers: [{ code: 'CLEANING_TASKS_UNAVAILABLE', message: error?.message || 'Unable to load cleaning tasks', where: '/api/daily-cleaning/tasks', canonical_source: 'daily_cleaning_task_definitions', auto_build_attempted: false }],
    });
  }
});

router.get('/', async (req, res) => {
  const shiftDate = typeof req.query.shiftDate === 'string' ? req.query.shiftDate : undefined;
  const salesId = typeof req.query.salesId === 'string' ? req.query.salesId : undefined;
  try {
    const rows = await cleaningRecords({ shiftDate, salesId });
    res.json({ ok: true, source: 'daily_cleaning_records', rows, count: rows.length, blockers: [] });
  } catch (error: any) {
    res.status(200).json({ ok: false, source: 'daily_cleaning_records', rows: [], count: 0, blockers: [{ code: 'CLEANING_RECORDS_UNAVAILABLE', message: error?.message || 'Unable to load cleaning records', where: '/api/daily-cleaning', canonical_source: 'daily_cleaning_records', auto_build_attempted: false }] });
  }
});

router.post('/task', upload.single('photo'), async (req, res) => {
  try {
    const { salesId, shiftDate, store = 'SBB', manager = '', taskId, status, comments = '', followUpAction = '', assignedTo = '', followUpStatus = '' } = req.body;
    const errors: string[] = [];
    if (!salesId) errors.push('salesId is required');
    if (!dateParts(String(shiftDate))) errors.push('shiftDate must be YYYY-MM-DD');
    if (!taskId) errors.push('taskId is required');
    if (!VALID_STATUSES.has(String(status))) errors.push('status must be Pass or Requires Attention');
    if (status === 'Requires Attention' && !String(comments).trim()) errors.push('comments are required when status is Requires Attention');
    if (status === 'Requires Attention' && !String(followUpAction).trim()) errors.push('follow-up action is required when status is Requires Attention');
    if (status === 'Requires Attention' && !String(assignedTo).trim()) errors.push('assigned to is required when status is Requires Attention');
    if (status === 'Requires Attention' && !['Open', 'Closed'].includes(String(followUpStatus))) errors.push('follow-up status must be Open or Closed when status is Requires Attention');
    if (!req.file) errors.push('photo is required');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const tasks = await activeTasks();
    const task = tasks.find((row) => row.taskId === String(taskId));
    if (!task) return res.status(400).json({ ok: false, errors: ['Unknown or inactive cleaning task'] });

    const imagePath = `/uploads/cleaning/${String(shiftDate).replaceAll('-', '/')}/${req.file!.filename}`;
    const rows = await db().$queryRawUnsafe<any[]>(`
      INSERT INTO daily_cleaning_records (
        sales_id, shift_date, store, manager, task_id, task_name, image_path, timestamp, status, comments,
        follow_up_action, assigned_to, follow_up_status, cleaning_score, module_type, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11,$12,0,$13,NOW())
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
      RETURNING cleaning_record_id, sales_id, shift_date, store, manager, task_id, task_name, image_path, timestamp, status, comments,
                follow_up_action, assigned_to, follow_up_status, cleaning_score, module_type, created_at, updated_at
    `, String(salesId), String(shiftDate), String(store), String(manager), task.taskId, task.taskName, imagePath, String(status), String(comments || ''), String(followUpAction || ''), String(assignedTo || ''), String(followUpStatus || ''), task.moduleType);

    const allRows = await cleaningRecords({ salesId: String(salesId) });
    const passCount = allRows.filter((row) => row.status === 'Pass').length;
    const cleaningScore = tasks.length > 0 ? Math.round((passCount / tasks.length) * 100) : 0;
    await db().$executeRawUnsafe(`UPDATE daily_cleaning_records SET cleaning_score = $1, updated_at = NOW() WHERE sales_id = $2`, cleaningScore, String(salesId));
    res.json({ ok: true, record: { ...recordFromRow(rows[0]), cleaningScore }, cleaningScore });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Failed to save cleaning task' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { salesId } = req.body;
    if (!salesId) return res.status(400).json({ ok: false, error: 'salesId is required' });
    const tasks = await activeTasks();
    const rows = await cleaningRecords({ salesId: String(salesId) });
    const missing = missingRequiredTasks(tasks, rows);
    if (missing.length) return res.status(400).json({ ok: false, error: `Shift cannot be submitted. Missing: Daily Cleaning.`, missing: missing.map((task) => task.taskName) });
    const passCount = rows.filter((row) => row.status === 'Pass').length;
    const cleaningScore = tasks.length > 0 ? Math.round((passCount / tasks.length) * 100) : 0;
    await db().$executeRawUnsafe(`UPDATE daily_cleaning_records SET cleaning_score = $1, updated_at = NOW() WHERE sales_id = $2`, cleaningScore, String(salesId));
    const overallStatus = rows.some((row) => row.status === 'Requires Attention') ? 'Requires Attention' : 'Pass';
    res.json({ ok: true, status: 'Completed', completedAt: new Date().toISOString(), manager: rows[0]?.manager || '', tasksCompleted: rows.length, overallStatus, cleaningScore });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Failed to complete cleaning' });
  }
});

export default router;
