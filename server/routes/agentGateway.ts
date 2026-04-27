/**
 * Agent Tool Gateway
 *
 * Mounted at: /api/gateway
 *
 * Provider-agnostic gateway that any agent (OpenAI, Claude, Gemini, ElevenLabs,
 * custom agents) can use to discover and call tools. The SBB App is one of many
 * tool adapters — it does not control the agent.
 *
 * Auth: x-bob-token header (current implementation).
 *       This is Bob's read token, reused during the bootstrap phase.
 *       Replace with a dedicated gateway API key once multi-tenant use begins.
 *
 * Endpoints:
 *   GET /api/gateway/health                 — gateway liveness
 *   GET /api/gateway/manifest               — canonical provider-agnostic manifest
 *   GET /api/gateway/manifest/openai        — OpenAI function calling format
 *   GET /api/gateway/manifest/claude        — Anthropic Claude tool use format
 *   GET /api/gateway/manifest/gemini        — Google Gemini function declarations
 *   GET /api/gateway/adapters               — list of all registered adapters
 *   GET /api/gateway/adapters/:id           — single adapter detail
 *   GET /api/gateway/tools                  — list of all active tools
 *   GET /api/gateway/tools/:id              — single tool definition
 */

import express, { Request, Response } from "express";
import { bobReadAuth } from "../middleware/bobReadAuth";
import {
  sbbRegistry,
  toOpenAIFormat,
  toClaudeFormat,
  toGeminiFormat,
  toCanonicalManifest,
} from "../config/toolRegistry";

const router = express.Router();

// All gateway routes require the read token.
router.use(bobReadAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveBaseUrl(req: Request): string {
  // Use explicit env var if set (production deployments), otherwise derive from request.
  if (process.env.SBB_BASE_URL) return process.env.SBB_BASE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "http";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:5000";
  return `${proto}://${host}`;
}

function activeOnly() {
  return sbbRegistry.tools.filter((t) => t.status === "active");
}

// ─── GET /health ──────────────────────────────────────────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  const activeAdapters = sbbRegistry.adapters.filter((a) => a.status === "active").length;
  const activeTools    = sbbRegistry.tools.filter((t) => t.status === "active").length;

  res.json({
    status:   "ok",
    service:  "agent-tool-gateway",
    version:  sbbRegistry.gatewayVersion,
    tenant:   { id: sbbRegistry.tenantId, name: sbbRegistry.tenantName },
    registry: {
      adapters: {
        total:      sbbRegistry.adapters.length,
        active:     activeAdapters,
        registered: sbbRegistry.adapters.filter((a) => a.status === "registered").length,
        planned:    sbbRegistry.adapters.filter((a) => a.status === "planned").length,
      },
      tools: {
        total:  sbbRegistry.tools.length,
        active: activeTools,
      },
    },
    architecture:
      "Agent → Agent Tool Gateway → Tool Adapters → External Systems",
    time: new Date().toISOString(),
  });
});

// ─── GET /manifest ────────────────────────────────────────────────────────────

router.get("/manifest", (req: Request, res: Response) => {
  const baseUrl  = resolveBaseUrl(req);
  const manifest = toCanonicalManifest(sbbRegistry, baseUrl);
  res.json({
    ...manifest,
    generatedAt: new Date().toISOString(),
    formats: {
      canonical: `${baseUrl}/api/gateway/manifest`,
      openai:    `${baseUrl}/api/gateway/manifest/openai`,
      claude:    `${baseUrl}/api/gateway/manifest/claude`,
      gemini:    `${baseUrl}/api/gateway/manifest/gemini`,
    },
  });
});

// ─── GET /manifest/openai ─────────────────────────────────────────────────────

router.get("/manifest/openai", (_req: Request, res: Response) => {
  res.json({
    provider:    "openai",
    format:      "function_calling",
    description: "Paste the 'tools' array into the OpenAI Chat Completions API tools parameter.",
    tools:       toOpenAIFormat(sbbRegistry.tools),
    generatedAt: new Date().toISOString(),
  });
});

// ─── GET /manifest/claude ─────────────────────────────────────────────────────

router.get("/manifest/claude", (_req: Request, res: Response) => {
  res.json({
    provider:    "anthropic",
    format:      "tool_use",
    description: "Paste the 'tools' array into the Anthropic Messages API tools parameter.",
    tools:       toClaudeFormat(sbbRegistry.tools),
    generatedAt: new Date().toISOString(),
  });
});

// ─── GET /manifest/gemini ─────────────────────────────────────────────────────

router.get("/manifest/gemini", (_req: Request, res: Response) => {
  res.json({
    provider:    "google",
    format:      "function_declarations",
    description: "Pass the 'toolConfig' object to the Gemini API generateContent tools parameter.",
    toolConfig:  toGeminiFormat(sbbRegistry.tools),
    generatedAt: new Date().toISOString(),
  });
});

// ─── GET /adapters ────────────────────────────────────────────────────────────

router.get("/adapters", (_req: Request, res: Response) => {
  const adapters = sbbRegistry.adapters.map((a) => ({
    id:          a.id,
    name:        a.name,
    description: a.description,
    category:    a.category,
    status:      a.status,
    tags:        a.tags ?? [],
    toolCount:   sbbRegistry.tools.filter((t) => t.adapterId === a.id).length,
    activeTools: sbbRegistry.tools.filter((t) => t.adapterId === a.id && t.status === "active").length,
    ...(a.dataInDb ? { dataInDb: a.dataInDb } : {}),
    auth: a.auth
      ? { type: a.auth.type, ...(a.auth.header ? { header: a.auth.header } : {}), ...(a.auth.note ? { note: a.auth.note } : {}) }
      : undefined,
  }));

  res.json({
    total:      adapters.length,
    active:     adapters.filter((a) => a.status === "active").length,
    registered: adapters.filter((a) => a.status === "registered").length,
    planned:    adapters.filter((a) => a.status === "planned").length,
    adapters,
  });
});

// ─── GET /adapters/:id ────────────────────────────────────────────────────────

router.get("/adapters/:id", (req: Request, res: Response) => {
  const adapter = sbbRegistry.adapters.find((a) => a.id === req.params.id);
  if (!adapter) {
    return res.status(404).json({
      error: "ADAPTER_NOT_FOUND",
      adapterId: req.params.id,
      available: sbbRegistry.adapters.map((a) => a.id),
    });
  }

  const tools = sbbRegistry.tools
    .filter((t) => t.adapterId === adapter.id)
    .map((t) => ({
      id:          t.id,
      name:        t.name,
      description: t.description,
      status:      t.status,
      readOnly:    t.readOnly,
      tags:        t.tags ?? [],
    }));

  res.json({
    id:          adapter.id,
    name:        adapter.name,
    description: adapter.description,
    category:    adapter.category,
    status:      adapter.status,
    tags:        adapter.tags ?? [],
    ...(adapter.dataInDb ? { dataInDb: adapter.dataInDb } : {}),
    auth: adapter.auth
      ? { type: adapter.auth.type, ...(adapter.auth.header ? { header: adapter.auth.header } : {}), ...(adapter.auth.note ? { note: adapter.auth.note } : {}) }
      : undefined,
    tools,
  });
});

// ─── GET /tools ───────────────────────────────────────────────────────────────

router.get("/tools", (req: Request, res: Response) => {
  const { adapter, status, tag, readOnly } = req.query;

  let tools = sbbRegistry.tools;

  if (adapter)  tools = tools.filter((t) => t.adapterId === adapter);
  if (status)   tools = tools.filter((t) => t.status === status);
  if (tag)      tools = tools.filter((t) => t.tags?.includes(String(tag)));
  if (readOnly !== undefined) tools = tools.filter((t) => t.readOnly === (readOnly === "true"));

  res.json({
    total:      tools.length,
    filters:    { adapter: adapter ?? null, status: status ?? null, tag: tag ?? null, readOnly: readOnly ?? null },
    tools:      tools.map((t) => ({
      id:          t.id,
      adapterId:   t.adapterId,
      name:        t.name,
      description: t.description,
      status:      t.status,
      readOnly:    t.readOnly,
      tags:        t.tags ?? [],
      inputSchema: t.inputSchema,
    })),
  });
});

// ─── GET /tools/:id ───────────────────────────────────────────────────────────

router.get("/tools/:id", (req: Request, res: Response) => {
  const tool = sbbRegistry.tools.find((t) => t.id === req.params.id);
  if (!tool) {
    return res.status(404).json({
      error:     "TOOL_NOT_FOUND",
      toolId:    req.params.id,
      available: sbbRegistry.tools.map((t) => t.id),
    });
  }

  const adapter = sbbRegistry.adapters.find((a) => a.id === tool.adapterId);

  res.json({
    id:          tool.id,
    adapterId:   tool.adapterId,
    name:        tool.name,
    description: tool.description,
    status:      tool.status,
    readOnly:    tool.readOnly,
    tags:        tool.tags ?? [],
    inputSchema: tool.inputSchema,
    ...(tool.endpoint ? { endpoint: tool.endpoint } : {}),
    adapter: adapter
      ? { id: adapter.id, name: adapter.name, status: adapter.status, category: adapter.category }
      : null,
    formats: {
      openai:  toOpenAIFormat([tool])[0]  ?? null,
      claude:  toClaudeFormat([tool])[0]  ?? null,
      gemini:  toGeminiFormat([tool]).functionDeclarations[0] ?? null,
    },
  });
});

export default router;
