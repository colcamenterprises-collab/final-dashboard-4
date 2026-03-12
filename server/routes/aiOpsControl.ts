import { Router } from "express";
import { pool } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import crypto from "crypto";
import { runMonitors, startMonitorScheduler } from "../services/monitorEngine";

const router = Router();

// ---------------------------------------------------------------------------
// app_kv — tiny persistent key/value table for storing generated secrets
// Creates the table exactly once at module load (memoized promise).
// ---------------------------------------------------------------------------
let _appKvReady: Promise<void> | null = null;

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

function getAppKvReady(): Promise<void> {
  if (!_appKvReady) _appKvReady = ensureAppKvTable().catch(e => console.warn("[appKv] table init failed:", e.message));
  return _appKvReady;
}

// Run once at startup — non-blocking
getAppKvReady();

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
// CEO Charter — stored in bob_documents, cached in memory
// ---------------------------------------------------------------------------
const CEO_CHARTER_SEED = `Mission: Maximize profitability, integrity, and operational efficiency of Smash Brothers Burgers.

Core Objectives:
- Protect Profit
- Protect Integrity
- Improve Efficiency

Primary KPIs:
- Prime Cost %
- Wage % of Sales
- Food Cost Variance
- Stock Variance (Rolls ±5, Meat ±500g, Drinks ±3)
- Sales Discrepancies
- Missing Shift Submissions

Authority Model: BOB may:
- Generate alerts
- Create recommendations
- Draft operational patches
- Draft pricing changes
- Draft SOP updates

BOB may NOT:
- Modify schemas without approval
- Delete data
- Deploy code
- Change live pricing
- Restart infrastructure
- Override Cam

Escalation Rule: Any structural or financial impact change requires Cam approval.

Reporting Cadence: Daily Executive Report at 04:00 BKK. Immediate alert if:
- Prime Cost exceeds threshold
- Wage % exceeds threshold
- Stock variance exceeds tolerance`;

// Charter cache — refreshed from DB every 6 hours
let cachedCharterContent: string | null = null;
let cachedCharterVersion: number | null = null;
let cachedCharterUpdatedAt: string | null = null;
let cachedCharterLoadedAt: Date | null = null;

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
  await getAppKvReady();
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
const priorityEnum = z.enum(["low", "medium", "high", "urgent", "critical"]);
const taskStatusEnum = z.enum(["draft", "in_review", "not_assigned", "assigned", "in_progress", "blocked", "completed", "archived", "done", "cancelled", "needs_review", "approved", "changes_requested", "rejected"]);
const reviewDecisionEnum = z.enum(["approved", "changes_requested", "rejected"]);
const assignedToEnum = z.enum(["bob", "jussi", "sally", "supplier", "codex", "cam", "staff"]);
const areaEnum = z.enum(["operations", "finance", "purchasing", "marketing", "dev", "compliance"]);
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
  { agent: "bob", name: "Bob", role: "AI Operations Manager", description: "Assigns tasks, flags issues, keeps things moving." },
  { agent: "jussi", name: "Jussi", role: "Operations Analyst", description: "Checks sales, stock, and menu data." },
  { agent: "sally", name: "Sally", role: "Financial Controller", description: "Reviews wages, expenses, and shift costs." },
  { agent: "supplier", name: "Supplier", role: "Procurement Coordinator", description: "Orders stock and tracks deliveries." },
  { agent: "codex", name: "Codex", role: "Software Engineer", description: "Fixes bugs and rolls out updates." },
] as const;

const taskCreateSchema = z.object({
  taskNumber: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  frequency: frequencyEnum.default("ad-hoc"),
  priority: priorityEnum.default("medium"),
  status: taskStatusEnum.default("draft"),
  area: areaEnum.optional().nullable(),
  assignedTo: assignedToEnum.optional().nullable(),
  publish: z.boolean().default(false),
  dueAt: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s).toISOString()),
  ]).optional().nullable().superRefine((val, ctx) => {
    if (val == null) return;
    const d = new Date(val);
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + 365);
    if (d > maxFuture) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date cannot be more than 365 days in the future" });
    }
  }),
  followUpRequired: z.boolean().default(false),
  createdBy: z.string().trim().min(1).max(120).default("Cameron"),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  frequency: frequencyEnum.optional(),
  priority: priorityEnum.optional(),
  status: taskStatusEnum.optional(),
  area: areaEnum.optional().nullable(),
  assignedTo: assignedToEnum.optional().nullable(),
  publish: z.boolean().optional(),
  dueAt: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s).toISOString()),
  ]).optional().nullable().superRefine((val, ctx) => {
    if (val == null) return;
    const d = new Date(val);
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + 365);
    if (d > maxFuture) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date cannot be more than 365 days in the future" });
    }
  }),
  followUpRequired: z.boolean().optional(),
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

const taskIdSchema = z.coerce.number().int().positive();

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
// Bob connection health (exposed via /api/ai-ops/bob/health and /api/bob/health)
// gatewayUrl is the WS URL (ws:// or wss://) — never exposes secrets
// ---------------------------------------------------------------------------
const _rawGatewayBase = process.env.OPENCLAW_BASE_URL ?? null;
const _wsGatewayUrl = _rawGatewayBase
  ? _rawGatewayBase.replace(/\/$/, "").replace(/^https:/, "wss:").replace(/^http:/, "ws:")
  : null;

const bobHealth = {
  connected: false,
  gatewayUrl: _wsGatewayUrl,
  protocol: 3,
  lastConnectedAt: null as string | null,
  lastMessageAt: null as string | null,
  lastError: null as string | null,
};

// ---------------------------------------------------------------------------
// Persistent BobConnectionManager — heartbeat + exponential-backoff reconnect
//
// Concurrency model: chat messages are processed one at a time via a FIFO
// queue.  Only a single chat.send can be in-flight on a given WS session, so
// the incoming "final" event is unambiguously paired with the single active
// waiter — no idempotency-key matching needed.
// ---------------------------------------------------------------------------
type WsType = import("ws").WebSocket;

interface QueueItem {
  message: string;
  sessionKey: string;
  idempotencyKey: string;
  resolve: (text: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

const MAX_CHAT_QUEUE = 25;

class BobConnectionManager {
  private ws: WsType | null = null;
  private WS: (new (url: string, opts?: any) => WsType) | null = null;
  private state: "disconnected" | "connecting" | "authenticated" = "disconnected";
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  // Sequential FIFO queue — only one chat.send in flight at a time; capped at MAX_CHAT_QUEUE
  private chatQueue: QueueItem[] = [];
  private chatInFlight: QueueItem | null = null;
  private reconnectAttempt = 0;
  private readonly BACKOFF = [1000, 2000, 5000, 10000, 20000, 30000];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /** Total items currently occupying queue capacity (waiting + in-flight). */
  get queueSize(): number {
    return this.chatQueue.length + (this.chatInFlight ? 1 : 0);
  }

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

          if (state === "delta") {
            const partial = extractText(payload.message);
            if (partial) process.stdout.write(`[Bob delta] ${partial.slice(0, 40)}\r`);
          }

          if (state === "final") {
            const text = extractText(payload.message);
            console.log(`[Bob] final | preview: ${(text ?? "").slice(0, 150)}`);
            // Resolve the single in-flight waiter — queue ensures only one exists
            const inFlight = this.chatInFlight;
            if (inFlight) {
              clearTimeout(inFlight.timer);
              this.chatInFlight = null;
              inFlight.resolve(text || "No response from Bob");
              this.drainQueue();
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
      // Reject the in-flight item and any queued items
      const err = new Error(`WebSocket closed (${code})`);
      if (this.chatInFlight) {
        clearTimeout(this.chatInFlight.timer);
        this.chatInFlight.reject(err);
        this.chatInFlight = null;
      }
      for (const item of this.chatQueue) {
        clearTimeout(item.timer);
        item.reject(err);
      }
      this.chatQueue = [];
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

  // Enqueue a chat message.  Returns a promise that resolves when Bob's
  // "final" event arrives for this specific message.  Messages are sent
  // one-at-a-time so there is never ambiguity about which response belongs
  // to which request.
  async sendChat(message: string, sessionKey = "agent:main:main"): Promise<string> {
    // Wait up to 15s for auth before even queuing
    if (this.state !== "authenticated") {
      await new Promise<void>((res, rej) => {
        const check = setInterval(() => {
          if (this.state === "authenticated") { clearInterval(check); clearTimeout(giveUp); res(); }
        }, 200);
        const giveUp = setTimeout(() => { clearInterval(check); rej(new Error("Bob not yet authenticated")); }, 15_000);
      });
    }

    return new Promise<string>((resolve, reject) => {
      // Cap check runs synchronously — Node.js is single-threaded so no TOCTOU risk
      if (this.chatQueue.length >= MAX_CHAT_QUEUE) {
        const err = Object.assign(
          new Error("Bob busy, try again"),
          { status: 429 },
        );
        reject(err);
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      const timer = setTimeout(() => {
        // Remove from queue if still waiting, or clear in-flight slot
        const qi = this.chatQueue.indexOf(item);
        if (qi !== -1) this.chatQueue.splice(qi, 1);
        if (this.chatInFlight === item) this.chatInFlight = null;
        reject(new Error("Bob chat.send timeout (60s)"));
        this.drainQueue();
      }, 60_000);
      const item: QueueItem = { message, sessionKey, idempotencyKey, resolve, reject, timer };
      this.chatQueue.push(item);
      this.drainQueue();
    });
  }

  // Send the next queued item if nothing is currently in flight
  private drainQueue(): void {
    if (this.chatInFlight) return;
    const item = this.chatQueue.shift();
    if (!item) return;

    const ws = this.ws;
    if (!ws || (ws as any).readyState !== 1) {
      clearTimeout(item.timer);
      item.reject(new Error("Bob WS not open"));
      return;
    }

    this.chatInFlight = item;
    this.sendReq(ws, "chat.send", buildChatSendPayload({
      sessionKey: item.sessionKey,
      message: item.message,
      idempotencyKey: item.idempotencyKey,
    })).catch(e => {
      clearTimeout(item.timer);
      if (this.chatInFlight === item) this.chatInFlight = null;
      item.reject(e);
      this.drainQueue();
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

// Cached process registry names for lightweight system map excerpt (refreshed with charter)
let cachedProcessNames: string[] = [];

async function loadProcessNamesFromDb(): Promise<void> {
  if (!pool) return;
  try {
    const r = await pool.query(`SELECT name FROM process_registry WHERE status = 'active' ORDER BY name`);
    cachedProcessNames = r.rows.map((row: { name: string }) => row.name);
  } catch {
    // silent — non-critical
  }
}

async function callBobOrchestrator(contextMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>) {
  if (!process.env.OPENCLAW_BASE_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    console.warn("[Bob] Orchestrator not configured — returning offline message");
    return "Bob is currently offline (AI orchestrator not configured). Your message has been saved.";
  }
  const lastUserMsg = [...contextMessages].reverse().find(m => m.role === "user")?.content ?? "hello";

  // Prepend CEO Charter if cached (refresh from DB on-demand if cache is empty)
  if (!cachedCharterContent) {
    await loadCharterFromDb().catch(() => {});
  }
  // Load process names on-demand if empty
  if (!cachedProcessNames.length) {
    await loadProcessNamesFromDb().catch(() => {});
  }

  let messageToSend = lastUserMsg;
  if (cachedCharterContent && cachedCharterVersion != null && cachedCharterUpdatedAt) {
    const dateStr = cachedCharterUpdatedAt.slice(0, 10);
    const MAX_CHARTER_CHARS = 8000;
    const charterBody = cachedCharterContent.length > MAX_CHARTER_CHARS
      ? cachedCharterContent.slice(0, MAX_CHARTER_CHARS) + "\n[... charter truncated ...]"
      : cachedCharterContent;

    // Lightweight system map excerpt — process names only, no payload bloat
    const systemMapExcerpt = cachedProcessNames.length > 0
      ? `\n[SYSTEM MAP — Core Processes]\n${cachedProcessNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\nRule: Shopping List is auto-generated on Form 2 submit. Bob must OBSERVE and VALIDATE only — never duplicate.\nFull map: GET /api/ai-ops/process-registry\n[END SYSTEM MAP]`
      : "";

    // Pre-fetch live data and inject it inline — Bob cannot call outbound URLs
    // (gateway proxies through 127.0.0.1:18789 which doesn't forward to our server)
    const liveSnapshot = await buildLiveDataSnapshot(lastUserMsg).catch(() => "");

    messageToSend =
      `[BOB CEO CHARTER v${cachedCharterVersion} | updated ${dateStr}]\n` +
      charterBody +
      `\n[END CHARTER]` +
      systemMapExcerpt +
      liveSnapshot +
      `\n\nUser message:\n${lastUserMsg}`;
  }

  return bobManager.sendChat(messageToSend);
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
  // bob_documents — versioned governance docs (CEO Charter etc.)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bob_documents (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Seed CEO Charter if missing — DO NOT overwrite existing content
  await pool.query(
    `INSERT INTO bob_documents (key, content, version)
     VALUES ('CEO_CHARTER', $1, 1)
     ON CONFLICT (key) DO NOTHING`,
    [CEO_CHARTER_SEED],
  );

  // process_registry — Bob's system familiarity map
  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      inputs JSONB NOT NULL DEFAULT '{}',
      outputs JSONB NOT NULL DEFAULT '{}',
      dependencies JSONB NOT NULL DEFAULT '{}',
      owner TEXT NOT NULL DEFAULT 'SYSTEM',
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed core process entries — ON CONFLICT DO NOTHING (never overwrites)
  const registryEntries = [
    {
      key: "daily_sales_v2_flow",
      name: "Daily Sales V2 — Form 1 Submission",
      description: "Entry point for each shift. Staff submit cash/card/delivery sales, expenses (wages, shopping, other), and opening stock counts for rolls and meat. Creates the salesId that anchors all subsequent shift data.",
      inputs: {
        page: "/daily-stock-sales",
        form_fields: ["cashSales", "qrSales", "grabSales", "other_sales", "wages", "shopping", "other_expenses", "rollsStart", "meatStart", "drinkStock"],
        endpoint: "POST /api/forms/daily-sales-v2",
      },
      outputs: {
        tables: ["daily_sales_v2"],
        returns: "salesId (UUID) — used to link Form 2 (Daily Stock)",
        linked_tables: ["shopping_purchase_v2", "wage_entry_v2", "other_expense_v2"],
      },
      dependencies: {},
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "daily_stock_v2_flow",
      name: "Daily Stock V2 — Form 2 Submission",
      description: "Captures end-of-shift stock counts (rollsEnd, meatEnd, drinkStock) and stock purchased. Updates the existing daily_sales_v2 payload. Triggers shopping list generation and ledger variance calculations.",
      inputs: {
        page: "/daily-stock-sales",
        form_fields: ["rollsEnd", "meatEnd", "drinkStock", "requisition"],
        endpoint: "POST /api/forms/daily-stock",
        requires: "salesId from daily_sales_v2_flow",
      },
      outputs: {
        tables: ["daily_sales_v2 (payload update)", "shopping_list_v2", "purchasing_shift_items"],
        triggers: ["shopping_list_flow", "variance_threshold_flow"],
      },
      dependencies: { requires: ["daily_sales_v2_flow"] },
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "shopping_list_flow",
      name: "Shopping List — Auto-generation (READ-ONLY for Bob)",
      description: "CRITICAL: Bob must NOT duplicate or replace this flow. The shopping list is auto-generated when Form 2 is submitted, by syncing purchasing_shift_items from the requisition array. It is a read-only output for Bob to observe and validate.",
      inputs: {
        trigger: "POST /api/forms/daily-stock (automatic)",
        tables_read: ["purchasing_items (master catalog)", "purchasing_field_map", "daily_stock_v2", "daily_sales_v2"],
      },
      outputs: {
        tables_written: ["shopping_list_v2", "purchasing_shift_items"],
        endpoints: [
          "GET /api/purchasing-list/latest — full shopping list for latest shift",
          "GET /api/purchasing-list/latest/csv — CSV download",
          "GET /api/purchasing-list/system-purchases — system-calculated needs (meat/rolls)",
        ],
        page: "/shopping-list",
      },
      dependencies: { requires: ["daily_stock_v2_flow"] },
      owner: "SYSTEM",
      status: "active",
      bob_rule: "OBSERVE ONLY — never generate a competing shopping list",
    },
    {
      key: "purchasing_flow",
      name: "Purchasing — Canonical Item Catalog",
      description: "purchasing_items is the single source of truth for all buyable goods (ingredients, drinks, packaging). It stores supplier, SKU, unit cost, and pack size. purchasing_field_map links form field names to purchasing_items. purchasing_shift_items logs per-shift quantities.",
      inputs: {
        tables: ["purchasing_items (master)", "purchasing_field_map", "purchasing_shift_items"],
        admin_page: "/purchasing",
        endpoints: ["GET /api/purchasing-items", "POST /api/purchasing/plan"],
      },
      outputs: {
        purchasing_plan: "JSON with items to buy, pack quantities, estimated costs",
        feeds_into: ["shopping_list_flow", "ingredients_flow", "variance_threshold_flow"],
      },
      dependencies: {},
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "ingredients_flow",
      name: "Ingredients Management — Recipe Cost Layer",
      description: "Canonical ingredients table decoupled from purchasing_items. Each ingredient has a baseUnit (g, ml, each) and unitCostPerBase. Yield method is DIRECT (exact pack yield) or ESTIMATED (avgPortionSize + variancePct). Recipe costs are derived from this layer.",
      inputs: {
        tables: ["ingredients", "ingredient_authority", "recipe", "recipe_ingredient"],
        endpoints: ["GET /api/ingredients/management", "PUT /api/ingredients/:id", "POST /api/ingredients/sync-all"],
        sync_source: "purchasing_items",
      },
      outputs: {
        tables_written: ["ingredients (unit costs, yield)", "recipe_ingredient (linked costs)"],
        pages: ["/menu-management/ingredients", "/menu-management/recipes"],
      },
      dependencies: { requires: ["purchasing_flow"] },
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "variance_threshold_flow",
      name: "Variance & Threshold — Rolls / Meat / Drinks Ledger",
      description: "Compares expected closing stock (opening + purchases - sales) against actual manager count. Writes status (OK/ALERT/WARNING) to ledger tables. Thresholds: Rolls ±4 units, Meat ±200g, Drinks ±2 units.",
      inputs: {
        tables_read: ["analytics_shift_item (sales)", "expenses / purchase_tally (purchases)", "daily_sales_v2.payload (actual counts: rollsEnd, meatEnd, drinkStock)"],
        services: ["server/services/rollsLedger.ts", "server/services/meatLedger.ts", "server/services/drinksLedger.ts"],
      },
      outputs: {
        tables_written: ["rolls_ledger", "meat_ledger", "drinks_ledger"],
        statuses: { ok: "within threshold", warning: "up to 2x threshold (drinks only)", alert: "exceeds threshold — action required" },
        thresholds: { rolls: "±4 units", meat: "±200g", drinks: "±2 units" },
        page: "/analysis/stock-reconciliation",
      },
      dependencies: { requires: ["daily_stock_v2_flow", "purchasing_flow"] },
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "email_pdf_flow",
      name: "Email & PDF — Daily Report Generation",
      description: "Compiles a full daily shift report from sales, stock, shopping list, and variance data. Generates a PDF and emails it to management. Triggered after Form 2 submission or on-demand.",
      inputs: {
        trigger: "POST /api/reports/daily/generate",
        tables_read: ["daily_sales_v2", "daily_stock_v2", "shopping_list_v2", "rolls_ledger", "meat_ledger", "drinks_ledger"],
        services: ["compileDailyReportV2", "buildDailyReportPDF", "sendDailyReportEmailV2"],
      },
      outputs: {
        email_to: "smashbrothersburgersth@gmail.com",
        endpoints: ["GET /api/reports/daily/:date/pdf"],
        tables_written: ["daily_reports_v2"],
      },
      dependencies: { requires: ["daily_stock_v2_flow", "variance_threshold_flow"] },
      owner: "SYSTEM",
      status: "active",
    },
    {
      key: "ai_ops_flow",
      name: "AI Ops Control — Bob Gateway Integration",
      description: "Bob communicates via WebSocket to the OpenClaw gateway. Every message is prepended with the CEO Charter and a system map excerpt. Bob can read tasks, issues, and ideas, and propose actions. Bob must observe existing processes — not duplicate them.",
      inputs: {
        gateway: "ws://76.13.189.158:55039",
        endpoints: ["POST /api/ai-ops/chat/threads/:id/messages", "GET /api/ai-ops/process-registry", "GET /api/ai-ops/bob/onboarding-context"],
        governance: "CEO Charter from bob_documents table (auto-prepended to every message)",
      },
      outputs: {
        responses: "Bob replies saved to chat_messages table",
        proposed_actions: ["Tasks in ai_tasks", "Issues in ai_issues", "Ideas in ai_ideas"],
        pages: ["/ai-ops-control"],
      },
      dependencies: { reads: ["process_registry", "bob_documents", "shopping_list_flow (observe-only)"] },
      owner: "BOB",
      status: "active",
    },
    {
      key: "form_library_flow",
      name: "Form Library — Historical Submission Viewer",
      description: "Read-only library of past daily shift submissions. Allows review of Form 1 and Form 2 history without editing. Linked to the same /daily-stock-sales page via the Library tab.",
      inputs: {
        page: "/daily-stock-sales (Library tab)",
        tables_read: ["daily_sales_v2", "daily_stock_v2"],
        endpoints: ["GET /api/forms/daily-sales-v2/history"],
      },
      outputs: {
        display: "Historical read-only card view of past submissions",
      },
      dependencies: { requires: ["daily_sales_v2_flow"] },
      owner: "SYSTEM",
      status: "active",
    },
  ];

  for (const entry of registryEntries) {
    await pool.query(
      `INSERT INTO process_registry (key, name, description, inputs, outputs, dependencies, owner, status)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
       ON CONFLICT (key) DO NOTHING`,
      [
        entry.key,
        entry.name,
        entry.description,
        JSON.stringify(entry.inputs),
        JSON.stringify(entry.outputs),
        JSON.stringify(entry.dependencies),
        entry.owner,
        entry.status,
      ],
    );
  }
}

// Run on module load — non-blocking, logs on failure
ensureAgentTables()
  .then(() => Promise.all([loadCharterFromDb(), loadProcessNamesFromDb()]))
  .catch(e => console.warn("[aiOps] ensureAgentTables/charter load failed:", e.message));

// ---------------------------------------------------------------------------
// Charter: load from DB + 6-hour auto-refresh
// ---------------------------------------------------------------------------
async function loadCharterFromDb(): Promise<void> {
  if (!pool) return;
  try {
    const r = await pool.query(
      `SELECT content, version, updated_at FROM bob_documents WHERE key = 'CEO_CHARTER'`,
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      cachedCharterContent = row.content as string;
      cachedCharterVersion = row.version as number;
      cachedCharterUpdatedAt = row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at);
      cachedCharterLoadedAt = new Date();
    }
  } catch (e: any) {
    console.warn("[Bob] Charter load failed:", e.message);
  }
}

// Refresh every 6 hours — fires-and-forgets silently
setInterval(() => loadCharterFromDb().catch(() => {}), 6 * 60 * 60 * 1000);

function bobHealthPayload() {
  return {
    connected: bobHealth.connected,
    gatewayUrl: bobHealth.gatewayUrl,
    protocol: bobHealth.protocol,
    lastConnectedAt: bobHealth.lastConnectedAt,
    lastMessageAt: bobHealth.lastMessageAt,
    lastError: bobHealth.lastError,
  };
}

// Mounted at /api/ai-ops/bob/health and /api/ops/ai/bob/health
router.get("/bob/health", (_req, res) => res.json(bobHealthPayload()));

// ─── Bob Proxy-Read ──────────────────────────────────────────────────────────
// GET /api/ai-ops/bob/proxy-read?path=...&date=...&limit=...
//
// Server-side proxy for Bob's read-only data access.
// Authenticates with BOB_READONLY_TOKEN, queries DB directly (no HTTP round-trip),
// and returns JSON. Solves the HTML-instead-of-JSON problem caused by Bob's
// gateway fetch calls hitting the SPA catch-all on the public domain.
// ─────────────────────────────────────────────────────────────────────────────

const BOB_PROXY_MODULES = [
  "health",
  "reports/item-sales",
  "reports/modifier-sales",
  "reports/category-totals",
  "forms/daily-sales",
  "forms/daily-stock",
  "purchases",
  "tasks",
  "audits",
] as const;
type BobProxyModule = typeof BOB_PROXY_MODULES[number];

function isValidProxyDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function proxyNextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function proxyLimit(val: unknown, def = 50, max = 200): number {
  const n = parseInt(val as string, 10);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

async function bobProxyFetch(module: BobProxyModule, query: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!pool) throw new Error("Database unavailable");
  const { date, limit: limitRaw, status, area, type: auditType } = query as Record<string, string | undefined>;
  const lim = proxyLimit(limitRaw);

  // ── health ──
  if (module === "health") {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      available_modules: BOB_PROXY_MODULES,
      access: "proxy-read (server-side, DB-direct)",
    };
  }

  // ── reports/item-sales ──
  if (module === "reports/item-sales") {
    if (!date || !isValidProxyDate(date)) throw new Error("date query param required (YYYY-MM-DD)");
    const result = await pool.query(
      `SELECT COALESCE(l.sku,'') AS sku, l.item_name AS name,
              COALESCE(l.pos_category_name,'UNCATEGORIZED') AS category,
              SUM(CASE WHEN l.receipt_type='SALE' THEN l.quantity ELSE 0 END)::int AS sold,
              SUM(CASE WHEN l.receipt_type='REFUND' THEN ABS(l.quantity) ELSE 0 END)::int AS refunds
       FROM receipt_truth_line l
       WHERE l.receipt_date = $1::date
       GROUP BY l.sku, l.item_name, l.pos_category_name
       ORDER BY sold DESC, l.item_name`,
      [date]);
    const items = (result.rows as any[]).map(r => ({
      sku: r.sku || null, name: r.name, category: r.category || "",
      sold: Number(r.sold), refunds: Number(r.refunds), net: Number(r.sold) - Number(r.refunds),
    }));
    return { ok: true, date, count: items.length, items };
  }

  // ── reports/modifier-sales ──
  if (module === "reports/modifier-sales") {
    if (!date || !isValidProxyDate(date)) throw new Error("date query param required (YYYY-MM-DD)");
    const shiftStart = `${date} 17:00:00+07`;
    const shiftEnd = `${proxyNextDay(date)} 03:00:00+07`;
    const result = await pool.query(
      `SELECT m.raw_json->>'name' AS modifier_group, m.name AS modifier, SUM(m.qty)::int AS count
       FROM lv_modifier m JOIN lv_receipt r ON r.receipt_id = m.receipt_id
       WHERE r.datetime_bkk >= $1::timestamptz AND r.datetime_bkk < $2::timestamptz
         AND (r.raw_json->>'refund_for') IS NULL
       GROUP BY modifier_group, modifier ORDER BY count DESC`,
      [shiftStart, shiftEnd]);
    const modifiers = (result.rows as any[]).map(r => ({
      modifier_group: r.modifier_group || "Unknown Group", modifier: r.modifier, count: Number(r.count),
    }));
    return { ok: true, date, count: modifiers.length, modifiers };
  }

  // ── reports/category-totals ──
  if (module === "reports/category-totals") {
    if (!date || !isValidProxyDate(date)) throw new Error("date query param required (YYYY-MM-DD)");
    const result = await pool.query(
      `SELECT COALESCE(pos_category_name,'UNCATEGORIZED') AS category, SUM(quantity)::int AS total
       FROM receipt_truth_line
       WHERE receipt_date = $1::date AND receipt_type = 'SALE'
       GROUP BY COALESCE(pos_category_name,'UNCATEGORIZED') ORDER BY total DESC`,
      [date]);
    const totals: Record<string, number> = {};
    for (const r of result.rows as any[]) totals[r.category] = Number(r.total);
    return { ok: true, date, totals };
  }

  // ── forms/daily-sales ──
  if (module === "forms/daily-sales") {
    let rows: any[];
    if (date && isValidProxyDate(date)) {
      const r = await pool.query(
        `SELECT id,"shiftDate","submittedAtISO","completedBy","totalSales","cashSales","qrSales","grabSales","cashBanked","totalExpenses"
         FROM daily_sales_v2 WHERE "shiftDate"=$1 ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT $2`,
        [date, lim]);
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT id,"shiftDate","submittedAtISO","completedBy","totalSales","cashSales","qrSales","grabSales","cashBanked","totalExpenses"
         FROM daily_sales_v2 ORDER BY "shiftDate" DESC,"submittedAtISO" DESC NULLS LAST LIMIT $1`,
        [lim]);
      rows = r.rows;
    }
    return { ok: true, count: rows.length, forms: rows };
  }

  // ── forms/daily-stock ──
  if (module === "forms/daily-stock") {
    let rows: any[];
    if (date && isValidProxyDate(date)) {
      const r = await pool.query(
        `SELECT s.id,s."salesId",s."createdAt",s."burgerBuns",s."meatWeightG",s."drinksJson",s."notes",d."shiftDate"
         FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id=s."salesId"
         WHERE d."shiftDate"=$1 ORDER BY s."createdAt" DESC LIMIT $2`,
        [date, lim]);
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT s.id,s."salesId",s."createdAt",s."burgerBuns",s."meatWeightG",s."drinksJson",s."notes",d."shiftDate"
         FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id=s."salesId"
         ORDER BY d."shiftDate" DESC,s."createdAt" DESC LIMIT $1`,
        [lim]);
      rows = r.rows;
    }
    return { ok: true, count: rows.length, forms: rows };
  }

  // ── purchases ──
  if (module === "purchases") {
    const r = await pool.query(
      `SELECT id,item,category,"orderUnit","unitCost","purchase_unit_qty",active
       FROM purchasing_items WHERE active=true ORDER BY category,item LIMIT $1`, [lim]);
    return { ok: true, count: r.rows.length, items: r.rows };
  }

  // ── tasks ──
  if (module === "tasks") {
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: any[] = [];
    if (status) { values.push(status); conditions.push(`status=$${values.length}`); }
    if (area)   { values.push(area);   conditions.push(`area=$${values.length}`); }
    values.push(lim);
    const r = await pool.query(
      `SELECT id,task_number,title,status,priority,area,assigned_to,due_at,created_at,updated_at
       FROM ai_tasks WHERE ${conditions.join(" AND ")}
       ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,created_at DESC
       LIMIT $${values.length}`, values);
    return { ok: true, count: r.rows.length, tasks: r.rows };
  }

  // ── audits ──
  if (module === "audits") {
    const at = (auditType as string) || "both";
    const result: Record<string, any> = { ok: true, type: at };
    if (at === "baseline" || at === "both") {
      const r = await pool.query(
        `SELECT id,item_name,category,expected_qty,unit,warn_threshold,critical_threshold,created_at,updated_at
         FROM stock_baseline ORDER BY created_at DESC LIMIT $1`, [lim]);
      result.baseline = r.rows;
    }
    if (at === "snapshot" || at === "both") {
      const r = await pool.query(
        `SELECT id,shift_id,shift_date,item_name,category,actual_qty,unit,source,created_at
         FROM stock_snapshot ORDER BY created_at DESC LIMIT $1`, [lim]);
      result.snapshots = r.rows;
    }
    return result;
  }

  throw new Error(`Unknown module: ${module}`);
}

router.get("/bob/proxy-read", async (req, res) => {
  // Auth: same BOB_READONLY_TOKEN
  const expectedToken = process.env.BOB_READONLY_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ ok: false, error: "BOB_READONLY_TOKEN not configured" });
  }
  const authHeader = (req.headers.authorization || "") as string;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== expectedToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const path = (req.query.path as string || "").replace(/^\/+/, "");
  if (!path) {
    return res.json({
      ok: true,
      message: "Bob proxy-read is operational",
      available_modules: BOB_PROXY_MODULES,
      usage: "GET /api/ai-ops/bob/proxy-read?path=<module>&date=YYYY-MM-DD&limit=N",
    });
  }

  if (!BOB_PROXY_MODULES.includes(path as BobProxyModule)) {
    return res.status(400).json({
      ok: false,
      error: `Unknown module: ${path}`,
      available_modules: BOB_PROXY_MODULES,
    });
  }

  const start = Date.now();
  try {
    const data = await bobProxyFetch(path as BobProxyModule, req.query as Record<string, unknown>);
    console.log(`[bobProxy] ${path} → 200 in ${Date.now()-start}ms`);
    return res.json(data);
  } catch (err: any) {
    console.error(`[bobProxy] ${path} error:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ai-ops/bob/charter — returns the CEO Charter from DB
router.get("/bob/charter", async (_req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const r = await pool.query(
      `SELECT key, content, version, updated_at FROM bob_documents WHERE key = 'CEO_CHARTER'`,
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: "CEO_CHARTER not found" });
    const row = r.rows[0];
    return res.json({
      key: row.key,
      version: row.version,
      updated_at: row.updated_at,
      content: row.content,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to load charter" });
  }
});

// ---------------------------------------------------------------------------
// Process Registry endpoints — Bob's system familiarity map
// ---------------------------------------------------------------------------

// GET /api/ai-ops/process-registry — list all processes
router.get("/process-registry", async (_req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const r = await pool.query(
      `SELECT id, key, name, description, inputs, outputs, dependencies, owner, status, updated_at
       FROM process_registry ORDER BY status, name`,
    );
    return res.json({ ok: true, items: r.rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to load process registry" });
  }
});

// GET /api/ai-ops/process-registry/:key — single process detail
router.get("/process-registry/:key", async (req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const r = await pool.query(
      `SELECT id, key, name, description, inputs, outputs, dependencies, owner, status, updated_at
       FROM process_registry WHERE key = $1`,
      [req.params.key],
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: "Process not found" });
    return res.json({ ok: true, item: r.rows[0] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to load process" });
  }
});

// POST /api/ai-ops/process-registry/:key — update process content
router.post("/process-registry/:key", async (req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const { name, description, inputs, outputs, dependencies, owner, status } = req.body as Record<string, unknown>;
    const r = await pool.query(
      `UPDATE process_registry
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           inputs = COALESCE($4::jsonb, inputs),
           outputs = COALESCE($5::jsonb, outputs),
           dependencies = COALESCE($6::jsonb, dependencies),
           owner = COALESCE($7, owner),
           status = COALESCE($8, status),
           updated_at = NOW()
       WHERE key = $1
       RETURNING *`,
      [
        req.params.key,
        name ?? null,
        description ?? null,
        inputs ? JSON.stringify(inputs) : null,
        outputs ? JSON.stringify(outputs) : null,
        dependencies ? JSON.stringify(dependencies) : null,
        owner ?? null,
        status ?? null,
      ],
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: "Process not found" });
    return res.json({ ok: true, item: r.rows[0] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to update process" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai-ops/bob/onboarding-context — full onboarding payload for Bob
// ---------------------------------------------------------------------------
router.get("/bob/onboarding-context", async (_req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const [charterResult, registryResult] = await Promise.all([
      pool.query(`SELECT key, content, version, updated_at FROM bob_documents WHERE key = 'CEO_CHARTER'`),
      pool.query(`SELECT key, name, description, inputs, outputs, dependencies, owner, status FROM process_registry WHERE status = 'active' ORDER BY name`),
    ]);

    const charter = charterResult.rows[0] ?? null;
    const processes = registryResult.rows;

    const shoppingListProcess = processes.find(p => p.key === "shopping_list_flow");
    const thresholds = {
      rolls: { unit: "buns", threshold: "±4 units", status_ok: "within 4", status_alert: "exceeds 4", ledger_table: "rolls_ledger" },
      meat: { unit: "grams", threshold: "±200g", status_ok: "within 200g", status_alert: "exceeds 200g", ledger_table: "meat_ledger" },
      drinks: { unit: "cans/bottles", threshold: "±2 units", warning_at: "±4 units", status_ok: "within 2", status_alert: "exceeds 4", ledger_table: "drinks_ledger" },
    };

    return res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      ceo_charter: charter,
      process_registry: processes,
      thresholds,
      shopping_list: {
        bob_rule: "OBSERVE ONLY — never generate a competing shopping list",
        view_endpoint: "/api/purchasing-list/latest",
        csv_endpoint: "/api/purchasing-list/latest/csv",
        source_table: "purchasing_shift_items",
        master_catalog: "purchasing_items",
        process_detail: shoppingListProcess ?? null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to build onboarding context" });
  }
});

// ---------------------------------------------------------------------------
// Alias router — mounted at /api/bob in server/index.ts
// Provides /api/bob/health and /api/bob/charter without the full aiOps router
// ---------------------------------------------------------------------------
export const bobAliasRouter = Router();
bobAliasRouter.get("/health", (_req, res) => res.json(bobHealthPayload()));
bobAliasRouter.get("/charter", async (_req, res) => {
  if (!pool) return res.status(503).json({ ok: false, error: "Database unavailable" });
  try {
    const r = await pool.query(
      `SELECT key, content, version, updated_at FROM bob_documents WHERE key = 'CEO_CHARTER'`,
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: "CEO_CHARTER not found" });
    const row = r.rows[0];
    return res.json({ key: row.key, version: row.version, updated_at: row.updated_at, content: row.content });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "Failed to load charter" });
  }
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
     ORDER BY created_at ASC, CASE WHEN role = 'user' THEN 1 ELSE 2 END ASC, id ASC`,
    [threadId],
  );
  return res.json({ ok: true, items: result.rows });
});

router.delete("/chat/threads/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const threadId = parseThreadId(req.params.id);
  if (!threadId) return res.status(400).json({ message: "Invalid thread id" });

  const threadResult = await pool.query(`SELECT id FROM ai_chat_threads WHERE id = $1`, [threadId]);
  if (!threadResult.rows.length) return res.status(404).json({ message: "Thread not found" });

  await pool.query(`DELETE FROM ai_chat_messages WHERE thread_id = $1`, [threadId]);
  await pool.query(`DELETE FROM ai_chat_threads WHERE id = $1`, [threadId]);

  return res.json({ ok: true });
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
      `INSERT INTO ai_chat_messages (thread_id, role, content, token_estimate, created_by, created_at)
       VALUES ($1, 'user', $2, $3, $4, clock_timestamp())`,
      [threadId, payload.content, estimateTokens(payload.content), payload.createdBy],
    );

    const contextRows = await client.query(
      `SELECT role, content
       FROM ai_chat_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC, CASE WHEN role = 'user' THEN 1 ELSE 2 END ASC, id ASC`,
      [threadId],
    );
    const context = buildCappedContext(contextRows.rows, 2400);
    let assistantReply: string;
    try {
      assistantReply = await callBobOrchestrator(context);
    } catch (bobErr: any) {
      if (bobErr?.status === 429) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(429).json({ ok: false, error: "Bob busy, try again" });
      }
      console.error("[Bob] Orchestrator call failed, using fallback:", bobErr instanceof Error ? bobErr.message : String(bobErr));
      assistantReply = "Bob encountered an issue reaching the AI service. Your message has been saved — please try again shortly.";
    }

    await client.query(
      `INSERT INTO ai_chat_messages (thread_id, role, content, token_estimate, created_by, created_at)
       VALUES ($1, 'assistant', $2, $3, 'Bob', clock_timestamp())`,
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
  const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
  const area = typeof req.query.area === "string" ? req.query.area : undefined;
  const publish = typeof req.query.publish === "string" ? req.query.publish : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const includeArchived = req.query.includeArchived === "true";
  const fromDate = typeof req.query.from === "string" ? req.query.from : undefined;
  const toDate = typeof req.query.to === "string" ? req.query.to : undefined;

  const params: Array<string | boolean> = [];
  const where: string[] = [];

  if (!includeArchived) {
    where.push(`deleted_at IS NULL`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (assignedTo) {
    params.push(assignedTo);
    where.push(`assigned_to = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    where.push(`priority = $${params.length}`);
  }
  if (area) {
    params.push(area);
    where.push(`area = $${params.length}`);
  }
  if (publish === "true" || publish === "false") {
    params.push(publish === "true");
    where.push(`publish = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }
  // Date range filter on due_at
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    params.push(fromDate);
    where.push(`due_at >= $${params.length}::date`);
  }
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    params.push(toDate);
    where.push(`due_at < ($${params.length}::date + interval '1 day')`);
  }

  const result = await pool.query(
    `SELECT id, task_number AS "taskNumber", title, description, frequency, priority, status, area,
            assigned_to AS "assignedTo", publish,
            due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt",
            updated_at AS "updatedAt", completed_at AS "completedAt", deleted_at AS "deletedAt",
            follow_up_required AS "followUpRequired",
            bob_notified_at AS "bobNotifiedAt", bob_last_error AS "bobLastError"
     FROM ai_tasks
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY updated_at DESC
     LIMIT 300`,
    params,
  );

  return res.json({ items: result.rows });
});

const TASK_SELECT_COLS = `
  id, task_number AS "taskNumber", title, description, frequency, priority, status, area,
  assigned_to AS "assignedTo", publish,
  due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt",
  updated_at AS "updatedAt", completed_at AS "completedAt", deleted_at AS "deletedAt",
  follow_up_required AS "followUpRequired",
  bob_notified_at AS "bobNotifiedAt", bob_last_error AS "bobLastError"`;

async function notifyBobOfTask(taskId: number, task: Record<string, unknown>): Promise<void> {
  if (!pool) return;
  const msg = `[TASK ASSIGNED TO BOB]\nTask #${task.taskNumber ?? taskId}: ${task.title}\nStatus: ${task.status} | Priority: ${task.priority} | Area: ${task.area ?? "unset"}\nDue: ${task.dueAt ?? "not set"}\n${task.description ? `\nDescription:\n${task.description}` : ""}\n\nPlease acknowledge this task, state whether you can action it, and provide your initial assessment or next steps.`;
  const nc = await pool.connect();
  try {
    const bobReply = await callBobOrchestrator([{ role: "user", content: msg }]);
    await nc.query(`UPDATE ai_tasks SET bob_notified_at = NOW(), bob_last_error = NULL WHERE id = $1`, [taskId]);
    await writeActivity(nc, taskId as unknown as string, "SENT_TO_BOB", "system", null, { notifiedAt: new Date().toISOString() });
    // Store Bob's response as a message on the task so it's visible in the Comments tab
    if (bobReply && typeof bobReply === "string" && bobReply.trim()) {
      await nc.query(
        `INSERT INTO ai_task_messages (task_id, actor, message, visibility) VALUES ($1, $2, $3, 'internal')`,
        [taskId, "Bob (Orchestrator)", bobReply.trim()],
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[notifyBobOfTask] Task ${taskId} failed:`, errMsg);
    await nc.query(`UPDATE ai_tasks SET bob_last_error = $1 WHERE id = $2`, [errMsg.slice(0, 500), taskId]).catch(() => {});
    await writeActivity(nc, taskId as unknown as string, "SEND_BOB_FAILED", "system", errMsg.slice(0, 500), null).catch(() => {});
  } finally {
    nc.release();
  }
}

router.post("/tasks", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const payload = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertResult = await client.query(
      `INSERT INTO ai_tasks (task_number, title, description, frequency, priority, status, area, assigned_to, publish, due_at, created_by, follow_up_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${TASK_SELECT_COLS}`,
      [
        payload.taskNumber ?? null,
        payload.title,
        payload.description ?? null,
        payload.frequency,
        payload.priority,
        payload.status,
        payload.area ?? null,
        payload.assignedTo ?? null,
        payload.publish,
        payload.dueAt ? new Date(payload.dueAt) : null,
        payload.createdBy,
        payload.followUpRequired ?? false,
      ],
    );

    const task = insertResult.rows[0];
    await writeActivity(client, task.id, "CREATED", payload.createdBy, payload.description ?? null, { status: task.status, assignedTo: task.assignedTo, publish: task.publish });
    if (task.assignedTo) {
      await writeActivity(client, task.id, "ASSIGNED", payload.createdBy, null, { assignedTo: task.assignedTo });
    }

    await client.query("COMMIT");

    // Only notify Bob when task is active (not draft) — drafts must be submitted first
    if (task.assignedTo === "bob" && !["draft", "archived"].includes(task.status)) {
      notifyBobOfTask(task.id, task).catch(() => {});
    }

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
           area = CASE WHEN $7::text IS NULL AND $8 THEN NULL ELSE COALESCE($7, area) END,
           assigned_to = CASE WHEN $9::text IS NULL AND $10 THEN NULL ELSE COALESCE($9, assigned_to) END,
           publish = COALESCE($11, publish),
           due_at = CASE WHEN $12::timestamptz IS NULL AND $13 THEN NULL ELSE COALESCE($12, due_at) END,
           follow_up_required = COALESCE($15, follow_up_required),
           updated_at = NOW(),
           completed_at = CASE WHEN $6 IN ('done','completed') AND $14 NOT IN ('done','completed') THEN NOW() WHEN $6 IS NOT NULL AND $6 NOT IN ('done','completed') THEN NULL ELSE completed_at END
       WHERE id = $1
       RETURNING ${TASK_SELECT_COLS}`,
      [
        taskId,
        body.title ?? null,
        body.description ?? null,
        body.frequency ?? null,
        body.priority ?? null,
        body.status ?? null,
        body.area ?? null,
        Object.prototype.hasOwnProperty.call(body, "area"),
        body.assignedTo ?? null,
        Object.prototype.hasOwnProperty.call(body, "assignedTo"),
        body.publish,
        body.dueAt ? new Date(body.dueAt) : null,
        Object.prototype.hasOwnProperty.call(body, "dueAt"),
        current.status,
        body.followUpRequired ?? null,
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
    const assignedToChanged = Object.prototype.hasOwnProperty.call(body, "assignedTo") && body.assignedTo !== current.assigned_to;
    if (assignedToChanged) {
      await writeActivity(client, taskId, "ASSIGNED", body.actor, null, { from: current.assigned_to, to: body.assignedTo ?? null });
    }

    await client.query("COMMIT");

    // Notify Bob only if newly assigned to him, task is active (not draft/archived), and not already notified
    if (assignedToChanged && updated.assignedTo === "bob" && !["draft", "archived"].includes(updated.status) && !updated.bobNotifiedAt) {
      notifyBobOfTask(taskId, updated).catch(() => {});
    }

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
           completed_at = CASE WHEN $2 IN ('done','completed') AND $3 NOT IN ('done','completed') THEN NOW() WHEN $2 NOT IN ('done','completed') THEN NULL ELSE completed_at END
       WHERE id = $1
       RETURNING ${TASK_SELECT_COLS}`,
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
    `SELECT ${TASK_SELECT_COLS} FROM ai_tasks WHERE id = $1`,
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


router.post("/tasks/:id/archive", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });
  const actor = typeof req.body?.actor === "string" ? req.body.actor.trim() || "Cameron" : "Cameron";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT id, status FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!r.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Task not found" }); }
    if (r.rows[0].deleted_at) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Task is already archived" }); }
    const updated = await client.query(
      `UPDATE ai_tasks SET deleted_at = NOW(), status = 'archived', updated_at = NOW()
       WHERE id = $1
       RETURNING ${TASK_SELECT_COLS}`,
      [taskId],
    );
    await writeActivity(client, taskId, "STATUS_CHANGED", actor, null, { from: r.rows[0].status, to: "archived" });
    await client.query("COMMIT");
    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.post("/tasks/:id/restore", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });
  const actor = typeof req.body?.actor === "string" ? req.body.actor.trim() || "Cameron" : "Cameron";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT id, deleted_at FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!r.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Task not found" }); }
    if (!r.rows[0].deleted_at) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Task is not archived" }); }
    const updated = await client.query(
      `UPDATE ai_tasks SET deleted_at = NULL, status = 'draft', updated_at = NOW()
       WHERE id = $1
       RETURNING ${TASK_SELECT_COLS}`,
      [taskId],
    );
    await writeActivity(client, taskId, "STATUS_CHANGED", actor, null, { from: "archived", to: "draft" });
    await client.query("COMMIT");
    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// Submit task: draft → assigned (if has assignee) | in_progress (otherwise)
// Also triggers Bob notification if assigned to bob
router.post("/tasks/:id/submit", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });
  const actor = typeof req.body?.actor === "string" ? req.body.actor.trim() || "Cameron" : "Cameron";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT * FROM ai_tasks WHERE id = $1`, [taskId]);
    if (!r.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Task not found" }); }
    const current = r.rows[0];
    if (current.deleted_at) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Cannot submit an archived task" }); }
    if (current.status !== "draft") { await client.query("ROLLBACK"); return res.status(409).json({ message: `Task is already ${current.status} — only draft tasks can be submitted` }); }

    const newStatus = current.assigned_to ? "assigned" : "in_progress";
    const updated = await client.query(
      `UPDATE ai_tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ${TASK_SELECT_COLS}`,
      [newStatus, taskId],
    );
    await writeActivity(client, taskId, "STATUS_CHANGED", actor, "Task submitted", { from: "draft", to: newStatus });
    await client.query("COMMIT");

    const task = updated.rows[0];
    // Notify Bob if assigned to him and not already notified (idempotent)
    if (task.assignedTo === "bob" && !task.bobNotifiedAt) {
      notifyBobOfTask(taskId, task).catch(() => {});
    }

    return res.json(task);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.get("/tasks/:id/activity", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const taskId = parseTaskId(req.params.id);
  if (!taskId) return res.status(400).json({ message: "Invalid task id" });
  const result = await pool.query(
    `SELECT id, task_id AS "taskId", action, actor, note, payload, created_at AS "createdAt"
     FROM ai_task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [taskId],
  );
  return res.json({ items: result.rows });
});

router.get("/monitors", async (req, res) => {
  if (!pool) return res.status(503).json({ message: "Database unavailable" });
  const limit = Math.min(parseInt(String(req.query.limit || "100"), 10), 500);
  const key = typeof req.query.key === "string" ? req.query.key : undefined;
  const params: string[] = [];
  const where: string[] = [];
  if (key) { params.push(key); where.push(`monitor_key = $${params.length}`); }
  const result = await pool.query(
    `SELECT id, monitor_key AS "monitorKey", event_date AS "eventDate", fingerprint, severity, message, payload, fired_at AS "firedAt"
     FROM monitor_events
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY fired_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return res.json({ items: result.rows });
});

router.post("/monitors/run", async (req, res) => {
  const dateOverride = typeof req.body?.date === "string" ? req.body.date : undefined;
  try {
    const results = await runMonitors(dateOverride);
    return res.json({ results });
  } catch (e) {
    return res.status(500).json({ message: "Monitor run failed", error: (e as Error).message });
  }
});

// Start daily scheduler (non-blocking, idempotent)
startMonitorScheduler();

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
