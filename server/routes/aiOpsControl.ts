import { Router } from "express";
import { pool } from "../db";
import { z } from "zod";

const router = Router();

const frequencyEnum = z.enum(["once", "daily", "weekly", "monthly", "ad-hoc"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const taskStatusEnum = z.enum(["draft", "not_assigned", "assigned", "in_progress", "blocked", "done", "cancelled", "needs_review", "approved", "changes_requested", "rejected"]);
const reviewDecisionEnum = z.enum(["approved", "changes_requested", "rejected"]);
const assignedToEnum = z.enum(["bob", "jussi", "sally", "supplier", "codex"]);
const agentStatusEnum = z.enum(["idle", "running", "waiting", "blocked", "error", "offline"]);
const activityActionEnum = z.enum(["CREATED", "ASSIGNED", "STATUS_CHANGED", "MESSAGE_ADDED", "REVIEW_REQUESTED", "REVIEW_DECIDED", "UPDATED_FIELDS"]);

type ActivityAction = z.infer<typeof activityActionEnum>;

const AGENTS = [
  { agent: "bob", name: "Bob", role: "AI Operations Manager", description: "Orchestrates tasks, assigns specialists, and maintains audit trail." },
  { agent: "jussi", name: "Jussi", role: "Operations Analyst", description: "Reconciles sales, stock variances, and item/modifier performance." },
  { agent: "sally", name: "Sally", role: "Financial Controller", description: "Audits wages, shift expenses, and 24-hour business costs." },
  { agent: "supplier", name: "Supplier", role: "Procurement Coordinator", description: "Prepares supplier orders and manages acknowledgements/deliveries." },
  { agent: "codex", name: "Codex", role: "Software Engineer", description: "Implements fixes, migrations, and system enhancements." },
] as const;

const taskCreateSchema = z.object({
  taskNumber: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  frequency: frequencyEnum.default("ad-hoc"),
  priority: priorityEnum.default("medium"),
  status: taskStatusEnum.default("draft"),
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
  status: taskStatusEnum.optional(),
  assignedTo: assignedToEnum.optional().nullable(),
  publish: z.boolean().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  actor: z.string().trim().min(1).max(120).default("Cameron"),
}).refine((body) => Object.keys(body).some((key) => key !== "actor"), {
  message: "At least one updatable field is required",
});

const statusUpdateSchema = z.object({
  status: taskStatusEnum,
  actor: z.string().trim().min(1).max(120).default("Cameron"),
  note: z.string().trim().max(4000).optional().nullable(),
});

const messageCreateSchema = z.object({
  actor: z.string().trim().min(1).max(120).default("Cameron"),
  message: z.string().trim().min(1).max(4000),
  visibility: z.enum(["internal", "public"]).default("internal"),
});

const reviewRequestSchema = z.object({
  actor: z.string().trim().min(1).max(120).default("Cameron"),
  note: z.string().trim().max(4000).optional().nullable(),
});

const reviewDecisionSchema = z.object({
  actor: z.string().trim().min(1).max(120).default("Cameron"),
  decision: reviewDecisionEnum,
  note: z.string().trim().max(4000).optional().nullable(),
});

const agentStateUpdateSchema = z.object({
  status: agentStatusEnum,
  statusMessage: z.string().trim().max(255).optional().nullable(),
  lastSeenAt: z.string().datetime().optional().nullable(),
});

const taskIdSchema = z.string().uuid();

function parseTaskId(rawId: string) {
  const parsed = taskIdSchema.safeParse(rawId);
  if (!parsed.success) return null;
  return parsed.data;
}

async function writeActivity(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, taskId: string, action: ActivityAction, actor: string, note: string | null, payload: Record<string, unknown> | null = null) {
  await client.query(
    `INSERT INTO ai_task_activity (task_id, action, actor, note, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [taskId, action, actor, note, JSON.stringify(payload ?? {})],
  );
}

router.get("/agents", async (_req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const stateResult = await pool.query(
    `SELECT agent_name AS "agent", status, status_message AS "statusMessage", last_seen_at AS "lastSeenAt", updated_at AS "updatedAt" FROM ai_agent_state`,
  );
  const stateMap = new Map(stateResult.rows.map((row) => [String(row.agent), row]));

  const items = AGENTS.map((agent) => {
    const state = stateMap.get(agent.agent);
    return {
      ...agent,
      status: state?.status ?? "idle",
      statusMessage: state?.statusMessage ?? null,
      lastSeenAt: state?.lastSeenAt ?? null,
      updatedAt: state?.updatedAt ?? null,
    };
  });

  return res.json({ items });
});

router.put("/agents/:agent/state", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const agentParsed = assignedToEnum.safeParse(req.params.agent);
  if (!agentParsed.success) return res.status(400).json({ message: "Invalid agent" });

  const payloadParsed = agentStateUpdateSchema.safeParse(req.body);
  if (!payloadParsed.success) return res.status(400).json({ message: "Invalid payload", errors: payloadParsed.error.flatten() });

  const payload = payloadParsed.data;
  const result = await pool.query(
    `UPDATE ai_agent_state
     SET status = $2,
         status_message = $3,
         last_seen_at = COALESCE($4, NOW()),
         updated_at = NOW()
     WHERE agent_name = $1
     RETURNING agent_name AS "agent", status, status_message AS "statusMessage", last_seen_at AS "lastSeenAt", updated_at AS "updatedAt"`,
    [agentParsed.data, payload.status, payload.statusMessage ?? null, payload.lastSeenAt ? new Date(payload.lastSeenAt) : null],
  );

  if (!result.rows.length) return res.status(404).json({ message: "Agent state not found" });
  return res.json(result.rows[0]);
});

router.get("/tasks", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const assignedTo = typeof req.query.assignedTo === "string" ? req.query.assignedTo : undefined;
  const publish = typeof req.query.publish === "string" ? req.query.publish : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  const params: Array<string | boolean> = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (assignedTo) {
    params.push(assignedTo);
    where.push(`assigned_to = $${params.length}`);
  }
  if (publish === "true" || publish === "false") {
    params.push(publish === "true");
    where.push(`publish = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }

  const result = await pool.query(
    `SELECT id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
            due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
     FROM ai_tasks
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT 300`,
    params,
  );

  return res.json({ items: result.rows });
});

router.post("/tasks", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertResult = await client.query(
      `INSERT INTO ai_tasks (task_number, title, description, frequency, priority, status, assigned_to, publish, due_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
                 due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"`,
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
    await writeActivity(client, task.id, "CREATED", payload.createdBy, payload.description ?? null, { status: task.status, assignedTo: task.assignedTo, publish: task.publish });
    if (task.assignedTo) {
      await writeActivity(client, task.id, "ASSIGNED", payload.createdBy, null, { assignedTo: task.assignedTo });
    }

    await client.query("COMMIT");
    return res.status(201).json(task);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.put("/tasks/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const body = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT * FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Task not found" });
    }

    const current = currentResult.rows[0];
    const updatedResult = await client.query(
      `UPDATE ai_tasks
       SET title = COALESCE($2, title),
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
       RETURNING id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
                 due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"`,
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

    const changedFields = Object.keys(body).filter((field) => field !== "actor");
    if (changedFields.length) {
      await writeActivity(client, taskId, "UPDATED_FIELDS", body.actor, null, { changedFields });
    }
    if (body.status && body.status !== current.status) {
      await writeActivity(client, taskId, "STATUS_CHANGED", body.actor, null, { from: current.status, to: body.status });
    }
    if (Object.prototype.hasOwnProperty.call(body, "assignedTo") && body.assignedTo !== current.assigned_to) {
      await writeActivity(client, taskId, "ASSIGNED", body.actor, null, { from: current.assigned_to, to: body.assignedTo ?? null });
    }

    await client.query("COMMIT");
    return res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.put("/tasks/:id/status", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Task not found" });
    }

    const currentStatus = currentResult.rows[0].status;
    const updateResult = await client.query(
      `UPDATE ai_tasks
       SET status = $2,
           updated_at = NOW(),
           completed_at = CASE WHEN $2 = 'done' AND $3 <> 'done' THEN NOW() WHEN $2 <> 'done' THEN NULL ELSE completed_at END
       WHERE id = $1
       RETURNING id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
                 due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"`,
      [taskId, payload.status, currentStatus],
    );

    await writeActivity(client, taskId, "STATUS_CHANGED", payload.actor, payload.note ?? null, { from: currentStatus, to: payload.status });
    await client.query("COMMIT");
    return res.json(updateResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/tasks/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const taskResult = await pool.query(
    `SELECT id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
            due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
     FROM ai_tasks
     WHERE id = $1`,
    [taskId],
  );
  if (!taskResult.rows.length) return res.status(404).json({ message: "Task not found" });

  const messagesResult = await pool.query(
    `SELECT id, task_id AS "taskId", actor, message, visibility, created_at AS "createdAt"
     FROM ai_task_messages WHERE task_id = $1 ORDER BY created_at ASC LIMIT 1000`,
    [taskId],
  );
  const reviewsResult = await pool.query(
    `SELECT id, task_id AS "taskId", requested_by AS "requestedBy", request_note AS "requestNote", requested_at AS "requestedAt",
            decision, decision_note AS "decisionNote", decided_by AS "decidedBy", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ai_task_reviews WHERE task_id = $1 ORDER BY requested_at DESC LIMIT 200`,
    [taskId],
  );
  const activityResult = await pool.query(
    `SELECT id, task_id AS "taskId", action, actor, note, payload, created_at AS "createdAt"
     FROM ai_task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1000`,
    [taskId],
  );

  return res.json({ ...taskResult.rows[0], messages: messagesResult.rows, reviews: reviewsResult.rows, activity: activityResult.rows });
});

router.post("/tasks/:id/messages", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const parsed = messageCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskResult = await client.query(`SELECT id FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!taskResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Task not found" });
    }

    const messageResult = await client.query(
      `INSERT INTO ai_task_messages (task_id, actor, message, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id AS "taskId", actor, message, visibility, created_at AS "createdAt"`,
      [taskId, payload.actor, payload.message, payload.visibility],
    );

    await writeActivity(client, taskId, "MESSAGE_ADDED", payload.actor, null, { visibility: payload.visibility });
    await client.query("COMMIT");
    return res.status(201).json(messageResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/tasks/:id/review-request", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const parsed = reviewRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskResult = await client.query(`SELECT status FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!taskResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Task not found" });
    }

    const reviewResult = await client.query(
      `INSERT INTO ai_task_reviews (task_id, requested_by, request_note)
       VALUES ($1, $2, $3)
       RETURNING id, task_id AS "taskId", requested_by AS "requestedBy", request_note AS "requestNote", requested_at AS "requestedAt", decision, decision_note AS "decisionNote", decided_by AS "decidedBy", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [taskId, payload.actor, payload.note ?? null],
    );

    await client.query(`UPDATE ai_tasks SET status = 'needs_review', updated_at = NOW() WHERE id = $1`, [taskId]);
    await writeActivity(client, taskId, "REVIEW_REQUESTED", payload.actor, payload.note ?? null, { fromStatus: taskResult.rows[0].status, toStatus: "needs_review" });
    await writeActivity(client, taskId, "STATUS_CHANGED", payload.actor, null, { from: taskResult.rows[0].status, to: "needs_review" });

    await client.query("COMMIT");
    return res.status(201).json(reviewResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/tasks/:id/review-decision", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });

  const parsed = reviewDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const nextStatus = payload.decision === "approved" ? "approved" : payload.decision;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskResult = await client.query(`SELECT status FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!taskResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Task not found" });
    }

    const reviewUpdateResult = await client.query(
      `WITH latest_pending AS (
         SELECT id FROM ai_task_reviews
         WHERE task_id = $1 AND decision IS NULL
         ORDER BY requested_at DESC
         LIMIT 1
       )
       UPDATE ai_task_reviews
       SET decision = $2,
           decision_note = $3,
           decided_by = $4,
           decided_at = NOW(),
           updated_at = NOW()
       WHERE id = (SELECT id FROM latest_pending)
       RETURNING id, task_id AS "taskId", requested_by AS "requestedBy", request_note AS "requestNote", requested_at AS "requestedAt", decision,
                 decision_note AS "decisionNote", decided_by AS "decidedBy", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [taskId, payload.decision, payload.note ?? null, payload.actor],
    );

    const review = reviewUpdateResult.rows[0] ?? (
      await client.query(
        `INSERT INTO ai_task_reviews (task_id, requested_by, request_note, decision, decision_note, decided_by, decided_at)
         VALUES ($1, $2, NULL, $3, $4, $2, NOW())
         RETURNING id, task_id AS "taskId", requested_by AS "requestedBy", request_note AS "requestNote", requested_at AS "requestedAt", decision,
                   decision_note AS "decisionNote", decided_by AS "decidedBy", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [taskId, payload.actor, payload.decision, payload.note ?? null],
      )
    ).rows[0];

    await client.query(`UPDATE ai_tasks SET status = $2, updated_at = NOW() WHERE id = $1`, [taskId, nextStatus]);
    await writeActivity(client, taskId, "REVIEW_DECIDED", payload.actor, payload.note ?? null, { decision: payload.decision, nextStatus });
    await writeActivity(client, taskId, "STATUS_CHANGED", payload.actor, null, { from: taskResult.rows[0].status, to: nextStatus });

    await client.query("COMMIT");
    return res.status(201).json(review);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;
