import { Router } from "express";
import { pool } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import crypto from "crypto";

const router = Router();

// ---------------------------------------------------------------------------
// app_kv — tiny persistent key/value table for storing generated secrets
// ---------------------------------------------------------------------------
async function ensureAppKvTable(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_kv (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz DEFAULT NOW()
    )
  `);
}

async function kvGet(key: string): Promise<string | null> {
  if (!pool) return null;
  try {
    const r = await pool.query(`SELECT value FROM app_kv WHERE key = $1`, [key]);
    return r.rows[0]?.value ?? null;
  } catch { return null; }
}

async function kvSet(key: string, value: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO app_kv (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Ed25519 device identity — persisted across restarts via env vars or DB
// ---------------------------------------------------------------------------
interface DeviceIdentity {
  deviceId: string;
  privateKey: crypto.KeyObject;
  publicKeyRaw: Buffer;
}

let _deviceInitPromise: Promise<DeviceIdentity> | null = null;

async function loadOrCreateDevice(): Promise<DeviceIdentity> {
  const envId = process.env.OPENCLAW_DEVICE_ID;
  const envPrivKey = process.env.OPENCLAW_DEVICE_PRIVATE_KEY;
  if (envId && envPrivKey) {
    try {
      const privKeyBuf = Buffer.from(envPrivKey, "base64");
      const privateKey = crypto.createPrivateKey({ key: privKeyBuf, format: "der", type: "pkcs8" });
      const pubKeyDer = crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });
      const publicKeyRaw = Buffer.from(pubKeyDer).slice(-32);
      console.log(`[Bob] Device identity loaded from env | id: ${envId.slice(0, 12)}...`);
      return { deviceId: envId, privateKey, publicKeyRaw };
    } catch (e) {
      console.warn("[Bob] Failed to load device from env, falling back to DB:", (e as Error).message);
    }
  }
  await ensureAppKvTable();
  const [storedId, storedPrivKey, storedPubKey] = await Promise.all([
    kvGet("openclaw_device_id"),
    kvGet("openclaw_device_privkey"),
    kvGet("openclaw_device_pubkey"),
  ]);
  if (storedId && storedPrivKey && storedPubKey) {
    try {
      const privKeyBuf = Buffer.from(storedPrivKey, "base64");
      const privateKey = crypto.createPrivateKey({ key: privKeyBuf, format: "der", type: "pkcs8" });
      const publicKeyRaw = Buffer.from(storedPubKey, "hex");
      console.log(`[Bob] Device identity loaded from DB | id: ${storedId.slice(0, 12)}...`);
      return { deviceId: storedId, privateKey, publicKeyRaw };
    } catch (e) {
      console.warn("[Bob] Failed to load device from DB, generating new:", (e as Error).message);
    }
  }
  const kp = crypto.generateKeyPairSync("ed25519");
  const pubKeyDer = kp.publicKey.export({ type: "spki", format: "der" });
  const publicKeyRaw = Buffer.from(pubKeyDer).slice(-32);
  const deviceId = crypto.createHash("sha256").update(publicKeyRaw).digest("hex");
  const privKeyDer = Buffer.from(kp.privateKey.export({ type: "pkcs8", format: "der" }));
  await Promise.all([
    kvSet("openclaw_device_id", deviceId),
    kvSet("openclaw_device_privkey", privKeyDer.toString("base64")),
    kvSet("openclaw_device_pubkey", publicKeyRaw.toString("hex")),
  ]);
  console.log(`[Bob] Device identity generated and persisted | id: ${deviceId.slice(0, 12)}...`);
  return { deviceId, privateKey: kp.privateKey, publicKeyRaw };
}

function getDevice(): Promise<DeviceIdentity> {
  if (!_deviceInitPromise) _deviceInitPromise = loadOrCreateDevice();
  return _deviceInitPromise;
}

function _b64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function _buildDevice(challengeNonce: string, token: string): Promise<Record<string, unknown>> {
  const dev = await getDevice();
  const signedAtMs = Date.now();
  const clientId = "openclaw-control-ui";
  const clientMode = "webchat";
  const role = "operator";
  const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
  const message = ["v2", dev.deviceId, clientId, clientMode, role, scopes.join(","), String(signedAtMs), token, challengeNonce].join("|");
  const signature = crypto.sign(null, Buffer.from(message), dev.privateKey);
  return {
    id: dev.deviceId,
    publicKey: _b64url(dev.publicKeyRaw),
    signature: _b64url(signature),
    signedAt: signedAtMs,
    nonce: challengeNonce,
  };
}

const frequencyEnum = z.enum(["once", "daily", "weekly", "monthly", "ad-hoc"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const taskStatusEnum = z.enum(["draft", "not_assigned", "assigned", "in_progress", "blocked", "done", "cancelled", "needs_review", "approved", "changes_requested", "rejected"]);
const reviewDecisionEnum = z.enum(["approved", "changes_requested", "rejected"]);
const assignedToEnum = z.enum(["bob", "jussi", "sally", "supplier", "codex"]);
const agentStatusEnum = z.enum(["online", "offline", "busy"]);
const activityActionEnum = z.enum(["CREATED", "ASSIGNED", "STATUS_CHANGED", "MESSAGE_ADDED", "REVIEW_REQUESTED", "REVIEW_DECIDED", "UPDATED_FIELDS"]);
const issueSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
const issueStatusEnum = z.enum(["draft", "triage", "plan_pending", "approval_requested", "approved", "in_progress", "needs_review", "done", "closed", "rejected"]);
const issueVisibilityEnum = z.enum(["internal", "public"]);
const issueActivityActionEnum = z.enum(["CREATED", "STATUS_CHANGED", "PLAN_UPDATED", "APPROVAL_REQUESTED", "APPROVED", "REJECTED", "ASSIGNED", "COMMENT_ADDED", "COMPLETED", "CLOSED"]);
const ideaStatusEnum = z.enum(["new", "triage", "accepted", "converted", "rejected", "archived"]);
const ideaCategoryEnum = z.enum(["ops", "finance", "marketing", "tech", "product"]);
const ideaActivityActionEnum = z.enum(["CREATED", "STATUS_CHANGED", "CONVERTED_TO_ISSUE", "CONVERTED_TO_TASK", "COMMENT"]);
const chatRoleEnum = z.enum(["user", "assistant", "system"]);

type ActivityAction = z.infer<typeof activityActionEnum>;
type IssueActivityAction = z.infer<typeof issueActivityActionEnum>;
type IdeaActivityAction = z.infer<typeof ideaActivityActionEnum>;

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

const issueCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  severity: issueSeverityEnum.default("medium"),
  status: issueStatusEnum.default("draft"),
  createdBy: z.string().trim().min(1).max(120),
  ownerAgent: z.string().trim().min(1).max(120).default("Bob"),
  assignee: z.string().trim().max(120).optional().nullable(),
});

const issueUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  severity: issueSeverityEnum.optional(),
  actor: z.string().trim().min(1).max(120).default("Cameron"),
}).refine((body) => Object.keys(body).some((key) => key !== "actor"), {
  message: "At least one updatable field is required",
});

const issueStatusUpdateSchema = z.object({
  status: issueStatusEnum,
  actor: z.string().trim().min(1).max(120).default("Cameron"),
});

const issuePlanSchema = z.object({
  actor: z.string().trim().min(1).max(120).default("Bob"),
  planMd: z.string().trim().min(1).max(12000),
  approvalNote: z.string().trim().max(4000).optional().nullable(),
});

const issueApproveSchema = z.object({
  approvedBy: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional().nullable(),
});

const issueRejectSchema = z.object({
  rejectedBy: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional().nullable(),
});

const issueAssignSchema = z.object({
  assignee: z.string().trim().min(1).max(120),
  actor: z.string().trim().min(1).max(120).default("Bob"),
});

const issueCompleteSchema = z.object({
  completedBy: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional().nullable(),
});

const issueCloseSchema = z.object({
  closedBy: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional().nullable(),
});

const issueCommentSchema = z.object({
  author: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  visibility: issueVisibilityEnum.default("internal"),
});

const ideaCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  category: ideaCategoryEnum.optional().nullable(),
  status: ideaStatusEnum.default("new"),
  createdBy: z.string().trim().min(1).max(120),
});

const ideaStatusUpdateSchema = z.object({
  status: ideaStatusEnum,
  actor: z.string().trim().min(1).max(120).default("Bob"),
});

const convertIdeaToIssueSchema = z.object({
  actor: z.string().trim().min(1).max(120),
  severity: issueSeverityEnum.default("medium"),
  descriptionAppend: z.string().trim().max(4000).optional().nullable(),
});

const convertIdeaToTaskSchema = z.object({
  actor: z.string().trim().min(1).max(120),
  taskTitle: z.string().trim().min(1).max(255),
  taskDescription: z.string().trim().optional().nullable(),
  priority: priorityEnum.default("medium"),
  type: frequencyEnum.default("ad-hoc"),
});

const issueIdSchema = z.string().uuid();
const ideaIdSchema = z.string().uuid();
const threadIdSchema = z.string().uuid();

const taskIdSchema = z.string().uuid();

const chatThreadCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  createdBy: z.string().trim().min(1).max(120).default("Bob"),
});

const chatMessageCreateSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  createdBy: z.string().trim().min(1).max(120).default("Bob"),
});

function parseThreadId(rawId: string) {
  const parsed = threadIdSchema.safeParse(rawId);
  if (!parsed.success) return null;
  return parsed.data;
}

function ensureIssueStatus(currentStatus: string, allowed: string[], action: string) {
  if (!allowed.includes(currentStatus)) {
    return { ok: false as const, message: `Issue cannot ${action} from status '${currentStatus}'` };
  }
  return { ok: true as const };
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function buildCappedContext(
  rows: Array<{ role: string; content: string }>,
  maxTokens: number,
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const selected: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
  let runningTokens = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const role = chatRoleEnum.safeParse(row.role);
    if (!role.success) continue;
    const cost = estimateTokens(row.content);
    if (runningTokens + cost > maxTokens) break;
    selected.push({ role: role.data, content: row.content });
    runningTokens += cost;
  }
  return selected.reverse();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract plain text from an OpenClaw message object (Anthropic-style or plain string) */
function extractText(message: unknown): string {
  if (!message) return "";
  if (typeof message === "string") return message.trim();
  const m = message as Record<string, unknown>;
  if (typeof m.content === "string") return m.content.trim();
  if (Array.isArray(m.content)) {
    return (m.content as Array<{ type?: string; text?: string }>)
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

/** Schema-safe chat.send payload — attachments always [], no nulls */
function buildChatSendPayload(input: {
  sessionKey: string;
  message: string;
  idempotencyKey: string;
}): Record<string, unknown> {
  return {
    sessionKey: input.sessionKey,
    message: input.message,
    deliver: false,
    idempotencyKey: input.idempotencyKey,
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// Bob connection health (exposed via /api/ai-ops/bob/health)
// ---------------------------------------------------------------------------
const bobHealth = {
  connected: false,
  gatewayUrl: (process.env.OPENCLAW_BASE_URL ?? null) as string | null,
  protocol: 3,
  lastConnectedAt: null as string | null,
  lastMessageAt: null as string | null,
  lastError: null as string | null,
};

// ---------------------------------------------------------------------------
// Persistent BobConnectionManager — heartbeat + exponential-backoff reconnect
// ---------------------------------------------------------------------------
type WsType = import("ws").WebSocket;

interface ChatWaiter {
  resolve: (text: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
  sessionKey: string;
}

class BobConnectionManager {
  private ws: WsType | null = null;
  private WS: (new (url: string, opts?: any) => WsType) | null = null;
  private state: "disconnected" | "connecting" | "authenticated" = "disconnected";
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private chatWaiters = new Map<string, ChatWaiter>();
  private reconnectAttempt = 0;
  private readonly BACKOFF = [1000, 2000, 5000, 10000, 20000, 30000];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  start(): void {
    import("ws").then(({ default: WSClass }) => {
      this.WS = WSClass as any;
      this.scheduleConnect(0);
    }).catch(e => console.error("[Bob] Failed to import ws:", e.message));
  }

  private scheduleConnect(delayMs: number): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }

  private connect(): void {
    const baseUrl = process.env.OPENCLAW_BASE_URL;
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!baseUrl || !token || !this.WS) return;

    this.state = "connecting";
    const wsUrl = baseUrl.replace(/\/$/, "").replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    const gatewayOrigin = baseUrl.replace(/^wss?:\/\//, "http://").replace(/\/$/, "");

    const ws = new this.WS!(wsUrl, { headers: { Origin: gatewayOrigin } });
    this.ws = ws;

    (ws as any).on("message", async (raw: Buffer | string) => {
      let msg: Record<string, any>;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      bobHealth.lastMessageAt = new Date().toISOString();

      if (msg.type === "res") {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.payload);
        else p.reject(new Error(msg.error?.message ?? "request failed"));
        return;
      }

      if (msg.type === "event") {
        if (msg.event === "connect.challenge") {
          const nonce: string = msg.payload?.nonce ?? "";
          console.log(`[Bob] connect.challenge | nonce: ${nonce.slice(0, 8)}...`);
          try {
            const device = await _buildDevice(nonce, token);
            const hello = await this.sendReq(ws, "connect", {
              minProtocol: 3,
              maxProtocol: 3,
              client: { id: "openclaw-control-ui", version: "dev", platform: "web", mode: "webchat" },
              role: "operator",
              scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
              device,
              caps: [],
              auth: { token, password: "" },
              userAgent: "Node.js/Dashboard",
              locale: "en-US",
            });
            console.log(`[Bob] connected OK | hello keys: ${Object.keys(hello as object).join(", ")}`);
            this.state = "authenticated";
            this.reconnectAttempt = 0;
            bobHealth.connected = true;
            bobHealth.lastConnectedAt = new Date().toISOString();
            bobHealth.lastError = null;
            this.startHeartbeat(ws);
          } catch (e: any) {
            console.error("[Bob] handshake failed:", e.message);
            bobHealth.lastError = e.message;
            try { ws.close(); } catch (_) {}
          }
          return;
        }

        if (msg.event === "chat") {
          const payload = msg.payload ?? {};
          const state: string = payload.state ?? "";
          const evtSession: string = payload.sessionKey ?? "";

          if (state === "delta") {
            const partial = extractText(payload.message);
            if (partial) process.stdout.write(`[Bob delta] ${partial.slice(0, 40)}\r`);
          }

          if (state === "final") {
            const text = extractText(payload.message);
            console.log(`[Bob] final | preview: ${(text ?? "").slice(0, 150)}`);
            for (const [key, waiter] of this.chatWaiters) {
              if (!evtSession || evtSession === waiter.sessionKey || evtSession === "agent:main:main") {
                clearTimeout(waiter.timer);
                this.chatWaiters.delete(key);
                waiter.resolve(text || "No response from Bob");
                return;
              }
            }
          }
        }
      }
    });

    (ws as any).on("error", (err: Error) => {
      console.error("[Bob] WS error:", err.message);
      bobHealth.lastError = err.message;
    });

    (ws as any).on("close", (code: number) => {
      console.log(`[Bob] WS closed code=${code}`);
      this.state = "disconnected";
      this.ws = null;
      bobHealth.connected = false;
      this.stopHeartbeat();
      for (const [key, waiter] of this.chatWaiters) {
        clearTimeout(waiter.timer);
        this.chatWaiters.delete(key);
        waiter.reject(new Error(`WebSocket closed (${code})`));
      }
      const delay = this.BACKOFF[Math.min(this.reconnectAttempt, this.BACKOFF.length - 1)];
      this.reconnectAttempt++;
      console.log(`[Bob] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
      this.scheduleConnect(delay);
    });
  }

  private sendReq(ws: WsType, method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = crypto.randomUUID();
    const wire = JSON.stringify({ type: "req", id, method, params });
    console.log(`[Bob] → ${method}`);
    (ws as any).send(wire);
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }

  private startHeartbeat(ws: WsType): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if ((ws as any).readyState === 1) {
        try { (ws as any).ping(); } catch (_) {}
      }
    }, 28_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  async sendChat(message: string, sessionKey = "agent:main:main"): Promise<string> {
    // Wait up to 15s for connection if still connecting
    if (this.state !== "authenticated") {
      await new Promise<void>((res, rej) => {
        const check = setInterval(() => {
          if (this.state === "authenticated") { clearInterval(check); clearTimeout(giveUp); res(); }
        }, 200);
        const giveUp = setTimeout(() => { clearInterval(check); rej(new Error("Bob not yet authenticated")); }, 15_000);
      });
    }
    const ws = this.ws;
    if (!ws || (ws as any).readyState !== 1) throw new Error("Bob WS not open");

    const idempotencyKey = crypto.randomUUID();
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.chatWaiters.delete(idempotencyKey);
        reject(new Error("Bob chat.send timeout (60s)"));
      }, 60_000);
      this.chatWaiters.set(idempotencyKey, { resolve, reject, timer, sessionKey });
      this.sendReq(ws, "chat.send", buildChatSendPayload({ sessionKey, message, idempotencyKey }))
        .catch(e => {
          clearTimeout(timer);
          this.chatWaiters.delete(idempotencyKey);
          reject(e);
        });
    });
  }
}

const bobManager = new BobConnectionManager();

// Kick off the persistent connection as soon as config is available
if (process.env.OPENCLAW_BASE_URL && process.env.OPENCLAW_GATEWAY_TOKEN) {
  // Pre-load device identity and start connection
  getDevice().catch(e => console.error("[Bob] Device init error:", e.message));
  bobManager.start();
}

async function callBobOrchestrator(contextMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>) {
  if (!process.env.OPENCLAW_BASE_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    console.warn("[Bob] Orchestrator not configured — returning offline message");
    return "Bob is currently offline (AI orchestrator not configured). Your message has been saved.";
  }
  const lastUserMsg = [...contextMessages].reverse().find(m => m.role === "user")?.content ?? "hello";
  return bobManager.sendChat(lastUserMsg);
}

function parseTaskId(rawId: string) {
  const parsed = taskIdSchema.safeParse(rawId);
  if (!parsed.success) return null;
  return parsed.data;
}

function parseIssueId(rawId: string) {
  const parsed = issueIdSchema.safeParse(rawId);
  if (!parsed.success) return null;
  return parsed.data;
}

function parseIdeaId(rawId: string) {
  const parsed = ideaIdSchema.safeParse(rawId);
  if (!parsed.success) return null;
  return parsed.data;
}

async function writeActivity(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, taskId: string, action: ActivityAction, actor: string, note: string | null, payload: Record<string, unknown> | null = null) {
  await client.query(
    `INSERT INTO ai_task_activity (task_id, action, actor, note, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [taskId, action, actor, note, JSON.stringify(payload ?? {})],
  );
}

async function writeIssueActivity(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, issueId: string, action: IssueActivityAction, actor: string, meta: Record<string, unknown> | null = null) {
  await client.query(
    `INSERT INTO ai_issue_activity (issue_id, actor, action, meta) VALUES ($1, $2, $3, $4::jsonb)`,
    [issueId, actor, action, JSON.stringify(meta ?? {})],
  );
}

async function writeIdeaActivity(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, ideaId: string, action: IdeaActivityAction, actor: string, meta: Record<string, unknown> | null = null) {
  await client.query(
    `INSERT INTO ai_idea_activity (idea_id, actor, action, meta) VALUES ($1, $2, $3, $4::jsonb)`,
    [ideaId, actor, action, JSON.stringify(meta ?? {})],
  );
}

// ---------------------------------------------------------------------------
// Ensure agent tables exist (create-if-missing, no destructive ops)
// ---------------------------------------------------------------------------
async function ensureAgentTables(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_agent_profiles (
      id serial PRIMARY KEY,
      agent_name text NOT NULL UNIQUE,
      name text NOT NULL,
      role text,
      summary text,
      image_url text,
      sort_order int DEFAULT 0,
      created_at timestamptz DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_agent_state (
      id serial PRIMARY KEY,
      agent_name text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'offline',
      status_message text,
      last_seen_at timestamptz,
      updated_at timestamptz DEFAULT NOW()
    )
  `);
}

// Run on module load — non-blocking, logs on failure
ensureAgentTables().catch(e => console.warn("[aiOps] ensureAgentTables failed:", e.message));

router.get("/bob/health", (_req, res) => {
  return res.json({
    connected: bobHealth.connected,
    gatewayUrl: bobHealth.gatewayUrl,
    protocol: bobHealth.protocol,
    lastConnectedAt: bobHealth.lastConnectedAt,
    lastMessageAt: bobHealth.lastMessageAt,
    lastError: bobHealth.lastError,
  });
});

router.get("/agents", async (_req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  let profileRows: any[] = [];
  let stateRows: any[] = [];
  try {
    const r = await pool.query(
      `SELECT agent_name AS "agent", name, role, summary, image_url AS "imageUrl" FROM ai_agent_profiles ORDER BY sort_order ASC, agent_name ASC`,
    );
    profileRows = r.rows;
  } catch { /* table may not exist yet — safe fallback */ }
  try {
    const r = await pool.query(
      `SELECT agent_name AS "agent", status, status_message AS "statusMessage", last_seen_at AS "lastSeenAt", updated_at AS "updatedAt" FROM ai_agent_state`,
    );
    stateRows = r.rows;
  } catch { /* table may not exist yet — safe fallback */ }

  const stateMap = new Map(stateRows.map((row) => [String(row.agent), row]));
  const profileMap = new Map(profileRows.map((row) => [String(row.agent), row]));

  const items = AGENTS.map((agent) => {
    const state = stateMap.get(agent.agent);
    const profile = profileMap.get(agent.agent);
    const hasHeartbeat = Boolean(state?.lastSeenAt);
    return {
      ...agent,
      name: profile?.name ?? agent.name,
      role: profile?.role ?? agent.role,
      description: profile?.summary ?? agent.description,
      imageUrl: profile?.imageUrl ?? null,
      status: hasHeartbeat ? (state?.status ?? "offline") : "offline",
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

router.get("/chat/threads", async (_req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const result = await pool.query(
    `SELECT id, title, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", last_message_at AS "lastMessageAt"
     FROM ai_chat_threads
     ORDER BY COALESCE(last_message_at, created_at) DESC
     LIMIT 200`,
  );
  return res.json({ ok: true, items: result.rows });
});

router.post("/chat/threads", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const parsed = chatThreadCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const result = await pool.query(
    `INSERT INTO ai_chat_threads (id, title, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, title, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", last_message_at AS "lastMessageAt"`,
    [randomUUID(), payload.title, payload.createdBy],
  );
  return res.status(201).json({ ok: true, item: result.rows[0] });
});

router.get("/chat/threads/:id/messages", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const threadId = parseThreadId(req.params.id);
  if (!threadId) return res.status(400).json({ message: "Invalid thread id" });

  const threadResult = await pool.query(`SELECT id FROM ai_chat_threads WHERE id = $1`, [threadId]);
  if (!threadResult.rows.length) return res.status(404).json({ message: "Thread not found" });

  const result = await pool.query(
    `SELECT id, thread_id AS "threadId", role, content, token_estimate AS "tokenEstimate", created_by AS "createdBy", created_at AS "createdAt"
     FROM ai_chat_messages
     WHERE thread_id = $1
     ORDER BY created_at ASC, id ASC`,
    [threadId],
  );
  return res.json({ ok: true, items: result.rows });
});

router.post("/chat/threads/:id/messages", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const threadId = parseThreadId(req.params.id);
  if (!threadId) return res.status(400).json({ message: "Invalid thread id" });

  const parsed = chatMessageCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const threadResult = await client.query(`SELECT id FROM ai_chat_threads WHERE id = $1`, [threadId]);
    if (!threadResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Thread not found" });
    }

    await client.query(
      `INSERT INTO ai_chat_messages (thread_id, role, content, token_estimate, created_by)
       VALUES ($1, 'user', $2, $3, $4)`,
      [threadId, payload.content, estimateTokens(payload.content), payload.createdBy],
    );

    const contextRows = await client.query(
      `SELECT role, content
       FROM ai_chat_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC, id ASC`,
      [threadId],
    );
    const context = buildCappedContext(contextRows.rows, 2400);
    let assistantReply: string;
    try {
      assistantReply = await callBobOrchestrator(context);
    } catch (bobErr) {
      console.error("[Bob] Orchestrator call failed, using fallback:", bobErr instanceof Error ? bobErr.message : String(bobErr));
      assistantReply = "Bob encountered an issue reaching the AI service. Your message has been saved — please try again shortly.";
    }

    await client.query(
      `INSERT INTO ai_chat_messages (thread_id, role, content, token_estimate, created_by)
       VALUES ($1, 'assistant', $2, $3, 'Bob')`,
      [threadId, assistantReply, estimateTokens(assistantReply)],
    );
    await client.query(
      `UPDATE ai_chat_threads SET updated_at = NOW(), last_message_at = NOW() WHERE id = $1`,
      [threadId],
    );

    await client.query("COMMIT");

    const messageResult = await pool.query(
      `SELECT id, thread_id AS "threadId", role, content, token_estimate AS "tokenEstimate", created_by AS "createdBy", created_at AS "createdAt"
       FROM ai_chat_messages
       WHERE thread_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 2`,
      [threadId],
    );

    return res.status(201).json({ ok: true, items: messageResult.rows.reverse() });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

    await client.query(
      `UPDATE ai_tasks
       SET status = $2,
           updated_at = NOW(),
           completed_at = CASE WHEN $2 = 'done' AND $3 <> 'done' THEN NOW() WHEN $2 <> 'done' THEN NULL ELSE completed_at END
       WHERE id = $1`,
      [taskId, "needs_review", taskResult.rows[0].status],
    );
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

    await client.query(
      `UPDATE ai_tasks
       SET status = $2,
           updated_at = NOW(),
           completed_at = CASE WHEN $2 = 'done' AND $3 <> 'done' THEN NOW() WHEN $2 <> 'done' THEN NULL ELSE completed_at END
       WHERE id = $1`,
      [taskId, nextStatus, taskResult.rows[0].status],
    );
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


router.get("/issues", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const assignee = typeof req.query.assignee === "string" ? req.query.assignee : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  const params: string[] = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    where.push(`severity = $${params.length}`);
  }
  if (assignee) {
    params.push(assignee);
    where.push(`assignee = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }

  const result = await pool.query(
    `SELECT id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
            plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
            completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ai_issues
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT 500`,
    params,
  );

  return res.json({ ok: true, items: result.rows });
});

router.post("/issues", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const parsed = issueCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const issueResult = await client.query(
      `INSERT INTO ai_issues (title, description, severity, status, created_by, owner_agent, assignee)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [payload.title, payload.description ?? null, payload.severity, payload.status, payload.createdBy, payload.ownerAgent, payload.assignee ?? null],
    );
    const issue = issueResult.rows[0];
    await writeIssueActivity(client, issue.id, "CREATED", payload.createdBy, { status: issue.status, severity: issue.severity });
    await client.query("COMMIT");
    return res.status(201).json({ ok: true, item: issue });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/issues/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const issueResult = await pool.query(
    `SELECT id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
            plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
            completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ai_issues
     WHERE id = $1`,
    [issueId],
  );

  if (!issueResult.rows.length) return res.status(404).json({ message: "Issue not found" });

  const commentsResult = await pool.query(
    `SELECT id, issue_id AS "issueId", author, visibility, message, created_at AS "createdAt"
     FROM ai_issue_comments
     WHERE issue_id = $1
     ORDER BY created_at ASC`,
    [issueId],
  );
  const activityResult = await pool.query(
    `SELECT id, issue_id AS "issueId", actor, action, meta, created_at AS "createdAt"
     FROM ai_issue_activity
     WHERE issue_id = $1
     ORDER BY created_at DESC`,
    [issueId],
  );

  return res.json({ ok: true, item: { ...issueResult.rows[0], comments: commentsResult.rows, activity: activityResult.rows } });
});

router.put("/issues/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT * FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const current = currentResult.rows[0];
    const updateResult = await client.query(
      `UPDATE ai_issues
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           severity = COALESCE($4, severity),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.title ?? null, payload.description ?? null, payload.severity ?? null],
    );

    await writeIssueActivity(client, issueId, "PLAN_UPDATED", payload.actor, {
      changedFields: Object.keys(payload).filter((key) => key !== "actor"),
      previousSeverity: current.severity,
      nextSeverity: payload.severity ?? current.severity,
    });

    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.put("/issues/:id/status", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const currentStatus = currentResult.rows[0].status;
    const allowedTransitions: Record<string, string[]> = {
      draft: ["triage", "plan_pending", "rejected"],
      triage: ["plan_pending", "rejected"],
      plan_pending: ["approval_requested", "rejected"],
      approval_requested: ["approved", "rejected"],
      approved: ["in_progress"],
      in_progress: ["needs_review"],
      needs_review: ["closed", "rejected"],
      done: ["closed"],
      closed: [],
      rejected: [],
    };
    if (!allowedTransitions[currentStatus]?.includes(payload.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `Invalid status transition from '${currentStatus}' to '${payload.status}'` });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.status],
    );

    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.actor, { from: currentStatus, to: payload.status });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/plan", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issuePlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;
  const nextStatus = payload.approvalNote ? "approval_requested" : "plan_pending";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const planGuard = ensureIssueStatus(currentResult.rows[0].status, ["draft", "triage", "plan_pending"], "set plan");
    if (!planGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: planGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET plan_md = $2,
           approval_note = $3,
           status = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.planMd, payload.approvalNote ?? null, nextStatus],
    );

    await writeIssueActivity(client, issueId, "PLAN_UPDATED", payload.actor, { hasApprovalNote: Boolean(payload.approvalNote) });
    if (payload.approvalNote) {
      await writeIssueActivity(client, issueId, "APPROVAL_REQUESTED", payload.actor, { approvalNote: payload.approvalNote });
    }
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.actor, { from: currentResult.rows[0].status, to: nextStatus });

    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/approve", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueApproveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const approvalGuard = ensureIssueStatus(currentResult.rows[0].status, ["approval_requested"], "be approved");
    if (!approvalGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: approvalGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.approvedBy],
    );

    await writeIssueActivity(client, issueId, "APPROVED", payload.approvedBy, { note: payload.note ?? null });
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.approvedBy, { from: currentResult.rows[0].status, to: "approved" });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/reject", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueRejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const rejectGuard = ensureIssueStatus(currentResult.rows[0].status, ["approval_requested", "needs_review", "triage", "plan_pending"], "be rejected");
    if (!rejectGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: rejectGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET status = 'rejected',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId],
    );

    await writeIssueActivity(client, issueId, "REJECTED", payload.rejectedBy, { note: payload.note ?? null });
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.rejectedBy, { from: currentResult.rows[0].status, to: "rejected" });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/assign", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueAssignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status, assignee FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const assignGuard = ensureIssueStatus(currentResult.rows[0].status, ["approved"], "be assigned");
    if (!assignGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: assignGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET assignee = $2,
           status = 'in_progress',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.assignee],
    );

    await writeIssueActivity(client, issueId, "ASSIGNED", payload.actor, { from: currentResult.rows[0].assignee, to: payload.assignee });
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.actor, { from: currentResult.rows[0].status, to: "in_progress" });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/complete", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueCompleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const completeGuard = ensureIssueStatus(currentResult.rows[0].status, ["in_progress"], "be completed");
    if (!completeGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: completeGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET status = 'needs_review',
           completed_by = $2,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.completedBy],
    );

    await writeIssueActivity(client, issueId, "COMPLETED", payload.completedBy, { note: payload.note ?? null });
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.completedBy, { from: currentResult.rows[0].status, to: "needs_review" });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/close", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueCloseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_issues WHERE id = $1`, [issueId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const closeGuard = ensureIssueStatus(currentResult.rows[0].status, ["needs_review", "done"], "be closed");
    if (!closeGuard.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: closeGuard.message });
    }

    const updateResult = await client.query(
      `UPDATE ai_issues
       SET status = 'closed',
           closed_by = $2,
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [issueId, payload.closedBy],
    );

    await writeIssueActivity(client, issueId, "CLOSED", payload.closedBy, { note: payload.note ?? null });
    await writeIssueActivity(client, issueId, "STATUS_CHANGED", payload.closedBy, { from: currentResult.rows[0].status, to: "closed" });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/issues/:id/comments", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const issueId = parseIssueId(req.params.id);
  if (!issueId) return res.status(400).json({ message: "Invalid issue id" });

  const parsed = issueCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const issueResult = await client.query(`SELECT id FROM ai_issues WHERE id = $1`, [issueId]);
    if (!issueResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found" });
    }

    const commentResult = await client.query(
      `INSERT INTO ai_issue_comments (issue_id, author, visibility, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, issue_id AS "issueId", author, visibility, message, created_at AS "createdAt"`,
      [issueId, payload.author, payload.visibility, payload.message],
    );
    await writeIssueActivity(client, issueId, "COMMENT_ADDED", payload.author, { visibility: payload.visibility });

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, item: commentResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/ideas", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  const params: string[] = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }

  const result = await pool.query(
    `SELECT id, title, description, category, status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ai_ideas
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT 500`,
    params,
  );

  return res.json({ ok: true, items: result.rows });
});

router.post("/ideas", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const parsed = ideaCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ideaResult = await client.query(
      `INSERT INTO ai_ideas (title, description, category, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, category, status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [payload.title, payload.description ?? null, payload.category ?? null, payload.status, payload.createdBy],
    );

    const idea = ideaResult.rows[0];
    await writeIdeaActivity(client, idea.id, "CREATED", payload.createdBy, { status: idea.status, category: idea.category });

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, item: idea });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/ideas/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const ideaId = parseIdeaId(req.params.id);
  if (!ideaId) return res.status(400).json({ message: "Invalid idea id" });

  const ideaResult = await pool.query(
    `SELECT id, title, description, category, status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ai_ideas
     WHERE id = $1`,
    [ideaId],
  );

  if (!ideaResult.rows.length) return res.status(404).json({ message: "Idea not found" });

  const activityResult = await pool.query(
    `SELECT id, idea_id AS "ideaId", actor, action, meta, created_at AS "createdAt"
     FROM ai_idea_activity
     WHERE idea_id = $1
     ORDER BY created_at DESC`,
    [ideaId],
  );

  return res.json({ ok: true, item: { ...ideaResult.rows[0], activity: activityResult.rows } });
});

router.put("/ideas/:id/status", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const ideaId = parseIdeaId(req.params.id);
  if (!ideaId) return res.status(400).json({ message: "Invalid idea id" });

  const parsed = ideaStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ai_ideas WHERE id = $1`, [ideaId]);
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Idea not found" });
    }

    const updateResult = await client.query(
      `UPDATE ai_ideas
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, category, status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [ideaId, payload.status],
    );

    await writeIdeaActivity(client, ideaId, "STATUS_CHANGED", payload.actor, { from: currentResult.rows[0].status, to: payload.status });
    await client.query("COMMIT");
    return res.json({ ok: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/ideas/:id/convert-to-issue", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const ideaId = parseIdeaId(req.params.id);
  if (!ideaId) return res.status(400).json({ message: "Invalid idea id" });

  const parsed = convertIdeaToIssueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ideaResult = await client.query(`SELECT * FROM ai_ideas WHERE id = $1`, [ideaId]);
    if (!ideaResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Idea not found" });
    }

    const idea = ideaResult.rows[0];
    const appended = payload.descriptionAppend ? `

${payload.descriptionAppend}` : "";
    const issueDescription = `${idea.description ?? ""}${appended}`.trim() || null;

    const issueInsert = await client.query(
      `INSERT INTO ai_issues (title, description, severity, status, created_by, owner_agent)
       VALUES ($1, $2, $3, 'triage', $4, 'Bob')
       RETURNING id, title, description, severity, status, created_by AS "createdBy", owner_agent AS "ownerAgent", assignee,
                 plan_md AS "planMd", approval_note AS "approvalNote", approved_by AS "approvedBy", approved_at AS "approvedAt",
                 completed_by AS "completedBy", completed_at AS "completedAt", closed_by AS "closedBy", closed_at AS "closedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [idea.title, issueDescription, payload.severity, payload.actor],
    );
    const issue = issueInsert.rows[0];

    await client.query(`UPDATE ai_ideas SET status = 'converted', updated_at = NOW() WHERE id = $1`, [ideaId]);

    await writeIssueActivity(client, issue.id, "CREATED", payload.actor, { sourceIdeaId: ideaId });
    await writeIdeaActivity(client, ideaId, "CONVERTED_TO_ISSUE", payload.actor, { issueId: issue.id, severity: payload.severity });

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, item: { issue, ideaId } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/ideas/:id/convert-to-task", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const ideaId = parseIdeaId(req.params.id);
  if (!ideaId) return res.status(400).json({ message: "Invalid idea id" });

  const parsed = convertIdeaToTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  const payload = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ideaResult = await client.query(`SELECT id, status FROM ai_ideas WHERE id = $1`, [ideaId]);
    if (!ideaResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Idea not found" });
    }

    const taskInsert = await client.query(
      `INSERT INTO ai_tasks (title, description, frequency, priority, status, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5)
       RETURNING id, task_number AS "taskNumber", title, description, frequency, priority, status, assigned_to AS "assignedTo", publish,
                 due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"`,
      [payload.taskTitle, payload.taskDescription ?? null, payload.type, payload.priority, payload.actor],
    );
    const task = taskInsert.rows[0];

    await client.query(`UPDATE ai_ideas SET status = 'converted', updated_at = NOW() WHERE id = $1`, [ideaId]);
    await writeActivity(client, task.id, "CREATED", payload.actor, null, { sourceIdeaId: ideaId });
    await writeIdeaActivity(client, ideaId, "CONVERTED_TO_TASK", payload.actor, { taskId: task.id });

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, item: { task, ideaId } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;

// ── /api/ai/chat — simple alias routes ───────────────────────────────────────
// These three endpoints serve the frontend's Send/thread flow.
// The existing /api/ai-ops/chat/threads routes remain unchanged.
export const chatAliasRouter = Router();

chatAliasRouter.post("/", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const { title, createdBy = "user", content } = req.body;
  const threadTitle = (title || (typeof content === "string" ? content.slice(0, 80) : "New Thread")).trim();
  if (!threadTitle) return res.status(400).json({ message: "title or content required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO ai_chat_threads (id, title, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, title, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", last_message_at AS "lastMessageAt"`,
      [randomUUID(), threadTitle, createdBy],
    );
    console.log("[aiChat] Thread created:", rows[0].id, "title:", threadTitle);
    return res.status(201).json({ ok: true, threadId: rows[0].id, thread: rows[0] });
  } catch (err) {
    console.error("[aiChat] POST / error:", (err as Error).message);
    return res.status(500).json({ message: "Failed to create thread" });
  }
});

chatAliasRouter.get("/:threadId", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const threadId = req.params.threadId;
  try {
    const threadRes = await pool.query(
      `SELECT id, title, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", last_message_at AS "lastMessageAt"
       FROM ai_chat_threads WHERE id = $1`,
      [threadId],
    );
    if (!threadRes.rows.length) return res.status(404).json({ message: "Thread not found" });
    const msgRes = await pool.query(
      `SELECT id, thread_id AS "threadId", role, content, token_estimate AS "tokenEstimate", created_by AS "createdBy", created_at AS "createdAt"
       FROM ai_chat_messages WHERE thread_id = $1 ORDER BY created_at ASC, id ASC`,
      [threadId],
    );
    return res.json({ ok: true, thread: threadRes.rows[0], messages: msgRes.rows });
  } catch (err) {
    console.error("[aiChat] GET /:threadId error:", (err as Error).message);
    return res.status(500).json({ message: "Failed to fetch thread" });
  }
});

chatAliasRouter.post("/:threadId/messages", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const threadId = req.params.threadId;
  const { content, createdBy = "user", role = "user" } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: "content required" });
  try {
    const threadRes = await pool.query(`SELECT id FROM ai_chat_threads WHERE id = $1`, [threadId]);
    if (!threadRes.rows.length) return res.status(404).json({ message: "Thread not found" });
    const { rows } = await pool.query(
      `INSERT INTO ai_chat_messages (id, thread_id, role, content, token_estimate, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, thread_id AS "threadId", role, content, token_estimate AS "tokenEstimate", created_by AS "createdBy", created_at AS "createdAt"`,
      [randomUUID(), threadId, role, content.trim(), Math.ceil(content.length / 4), createdBy],
    );
    await pool.query(
      `UPDATE ai_chat_threads SET updated_at = NOW(), last_message_at = NOW() WHERE id = $1`,
      [threadId],
    );
    console.log("[aiChat] Message saved to thread:", threadId);
    return res.status(201).json({ ok: true, message: rows[0] });
  } catch (err) {
    console.error("[aiChat] POST /:threadId/messages error:", (err as Error).message);
    return res.status(500).json({ message: "Failed to save message" });
  }
});
