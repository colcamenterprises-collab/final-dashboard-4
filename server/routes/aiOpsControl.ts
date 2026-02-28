import { Router } from "express";
import { pool } from "../db";
import { z } from "zod";

const router = Router();

const frequencyEnum = z.enum(["once", "daily", "weekly", "monthly", "ad-hoc"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const statusEnum = z.enum(["draft", "not_assigned", "assigned", "in_progress", "blocked", "done", "cancelled"]);
const assignedToEnum = z.enum(["bob", "jussi", "sally", "supplier", "codex"]);
const eventTypeEnum = z.enum(["created", "status_changed", "assigned", "note_added", "publish_toggled", "edited"]);

const taskCreateSchema = z.object({
  taskNumber: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  frequency: frequencyEnum.default("ad-hoc"),
  priority: priorityEnum.default("medium"),
  status: statusEnum.default("draft"),
  assignedTo: assignedToEnum.optional().nullable(),
  publish: z.boolean().default(false),
  dueAt: z.string().datetime().optional().nullable(),
  createdBy: z.string().trim().min(1).max(120).default("Cameron"),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  frequency: frequencyEnum.optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  assignedTo: assignedToEnum.optional().nullable(),
  publish: z.boolean().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  actor: z.string().trim().min(1).max(120).default("Cameron"),
}).refine((body) => Object.keys(body).some((key) => key !== "actor"), {
  message: "At least one updatable field is required",
});

const noteCreateSchema = z.object({
  actor: z.string().trim().min(1).max(120).default("Cameron"),
  note: z.string().trim().min(1).max(4000),
  publish: z.boolean().optional().default(false),
  eventType: eventTypeEnum.optional().default("note_added"),
});

const taskIdSchema = z.string().uuid();

function parseTaskId(rawId: string) {
  const parsed = taskIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

router.get("/tasks", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const assignedTo = typeof req.query.assignedTo === "string" ? req.query.assignedTo : undefined;

  const params: Array<string> = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    where.push(`assigned_to = $${params.length}`);
  }

  const query = `
    SELECT
      id,
      task_number AS "taskNumber",
      title,
      description,
      frequency,
      priority,
      status,
      assigned_to AS "assignedTo",
      publish,
      due_at AS "dueAt",
      created_by AS "createdBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
    FROM ai_tasks
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT 300
  `;

  const result = await pool.query(query, params);
  return res.json({ items: result.rows });
});

router.post("/tasks", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const insertResult = await pool.query(
    `
      INSERT INTO ai_tasks (
        task_number, title, description, frequency, priority, status,
        assigned_to, publish, due_at, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id,
        task_number AS "taskNumber",
        title,
        description,
        frequency,
        priority,
        status,
        assigned_to AS "assignedTo",
        publish,
        due_at AS "dueAt",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        completed_at AS "completedAt"
    `,
    [
      payload.taskNumber ?? null,
      payload.title,
      payload.description ?? null,
      payload.frequency,
      payload.priority,
      payload.status,
      payload.assignedTo ?? null,
      payload.publish,
      payload.dueAt ? new Date(payload.dueAt) : null,
      payload.createdBy,
    ],
  );

  const task = insertResult.rows[0];

  await pool.query(
    `
      INSERT INTO ai_task_events (task_id, event_type, actor, from_status, to_status, note, payload)
      VALUES ($1, 'created', $2, NULL, $3, $4, $5::jsonb)
    `,
    [task.id, payload.createdBy, task.status, payload.description ?? null, JSON.stringify({ assignedTo: task.assignedTo, publish: task.publish })],
  );

  return res.status(201).json(task);
});

router.patch("/tasks/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const taskId = parseTaskId(req.params.id);
  if (!taskId) {
    return res.status(400).json({ message: "Invalid task id" });
  }
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const currentResult = await pool.query(`SELECT * FROM ai_tasks WHERE id = $1`, [taskId]);
  if (!currentResult.rows.length) {
    return res.status(404).json({ message: "Task not found" });
  }

  const current = currentResult.rows[0];
  const body = parsed.data;
  const nextStatus = body.status ?? current.status;

  const updatedResult = await pool.query(
    `
      UPDATE ai_tasks
      SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        frequency = COALESCE($4, frequency),
        priority = COALESCE($5, priority),
        status = COALESCE($6, status),
        assigned_to = CASE WHEN $7::text IS NULL AND $8 THEN NULL ELSE COALESCE($7, assigned_to) END,
        publish = COALESCE($9, publish),
        due_at = CASE WHEN $10::timestamptz IS NULL AND $11 THEN NULL ELSE COALESCE($10, due_at) END,
        updated_at = NOW(),
        completed_at = CASE WHEN $6 = 'done' AND $12 <> 'done' THEN NOW() WHEN $6 IS NOT NULL AND $6 <> 'done' THEN NULL ELSE completed_at END
      WHERE id = $1
      RETURNING id,
        task_number AS "taskNumber",
        title,
        description,
        frequency,
        priority,
        status,
        assigned_to AS "assignedTo",
        publish,
        due_at AS "dueAt",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        completed_at AS "completedAt"
    `,
    [
      taskId,
      body.title ?? null,
      body.description ?? null,
      body.frequency ?? null,
      body.priority ?? null,
      body.status ?? null,
      body.assignedTo ?? null,
      Object.prototype.hasOwnProperty.call(body, "assignedTo"),
      body.publish,
      body.dueAt ? new Date(body.dueAt) : null,
      Object.prototype.hasOwnProperty.call(body, "dueAt"),
      current.status,
    ],
  );

  const updated = updatedResult.rows[0];

  const events: Array<{ eventType: string; fromStatus: string | null; toStatus: string | null; note: string | null; payload: Record<string, unknown> }> = [];

  if (body.status && body.status !== current.status) {
    events.push({ eventType: "status_changed", fromStatus: current.status, toStatus: body.status, note: null, payload: {} });
  }
  if (Object.prototype.hasOwnProperty.call(body, "assignedTo") && body.assignedTo !== current.assigned_to) {
    events.push({ eventType: "assigned", fromStatus: null, toStatus: null, note: null, payload: { fromAssignedTo: current.assigned_to, toAssignedTo: body.assignedTo } });
  }
  if (Object.prototype.hasOwnProperty.call(body, "publish") && body.publish !== current.publish) {
    events.push({ eventType: "publish_toggled", fromStatus: null, toStatus: null, note: null, payload: { fromPublish: current.publish, toPublish: body.publish } });
  }

  if (!events.length) {
    events.push({ eventType: "edited", fromStatus: current.status, toStatus: nextStatus, note: null, payload: { changedFields: Object.keys(body).filter((key) => key !== "actor") } });
  }

  for (const event of events) {
    await pool.query(
      `
        INSERT INTO ai_task_events (task_id, event_type, actor, from_status, to_status, note, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      `,
      [taskId, event.eventType, body.actor, event.fromStatus, event.toStatus, event.note, JSON.stringify(event.payload)],
    );
  }

  return res.json(updated);
});

router.post("/tasks/:id/notes", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const taskId = parseTaskId(req.params.id);
  if (!taskId) {
    return res.status(400).json({ message: "Invalid task id" });
  }
  const parsed = noteCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const taskResult = await pool.query(`SELECT id FROM ai_tasks WHERE id = $1`, [taskId]);
  if (!taskResult.rows.length) {
    return res.status(404).json({ message: "Task not found" });
  }

  const body = parsed.data;
  const result = await pool.query(
    `
      INSERT INTO ai_task_events (task_id, event_type, actor, note, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, task_id AS "taskId", event_type AS "eventType", actor, from_status AS "fromStatus", to_status AS "toStatus", note, payload, created_at AS "createdAt"
    `,
    [taskId, body.eventType, body.actor, body.note, JSON.stringify({ publish: body.publish })],
  );

  return res.status(201).json(result.rows[0]);
});

router.get("/tasks/:id/events", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const taskId = parseTaskId(req.params.id);
  if (!taskId) {
    return res.status(400).json({ message: "Invalid task id" });
  }
  const result = await pool.query(
    `
      SELECT
        id,
        task_id AS "taskId",
        event_type AS "eventType",
        actor,
        from_status AS "fromStatus",
        to_status AS "toStatus",
        note,
        payload,
        created_at AS "createdAt"
      FROM ai_task_events
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [taskId],
  );

  return res.json({ items: result.rows });
});

export default router;
