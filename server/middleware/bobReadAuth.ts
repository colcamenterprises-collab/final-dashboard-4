/**
 * bobReadAuth — Read-only token guard for Bob canonical read endpoints.
 *
 * Header: x-bob-token
 * Env var: BOB_READ_TOKEN (falls back to BOB_READONLY_TOKEN / BOB_API_TOKEN
 *          so existing deployments work without adding a new secret).
 *
 * Returns 401 JSON (never HTML) if token is missing or invalid.
 * Blocks all non-GET methods — this surface is read-only.
 */

import { Request, Response, NextFunction } from "express";

export function bobReadAuth(req: Request, res: Response, next: NextFunction) {
  // Read-only guard — reject any mutating method at the middleware level
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed — read-only surface" });
  }

  const token = req.headers["x-bob-token"] as string | undefined;
  const validToken =
    process.env.BOB_READ_TOKEN ||
    process.env.BOB_READONLY_TOKEN ||
    process.env.BOB_API_TOKEN;

  if (!validToken) {
    // Token env var not configured — fail closed
    return res.status(503).json({
      ok: false,
      error: "BOB_READ_TOKEN not configured on server",
    });
  }

  if (!token || token !== validToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized — invalid or missing x-bob-token" });
  }

  next();
}
