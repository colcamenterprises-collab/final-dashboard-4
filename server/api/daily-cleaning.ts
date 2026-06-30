import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { dailyCleaningBlocker, dailyCleaningInfrastructureBlocker, isDailyCleaningInfrastructureUnavailableError, missingCleaningTasks, readActiveCleaningTask, readActiveCleaningTasks, readCleaningRecords, readCleaningRecordsForSales, safeDailyCleaningErrorMessage, updateCleaningScoreForSales, upsertCleaningRecord } from '../services/dailyCleaningSql';

const router = express.Router();
const VALID_STATUSES = new Set(['Pass', 'Requires Attention']);
const STAFF_SAVE_FAILURE_MESSAGE = 'This task could not be saved. Please try again or contact an administrator.';

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
  return readActiveCleaningTasks();
}

router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await activeTasks();
    res.json({ ok: true, source: 'daily_cleaning_task_definitions', data: tasks, tasks, blockers: [] });
  } catch (error: any) {
    console.error('[daily-cleaning/tasks] Failed to load cleaning tasks:', error);
    if (isDailyCleaningInfrastructureUnavailableError(error)) {
      return res.status(200).json({
        ok: false,
        source: 'daily_cleaning_task_definitions',
        data: [],
        tasks: [],
        blockers: [dailyCleaningInfrastructureBlocker(error)],
      });
    }
    res.status(200).json({
      ok: false,
      source: 'daily_cleaning_task_definitions',
      data: [],
      tasks: [],
      blockers: [dailyCleaningBlocker('CLEANING_TASKS_UNAVAILABLE', safeDailyCleaningErrorMessage('tasks'), '/api/daily-cleaning/tasks', 'daily_cleaning_task_definitions')],
    });
  }
});

router.get('/', async (req, res) => {
  const shiftDate = typeof req.query.shiftDate === 'string' ? req.query.shiftDate : undefined;
  const salesId = typeof req.query.salesId === 'string' ? req.query.salesId : undefined;
  try {
    const rows = await readCleaningRecords({ shiftDate, salesId });
    res.json({ ok: true, source: 'daily_cleaning_records', rows, count: rows.length, blockers: [] });
  } catch (error: any) {
    console.error('[daily-cleaning] Failed to load cleaning records:', error);
    if (isDailyCleaningInfrastructureUnavailableError(error)) {
      return res.status(200).json({ ok: false, source: 'daily_cleaning_records', rows: [], count: 0, blockers: [dailyCleaningInfrastructureBlocker(error)] });
    }
    res.status(200).json({ ok: false, source: 'daily_cleaning_records', rows: [], count: 0, blockers: [dailyCleaningBlocker('CLEANING_RECORDS_UNAVAILABLE', safeDailyCleaningErrorMessage('records'), '/api/daily-cleaning', 'daily_cleaning_records')] });
  }
});

router.post('/task', (req, res, next) => {
  upload.single('photo')(req, res, (error: any) => {
    if (error) {
      console.error('[daily-cleaning/task] Failed to receive cleaning task upload:', error);
      return res.status(400).json({ ok: false, error: STAFF_SAVE_FAILURE_MESSAGE });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { salesId, shiftDate, store = 'SBB', manager = '', taskId, status, comments = '', followUpAction = '', assignedTo = '', followUpStatus = '', existingImagePath = '' } = req.body;
    const errors: string[] = [];
    if (!salesId) errors.push('salesId is required');
    if (!dateParts(String(shiftDate))) errors.push('shiftDate must be YYYY-MM-DD');
    if (!taskId) errors.push('taskId is required');
    if (!VALID_STATUSES.has(String(status))) errors.push('status must be Pass or Requires Attention');
    if (status === 'Requires Attention' && !String(comments).trim()) errors.push('comments are required when status is Requires Attention');
    if (status === 'Requires Attention' && !String(followUpAction).trim()) errors.push('follow-up action is required when status is Requires Attention');
    if (status === 'Requires Attention' && !String(assignedTo).trim()) errors.push('assigned to is required when status is Requires Attention');
    if (status === 'Requires Attention' && !['Open', 'Closed'].includes(String(followUpStatus))) errors.push('follow-up status must be Open or Closed when status is Requires Attention');
    if (!req.file && !String(existingImagePath).startsWith('/uploads/cleaning/')) errors.push('photo is required');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const task = await readActiveCleaningTask(String(taskId));
    if (!task) {
      console.error('[daily-cleaning/task] Unknown or inactive cleaning task:', taskId);
      return res.status(400).json({ ok: false, errors: ['Unknown or inactive cleaning task'] });
    }

    const imagePath = req.file
      ? `/uploads/cleaning/${String(shiftDate).replaceAll('-', '/')}/${req.file.filename}`
      : String(existingImagePath);
    const record = await upsertCleaningRecord({
      salesId: String(salesId), shiftDate: String(shiftDate), store: String(store), manager: String(manager),
      task, imagePath, status: String(status), comments: String(comments || ''),
      followUpAction: String(followUpAction || ''), assignedTo: String(assignedTo || ''), followUpStatus: status === 'Requires Attention' ? String(followUpStatus) : null,
    });
    const allRows = await readCleaningRecordsForSales(String(salesId));
    const allTasks = await activeTasks();
    const passCount = allRows.filter((row) => row.status === 'Pass').length;
    const cleaningScore = allTasks.length > 0 ? Math.round((passCount / allTasks.length) * 100) : 0;
    await updateCleaningScoreForSales(String(salesId), cleaningScore);
    res.json({ ok: true, record: { ...record, cleaningScore }, cleaningScore });
  } catch (error: any) {
    console.error('[daily-cleaning/task] Failed to save cleaning task:', error);
    if (isDailyCleaningInfrastructureUnavailableError(error)) {
      return res.status(200).json({ ok: false, status: 'Blocked', blockers: [dailyCleaningInfrastructureBlocker(error)] });
    }
    res.status(500).json({ ok: false, error: STAFF_SAVE_FAILURE_MESSAGE });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { salesId } = req.body;
    if (!salesId) return res.status(400).json({ ok: false, error: 'salesId is required' });
    const tasks = await activeTasks();
    if (tasks.length === 0) {
      return res.status(400).json({ ok: false, error: 'No cleaning tasks have been configured. Please contact an administrator.' });
    }
    const rows = await readCleaningRecordsForSales(String(salesId));
    const missing = missingCleaningTasks(tasks, rows);
    if (missing.length) return res.status(400).json({ ok: false, error: `Shift cannot be submitted. Missing: Daily Cleaning.`, missing: missing.map((task) => task.taskName) });
    const passCount = rows.filter((row) => row.status === 'Pass').length;
    const cleaningScore = tasks.length > 0 ? Math.round((passCount / tasks.length) * 100) : 0;
    await updateCleaningScoreForSales(String(salesId), cleaningScore);
    const overallStatus = rows.some((row) => row.status === 'Requires Attention') ? 'Requires Attention' : 'Pass';
    return res.json({ ok: true, status: 'Completed', completedAt: new Date().toISOString(), manager: rows[0]?.manager || '', tasksCompleted: rows.length, overallStatus, cleaningScore });
  } catch (error: any) {
    console.error('[daily-cleaning/complete] Failed to complete cleaning:', error);
    return res.status(200).json({
      ok: false,
      status: 'Blocked',
      blockers: [isDailyCleaningInfrastructureUnavailableError(error)
        ? dailyCleaningInfrastructureBlocker(error)
        : dailyCleaningBlocker('CLEANING_COMPLETION_UNAVAILABLE', safeDailyCleaningErrorMessage('completion'), '/api/daily-cleaning/complete', 'daily_cleaning_task_definitions + daily_cleaning_records')],
    });
  }
});

export default router;
