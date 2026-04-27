/**
 * Agent Tool Gateway — Provider-Agnostic Tool Registry
 *
 * Architecture:
 *   Agent (any provider) → Agent Tool Gateway → Tool Adapters → External Systems
 *
 * This file defines the data model for the registry and the full SBB tenant
 * registry. Any future tenant (new restaurant, new location) adds their own
 * TenantRegistry entry without touching this model.
 *
 * The gateway converts this model into provider-specific formats:
 *   - OpenAI   : { type:'function', function:{ name, description, parameters } }
 *   - Claude   : { name, description, input_schema }
 *   - Gemini   : { functionDeclarations:[{ name, description, parameters }] }
 *   - Raw      : canonical JSON (default, provider-agnostic)
 */

// ─── Data model ───────────────────────────────────────────────────────────────

export interface InputProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  format?: string;
  default?: unknown;
  items?: { type: string };
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, InputProperty>;
  required?: string[];
}

export interface ToolEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  queryParams?: Record<string, string>; // schema prop → query param name
  bodyParams?: Record<string, string>;  // schema prop → request body field name
}

export interface ToolAuth {
  type: "api_key" | "bearer" | "oauth2" | "none";
  header?: string;      // e.g. "x-bob-token"
  envSecret?: string;   // env var name — value never exposed in responses
}

export type ToolStatus = "active" | "registered" | "disabled";

export interface ToolDefinition {
  id: string;           // unique tool ID  (snake_case, globally unique within tenant)
  adapterId: string;    // which adapter handles this tool
  name: string;         // function name surfaced to agents (same as id)
  description: string;  // clear description of what the tool does and returns
  inputSchema: ToolInputSchema;
  endpoint?: ToolEndpoint;
  authOverride?: ToolAuth; // overrides the adapter auth for this specific tool
  tags?: string[];
  readOnly: boolean;    // true = no side effects, agent can call freely
  status: ToolStatus;
}

export interface AdapterAuth {
  type: "api_key" | "bearer" | "oauth2" | "none";
  header?: string;
  envSecret?: string;
  note?: string;
}

export type AdapterStatus = "active" | "registered" | "planned";

export interface AdapterDefinition {
  id: string;
  name: string;
  description: string;
  category: "pos" | "crm" | "messaging" | "productivity" | "devops" | "supply" | "delivery" | "core";
  baseUrl?: string;   // omitted from public manifest when env-resolved
  auth?: AdapterAuth;
  status: AdapterStatus;
  dataInDb?: string;  // table name if data is synced into app DB
  tags?: string[];
}

export interface TenantRegistry {
  tenantId: string;
  tenantName: string;
  gatewayVersion: string;
  adapters: AdapterDefinition[];
  tools: ToolDefinition[];
}

// ─── SBB Tenant Registry ──────────────────────────────────────────────────────

export const sbbRegistry: TenantRegistry = {
  tenantId: "smash-brothers-burgers",
  tenantName: "Smash Brothers Burgers",
  gatewayVersion: "1.0",

  // ── Adapters ─────────────────────────────────────────────────────────────
  adapters: [
    {
      id: "sbb-app",
      name: "SBB Restaurant App",
      description:
        "Core restaurant management system for Smash Brothers Burgers. " +
        "Provides shift verification, stock reconciliation, financial control, " +
        "and analysis interpretation. Read-only token-authenticated API layer. " +
        "SBB App is one tool among many — it does not control the agent.",
      category: "core",
      auth: {
        type: "api_key",
        header: "x-bob-token",
        envSecret: "BOB_READ_TOKEN",
        note: "All endpoints are GET-only. Token supplied via x-bob-token header.",
      },
      status: "active",
      tags: ["shift", "inventory", "analytics", "financial"],
    },
    {
      id: "loyverse",
      name: "Loyverse POS",
      description:
        "Point-of-sale system used at SBB. Receipt data is synced into the SBB " +
        "App database (lv_receipt table). Direct Loyverse REST API adapter is " +
        "registered for future live queries (items, receipts, shifts, employees).",
      category: "pos",
      baseUrl: "https://api.loyverse.com/v1.0",
      auth: {
        type: "bearer",
        envSecret: "LOYVERSE_API_TOKEN",
        note: "Bearer token from Loyverse account → Settings → API.",
      },
      status: "registered",
      dataInDb: "lv_receipt",
      tags: ["pos", "receipts", "sales", "inventory"],
    },
    {
      id: "grab-merchant",
      name: "Grab Merchant",
      description:
        "Grab Food delivery platform. Order data is partially synced into SBB App " +
        "via Loyverse. Direct Grab Merchant API adapter registered for future use " +
        "(order management, menu sync, promotions).",
      category: "delivery",
      baseUrl: "https://partner-api.grab.com",
      auth: {
        type: "oauth2",
        envSecret: "GRAB_MERCHANT_TOKEN",
        note: "OAuth2 client credentials. See Grab Merchant Portal.",
      },
      status: "registered",
      tags: ["delivery", "grab", "orders", "online"],
    },
    {
      id: "gmail",
      name: "Gmail",
      description:
        "Gmail API used for sending automated management reports, shift summaries, " +
        "and PDF attachments. Currently active for daily shift email dispatch.",
      category: "productivity",
      baseUrl: "https://gmail.googleapis.com/gmail/v1",
      auth: {
        type: "oauth2",
        envSecret: "GMAIL_CLIENT_SECRET",
        note: "Google OAuth2. Credentials in Google Cloud Console.",
      },
      status: "active",
      tags: ["email", "notifications", "reports"],
    },
    {
      id: "google-sheets",
      name: "Google Sheets",
      description:
        "Google Sheets API for exporting financial reports, inventory snapshots, " +
        "and analysis data. Registered for future structured data export.",
      category: "productivity",
      baseUrl: "https://sheets.googleapis.com/v4",
      auth: {
        type: "oauth2",
        envSecret: "GOOGLE_SERVICE_ACCOUNT_KEY",
        note: "Google service account or OAuth2.",
      },
      status: "registered",
      tags: ["spreadsheet", "export", "reporting"],
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      description:
        "Google Calendar API for roster management, shift scheduling, and event " +
        "notifications. Registered for future staff scheduling integration.",
      category: "productivity",
      baseUrl: "https://www.googleapis.com/calendar/v3",
      auth: {
        type: "oauth2",
        envSecret: "GOOGLE_SERVICE_ACCOUNT_KEY",
        note: "Shared service account with Google Sheets.",
      },
      status: "registered",
      tags: ["calendar", "roster", "scheduling"],
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description:
        "WhatsApp Business Cloud API for manager alerts, staff notifications, " +
        "and customer messaging. Planned for shift anomaly alerts.",
      category: "messaging",
      baseUrl: "https://graph.facebook.com/v19.0",
      auth: {
        type: "bearer",
        envSecret: "WHATSAPP_ACCESS_TOKEN",
        note: "Meta System User token from Meta Business Suite.",
      },
      status: "planned",
      tags: ["messaging", "alerts", "staff", "customers"],
    },
    {
      id: "line",
      name: "LINE Messaging API",
      description:
        "LINE Messaging API for staff group notifications and customer loyalty " +
        "messaging. Planned for Thailand-market messaging integration.",
      category: "messaging",
      baseUrl: "https://api.line.me/v2",
      auth: {
        type: "bearer",
        envSecret: "LINE_CHANNEL_ACCESS_TOKEN",
        note: "Channel access token from LINE Developers console.",
      },
      status: "planned",
      tags: ["messaging", "line", "thailand", "loyalty"],
    },
    {
      id: "github",
      name: "GitHub",
      description:
        "GitHub API for code management, issue tracking, and automated deployments. " +
        "Integration installed. Enables agent-driven code review and task creation.",
      category: "devops",
      baseUrl: "https://api.github.com",
      auth: {
        type: "bearer",
        envSecret: "GITHUB_TOKEN",
        note: "Personal access token or GitHub App installation token.",
      },
      status: "registered",
      tags: ["code", "issues", "ci", "deployment"],
    },
    {
      id: "replit",
      name: "Replit",
      description:
        "Replit platform API for code execution, deployment management, and " +
        "environment configuration. SBB App is hosted on Replit.",
      category: "devops",
      baseUrl: "https://replit.com/api",
      auth: {
        type: "bearer",
        envSecret: "REPLIT_TOKEN",
        note: "Replit API token from account settings.",
      },
      status: "registered",
      tags: ["hosting", "deployment", "execution"],
    },
    {
      id: "codex",
      name: "OpenAI Codex / GPT Code Interpreter",
      description:
        "Code generation and execution via OpenAI API. Used for AI-powered " +
        "analysis tasks within SBB. Registered as a callable tool adapter.",
      category: "devops",
      baseUrl: "https://api.openai.com/v1",
      auth: {
        type: "bearer",
        envSecret: "OPENAI_API_KEY",
        note: "OpenAI API key from platform.openai.com.",
      },
      status: "registered",
      tags: ["ai", "code", "analysis", "generation"],
    },
    {
      id: "makro",
      name: "Makro Thailand",
      description:
        "Makro wholesale supplier for SBB food and packaging purchases. " +
        "Registered as an adapter for future order automation, price monitoring, " +
        "and restock recommendations.",
      category: "supply",
      auth: {
        type: "none",
        note: "No public API available. Adapter planned for web automation or EDI.",
      },
      status: "registered",
      tags: ["supply", "purchasing", "wholesale", "food"],
    },
  ],

  // ── Tools (SBB App adapter) ───────────────────────────────────────────────
  tools: [
    {
      id: "sbb_shift_health",
      adapterId: "sbb-app",
      name: "sbb_shift_health",
      description:
        "Check the SBB read-layer health and the current computed shift window. " +
        "Returns service status, the active shift date (YYYY-MM-DD in Bangkok time), " +
        "and the UTC start/end boundaries for that shift. Call this first to confirm " +
        "the shift date before making other SBB calls.",
      inputSchema: { type: "object", properties: {}, required: [] },
      endpoint: { method: "GET", path: "/api/bob/read/health" },
      readOnly: true,
      status: "active",
      tags: ["health", "shift", "window"],
    },
    {
      id: "sbb_verify_latest_shift",
      adapterId: "sbb-app",
      name: "sbb_verify_latest_shift",
      description:
        "Retrieve a canonical snapshot of the latest completed SBB shift from " +
        "5 sources: daily_sales_v2 (staff sales form), daily_stock_v2 (staff stock " +
        "form), lv_receipt (Loyverse POS receipts aggregated), shift_report_v2, and " +
        "purchase_tally. Returns shift window, per-source availability (ok/partial/" +
        "blocked), verificationInputs (rolls, meat, drinks, salesChannels, receipts), " +
        "and missingSources. Use to cross-check staff entries against POS data.",
      inputSchema: { type: "object", properties: {}, required: [] },
      endpoint: { method: "GET", path: "/api/bob/read/verify/latest-shift" },
      readOnly: true,
      status: "active",
      tags: ["shift", "verification", "reconciliation", "pos"],
    },
    {
      id: "sbb_analysis_interpretation",
      adapterId: "sbb-app",
      name: "sbb_analysis_interpretation",
      description:
        "Retrieve Bob-ready interpretation of Analysis V2 daily data for a specific " +
        "date. Returns drinks, burgers, sides, and modifiers reconciliation tables " +
        "alongside AI-readable interpretation text. Use to understand what sold, " +
        "what was wasted, and where variances exist for a given shift date.",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            format: "date",
            description:
              "Shift date to analyse in YYYY-MM-DD format (Bangkok timezone). " +
              "Use the shiftDate from sbb_shift_health if unsure.",
          },
        },
        required: ["date"],
      },
      endpoint: {
        method: "GET",
        path: "/api/bob/read/analysis/interpretation",
        queryParams: { date: "date" },
      },
      readOnly: true,
      status: "active",
      tags: ["analysis", "reconciliation", "drinks", "food", "variances"],
    },
    {
      id: "sbb_financial_control",
      adapterId: "sbb-app",
      name: "sbb_financial_control",
      description:
        "Retrieve the 5-section financial control snapshot for a shift date: " +
        "(1) Receipt count check — staff entries vs POS per channel, " +
        "(2) Register cash position — expected vs staff closing cash, " +
        "(3) Banking position — cash + QR banked, " +
        "(4) Pay-in/pay-out control — petty cash movements, " +
        "(5) Loyverse sales summary — POS grand totals. " +
        "POS is the truth source. Staff-entered totals are shown for comparison only.",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            format: "date",
            description: "Shift date in YYYY-MM-DD format (Bangkok timezone).",
          },
        },
        required: ["date"],
      },
      endpoint: {
        method: "GET",
        path: "/api/analysis/financial-control",
        queryParams: { date: "date" },
      },
      readOnly: true,
      status: "active",
      tags: ["financial", "cash", "banking", "pos", "control"],
    },
    {
      id: "sbb_tool_registry",
      adapterId: "sbb-app",
      name: "sbb_tool_registry",
      description:
        "Retrieve the SBB App's own endpoint registry — the list of all callable " +
        "read tools with their params and return shapes. Use to discover what " +
        "the SBB App surface exposes without consulting external documentation.",
      inputSchema: { type: "object", properties: {}, required: [] },
      endpoint: { method: "GET", path: "/api/bob/read/tools" },
      readOnly: true,
      status: "active",
      tags: ["discovery", "meta", "registry"],
    },
  ],
};

// ─── Provider-specific format converters ─────────────────────────────────────

/** OpenAI function calling / tools format */
export function toOpenAIFormat(tools: ToolDefinition[]) {
  return tools
    .filter((t) => t.status === "active")
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
}

/** Anthropic Claude tool use format */
export function toClaudeFormat(tools: ToolDefinition[]) {
  return tools
    .filter((t) => t.status === "active")
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
}

/** Google Gemini function declarations format */
export function toGeminiFormat(tools: ToolDefinition[]) {
  return {
    functionDeclarations: tools
      .filter((t) => t.status === "active")
      .map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties: Object.fromEntries(
            Object.entries(t.inputSchema.properties).map(([key, prop]) => [
              key,
              {
                type: prop.type.toUpperCase(),
                description: prop.description,
                ...(prop.enum ? { enum: prop.enum } : {}),
              },
            ]),
          ),
          required: t.inputSchema.required ?? [],
        },
      })),
  };
}

/** Canonical (provider-agnostic) — safe to expose, strips env secret names */
export function toCanonicalManifest(registry: TenantRegistry, baseUrl: string) {
  const safeAdapters = registry.adapters.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    status: a.status,
    tags: a.tags ?? [],
    ...(a.dataInDb ? { dataInDb: a.dataInDb } : {}),
    auth: a.auth
      ? {
          type: a.auth.type,
          ...(a.auth.header ? { header: a.auth.header } : {}),
          ...(a.auth.note ? { note: a.auth.note } : {}),
          // envSecret deliberately omitted — never expose secret names publicly
        }
      : undefined,
  }));

  const safeTools = registry.tools.map((t) => ({
    id: t.id,
    adapterId: t.adapterId,
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    readOnly: t.readOnly,
    status: t.status,
    tags: t.tags ?? [],
    ...(t.endpoint
      ? {
          endpoint: {
            method: t.endpoint.method,
            url: `${baseUrl}${t.endpoint.path}`,
            ...(t.endpoint.queryParams ? { queryParams: t.endpoint.queryParams } : {}),
          },
        }
      : {}),
  }));

  return {
    version: registry.gatewayVersion,
    tenant: { id: registry.tenantId, name: registry.tenantName },
    architecture:
      "Agent → Agent Tool Gateway → Tool Adapters → External Systems. " +
      "SBB App is one tool adapter. The gateway is provider-agnostic.",
    adapters: safeAdapters,
    tools: safeTools,
  };
}
