import { Request, Response, NextFunction } from "express";

/**
 * Minimal admin guard:
 * - Set an env var ADMIN_TOKEN
 * - Send header: x-admin-token: <ADMIN_TOKEN>
 * Replace with your session middleware when ready.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-admin-token");
  if (!process.env.ADMIN_TOKEN) {
    console.warn("[requireAdmin] ADMIN_TOKEN not set; blocking all admin routes.");
    return res.status(503).json({ error: "Admin not configured" });
  }
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
