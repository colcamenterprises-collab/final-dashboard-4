import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { AuthService } from "../services/auth/authService";
import { getPinSessionUser } from "../routes/pinAuth";

const AUTH_COOKIE_NAME = "sbb_session";
const UI_AUTH_COOKIE_NAME = "sbb_ui_session";

function readCookie(req: Request, key: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;

  const parts = raw.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const name = part.slice(0, eqIndex).trim();
    if (name !== key) continue;
    const value = part.slice(eqIndex + 1);
    return decodeURIComponent(value);
  }
  return null;
}


// Compatibility bridge: the established internal dashboard password gate issues
// sbb_ui_session, while API protection originally checked only JWT/PIN sessions.
// A valid internal dashboard cookie represents the existing owner access path.
function attachLegacyUiSessionUser(req: Request): boolean {
  const password = process.env.INTERNAL_APP_PASSWORD;
  const value = readCookie(req, UI_AUTH_COOKIE_NAME);
  if (!password || !value) return false;
  const expected = createHmac("sha256", password).update("sbb_ui_auth_v1").digest("hex");
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  (req as any).user = { uid: "internal-dashboard", id: "internal-dashboard", tenantId: 1, name: "Dashboard owner", role: "owner", permissions: {} };
  (req as any).tenantId = 1;
  return true;
}

export function getAuthTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return readCookie(req, AUTH_COOKIE_NAME);
}

export function attachSessionUser(req: Request): boolean {
  const token = getAuthTokenFromRequest(req);
  if (!token) return false;

  const decoded = AuthService.verify(token);
  if (!decoded) return false;

  (req as any).user = decoded;
  (req as any).tenantId = decoded.tenantId;
  return true;
}

/**
 * The legacy /api/finance router still has an old header-only auth guard.
 * Some newer finance route families sit behind it and authenticate using the
 * real session/PIN owner context. Provide compatibility headers only after
 * that real authentication has succeeded so the legacy router passes through
 * instead of incorrectly returning 401.
 *
 * These values are routing compatibility only; the canonical route handlers
 * perform their own owner/session checks and do not use them for persistence.
 */
function bridgeLegacyFinanceGuard(req: Request) {
  const isDirectorLoanRoute = req.path.startsWith("/api/finance/director-beneficiary-loans");
  const isBankImportRoute = req.path.startsWith("/api/finance/bank-imports/");
  if (!isDirectorLoanRoute && !isBankImportRoute) return;

  const user = (req as any).user;
  const userId = user?.uid ?? user?.id;
  if (!userId) return;

  req.headers["x-restaurant-id"] = req.headers["x-restaurant-id"] || "authenticated-session";
  req.headers["x-user-id"] = req.headers["x-user-id"] || String(userId);
  req.headers["x-user-role"] = req.headers["x-user-role"] || String(user?.role || "user");
}

export function requireSessionAuth(req: Request, res: Response, next: NextFunction) {
  if (attachSessionUser(req)) {
    bridgeLegacyFinanceGuard(req);
    return next();
  }

  if (attachLegacyUiSessionUser(req)) {
    bridgeLegacyFinanceGuard(req);
    return next();
  }

  const pinUser = getPinSessionUser(req);
  if (pinUser) {
    (req as any).user = {
      uid: pinUser.id,
      id: pinUser.id,
      tenantId: 1,
      name: pinUser.name,
      role: pinUser.role,
      permissions: pinUser.permissions,
    };
    (req as any).tenantId = 1;
    bridgeLegacyFinanceGuard(req);
    return next();
  }

  return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
}

export { AUTH_COOKIE_NAME };
