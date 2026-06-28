import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../lib/prisma';

const router = express.Router();
const VALID_STATUSES = new Set(['Pass', 'Requires Attention']);
const PHASE_1_TASKS = [
  { id: 'clean_daily_kitchen_floors', taskId: 'kitchen-floors', taskName: 'Kitchen Floors', standard: ['Swept', 'Mopped', 'No food debris', 'No grease', 'No standing water'], moduleType: 'daily_cleaning', taskType: 'cleaning', frequency: 'daily', photoRequired: true, active: true, sortOrder: 10 },
  { id: 'clean_daily_food_prep', taskId: 'food-preparation-area', taskName: 'Food Preparation Area', standard: ['Prep benches sanitised', 'Meat prep area cleaned', 'Food contact surfaces sanitised', 'No food residue'], moduleType: 'daily_cleaning', taskType: 'cleaning', frequency: 'daily', photoRequired: true, active: true, sortOrder: 20 },
  { id: 'clean_daily_grill_fryer', taskId: 'grill-fryer-station', taskName: 'Grill & Fryer Station', standard: ['Grill chemically cleaned', 'Fryer exterior cleaned', 'Splashbacks cleaned', 'Cooking line grease free'], moduleType: 'daily_cleaning', taskType: 'cleaning', frequency: 'daily', photoRequired: true, active: true, sortOrder: 30 },
  { id: 'clean_daily_customer_area', taskId: 'customer-area', taskName: 'Customer Area', standard: ['Tables clean', 'Front counter clean', 'Customer area clean', 'Floor free of rubbish'], moduleType: 'daily_cleaning', taskType: 'cleaning', frequency: 'daily', photoRequired: true, active: true, sortOrder: 40 },
  { id: 'clean_daily_waste_washing', taskId: 'waste-washing-area', taskName: 'Waste & Washing Area', standard: ['Bins emptied', 'Bins cleaned', 'Washing area clean', 'Equipment washed and stored'], moduleType: 'daily_cleaning', taskType: 'cleaning', frequency: 'daily', photoRequired: true, active: true, sortOrder: 50 },
];

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

async function activeTasks() {
  const tasks = await db().dailyCleaningTaskDefinition.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { taskName: 'asc' }],
  });
  if (tasks.length === 0) {
    console.error('[daily-cleaning/tasks] No active task definitions found in daily_cleaning_task_definitions; using Phase 1 fallback tasks.');
    return PHASE_1_TASKS;
  }
  return tasks;
}

function taskById(taskId: string) {
  return PHASE_1_TASKS.find((task) => task.taskId === taskId);
}

router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await activeTasks();
    if (tasks.length === 0) {
      console.error('[daily-cleaning/tasks] Task lookup returned zero tasks after fallback.');
    }
    res.json({ ok: true, source: 'daily_cleaning_task_definitions', data: tasks, blockers: [] });
  } catch (error: any) {
    console.error('[daily-cleaning/tasks] Failed to load cleaning tasks:', error);
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
    const rows = await db().dailyCleaningRecord.findMany({
      where: { ...(shiftDate ? { shiftDate } : {}), ...(salesId ? { salesId } : {}) },
      orderBy: [{ shiftDate: 'desc' }, { taskName: 'asc' }],
    });
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

    const dbTask = await db().dailyCleaningTaskDefinition.findUnique({ where: { taskId: String(taskId) } });
    const task = dbTask?.active ? dbTask : taskById(String(taskId));
    if (!task) {
      console.error('[daily-cleaning/task] Unknown or inactive cleaning task:', taskId);
      return res.status(400).json({ ok: false, errors: ['Unknown or inactive cleaning task'] });
    }
    if (!dbTask?.active) console.error('[daily-cleaning/task] Saving with Phase 1 fallback task definition because DB definition is missing or inactive:', taskId);

    const imagePath = `/uploads/cleaning/${String(shiftDate).replaceAll('-', '/')}/${req.file!.filename}`;
    const record = await db().dailyCleaningRecord.upsert({
      where: { salesId_taskId: { salesId: String(salesId), taskId: String(taskId) } },
      create: {
        salesId: String(salesId), shiftDate: String(shiftDate), store: String(store), manager: String(manager),
        taskId: task.taskId, taskName: task.taskName, imagePath, timestamp: new Date(), status: String(status), comments: String(comments || ''),
        followUpAction: String(followUpAction || ''), assignedTo: String(assignedTo || ''), followUpStatus: String(followUpStatus || ''), cleaningScore: 0, moduleType: task.moduleType,
      },
      update: { shiftDate: String(shiftDate), store: String(store), manager: String(manager), taskName: task.taskName, imagePath, timestamp: new Date(), status: String(status), comments: String(comments || ''), followUpAction: String(followUpAction || ''), assignedTo: String(assignedTo || ''), followUpStatus: String(followUpStatus || ''), moduleType: task.moduleType },
    });
    const allRows = await db().dailyCleaningRecord.findMany({ where: { salesId: String(salesId) } });
    const allTasks = await activeTasks();
    const passCount = allRows.filter((row) => row.status === 'Pass').length;
    const cleaningScore = allTasks.length > 0 ? Math.round((passCount / allTasks.length) * 100) : 0;
    await db().dailyCleaningRecord.updateMany({ where: { salesId: String(salesId) }, data: { cleaningScore } });
    res.json({ ok: true, record: { ...record, cleaningScore }, cleaningScore });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Failed to save cleaning task' });
  }
});

router.post('/complete', async (req, res) => {
  const { salesId } = req.body;
  if (!salesId) return res.status(400).json({ ok: false, error: 'salesId is required' });
  const tasks = await activeTasks();
  const rows = await db().dailyCleaningRecord.findMany({ where: { salesId: String(salesId) } });
  const rowByTask = new Map(rows.map((row) => [row.taskId, row]));
  const missing = tasks.filter((task) => {
    const row = rowByTask.get(task.taskId);
    return !row || !row.status || !row.imagePath || (row.status === 'Requires Attention' && (!row.comments?.trim() || !row.followUpAction?.trim() || !row.assignedTo?.trim() || !row.followUpStatus?.trim()));
  });
  if (missing.length) return res.status(400).json({ ok: false, error: `Shift cannot be submitted. Missing: Daily Cleaning.`, missing: missing.map((task) => task.taskName) });
  const passCount = rows.filter((row) => row.status === 'Pass').length;
  const cleaningScore = tasks.length > 0 ? Math.round((passCount / tasks.length) * 100) : 0;
  await db().dailyCleaningRecord.updateMany({ where: { salesId: String(salesId) }, data: { cleaningScore } });
  const overallStatus = rows.some((row) => row.status === 'Requires Attention') ? 'Requires Attention' : 'Pass';
  res.json({ ok: true, status: 'Completed', completedAt: new Date().toISOString(), manager: rows[0]?.manager || '', tasksCompleted: rows.length, overallStatus, cleaningScore });
});

export default router;
