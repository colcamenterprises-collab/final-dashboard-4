/**
 * agentAuth — Shared agent/Bob authentication middleware.
 * Used by both /api/bob/read and /api/agent/read.
 *
 * Auth strategy:
 *  1. SHA-256 hash lookup in agent_tokens table (tenant-aware, expiry-checked)
 *  2. Legacy BOB_READONLY_TOKEN env var fallback
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { pool } from "../db";

export type AgentAuth = {
  authorized: boolean;
  tenantId: number;
  authType: "legacy_env" | "agent_token";
  authSubject: string;
  agentTokenId?: number;
};

export type AgentEnvelope<T> = {
  ok: boolean;
  source: string;
  scope: string;
  date?: string;
  status: "ok" | "partial" | "missing" | "error";
  data: T;
  warnings: string[];
  blockers: Array<{ code: string; message: string; where: string; canonical_source: string; auto_build_attempted?: boolean }>;
  last_updated: string;
};

export function envelope<T>(
  input: Partial<AgentEnvelope<T>> & Pick<AgentEnvelope<T>, "source" | "scope" | "status" | "data">,
): AgentEnvelope<T> {
  return {
    ok: input.ok ?? input.status !== "error",
    source: input.source,
    scope: input.scope,
    date: input.date,
    status: input.status,
    data: input.data,
    warnings: input.warnings ?? [],
    blockers: input.blockers ?? [],
    last_updated: input.last_updated ?? new Date().toISOString(),
  };
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function timed() {
  const started = Date.now();
  return () => Date.now() - started;
}

export async function resolveAgentAuth(token: string): Promise<AgentAuth | null> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const row = pool
    ? (
        await pool
          .query(
            `SELECT id, tenant_id, token_type, COALESCE(agent_name, 'agent') AS agent_name
             FROM agent_tokens
             WHERE token_hash = $1
               AND is_active = TRUE
               AND revoked_at IS NULL
               AND tenant_id IS NOT NULL
               AND (
                 metadata->>'expires_at' IS NULL
                 OR (
                   metadata->>'expires_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?)?$'
                   AND (metadata->>'expires_at')::timestamptz > NOW()
                 )
               )
             LIMIT 1`,
            [tokenHash],
          )
          .catch(() => ({ rows: [] } as any))
      ).rows?.[0]
    : null;

  if (row) {
    await pool
      ?.query(`UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1`, [row.id])
      .catch(() => undefined);
    return {
      authorized: true,
      tenantId: Number(row.tenant_id || 1),
      authType: "agent_token",
      authSubject: `${row.agent_name}:${row.token_type || "agent_read"}`,
      agentTokenId: Number(row.id),
    };
  }

  const legacyToken = process.env.BOB_READONLY_TOKEN;
  if (legacyToken && token === legacyToken) {
    return {
      authorized: true,
      tenantId: 1,
      authType: "legacy_env",
      authSubject: "bob:readonly",
    };
  }

  return null;
}

export async function agentAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json(
      envelope({
        source: "auth:bearer",
        scope: "auth",
        status: "error",
        data: { authorized: false },
        blockers: [
          {
            code: "UNAUTHORIZED",
            message: "valid Bearer token required",
            where: "Authorization header",
            canonical_source: "BOB_READONLY_TOKEN or agent_tokens",
          },
        ],
      }),
    );
  }

  const resolved = await resolveAgentAuth(token);
  if (!resolved?.authorized) {
    return res.status(401).json(
      envelope({
        source: "auth:bearer",
        scope: "auth",
        status: "error",
        data: { authorized: false },
        blockers: [
          {
            code: "UNAUTHORIZED",
            message: "invalid or expired token",
            where: "Authorization header",
            canonical_source: "BOB_READONLY_TOKEN or agent_tokens.token_hash",
          },
        ],
      }),
    );
  }

  (req as any).agentAuth = resolved;
  (req as any).restaurantId = resolved.tenantId;
  (req as any).tenantId = resolved.tenantId;
  return next();
}

export function readOnlyGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET") {
    return res.status(405).json(
      envelope({
        source: "router-guard",
        scope: "read-only",
        status: "error",
        data: { method: req.method },
        blockers: [
          {
            code: "READ_ONLY_ENFORCED",
            message: "Only GET is allowed on this namespace",
            where: req.path,
            canonical_source: "agentRead router",
          },
        ],
      }),
    );
  }
  return next();
}

export function dbGuard(req: Request, res: Response, next: NextFunction) {
  if (!pool) {
    return res.status(503).json(
      envelope({
        source: "db",
        scope: "database",
        status: "error",
        data: { available: false },
        blockers: [
          {
            code: "DATABASE_UNAVAILABLE",
            message: "Database pool is not available",
            where: req.path,
            canonical_source: "DATABASE_URL",
          },
        ],
      }),
    );
  }
  return next();
}
