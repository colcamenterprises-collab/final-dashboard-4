// src/server/middleware/readonly.ts
import type { NextFunction, Request, Response } from "express";

// Blocks mutating HTTP methods when AGENT_READONLY=1 (set in Replit Secrets)
export function readonlyGuard(req: Request, res: Response, next: NextFunction) {
  if (process.env.AGENT_READONLY === "1") {
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return res.status(423).json({ ok: false, error: "READ_ONLY_MODE" });
    }
  }
  return next();
}