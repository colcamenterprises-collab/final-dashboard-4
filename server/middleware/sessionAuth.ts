import type { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth/authService";
import { getPinSessionUser } from "../routes/pinAuth";

const AUTH_COOKIE_NAME = "sbb_session";

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
 * Director/beneficiary loans are implemented by the newer finance router that
 * sits behind it. For this one route family, provide compatibility headers
 * after the real session/PIN authentication has already succeeded so the old
 * router passes through instead of incorrectly returning 401.
 *
 * These values are routing compatibility only; the loan router performs its
 * own owner check from the PIN session and does not use them for persistence.
 */
function bridgeDirectorLoanLegacyFinanceGuard(req: Request) {
  if (!req.path.startsWith("/api/finance/director-beneficiary-loans")) return;

  const user = (req as any).user;
  const userId = user?.uid ?? user?.id;
  if (!userId) return;

  req.headers["x-restaurant-id"] = req.headers["x-restaurant-id"] || "authenticated-session";
  req.headers["x-user-id"] = req.headers["x-user-id"] || String(userId);
  req.headers["x-user-role"] = req.headers["x-user-role"] || String(user?.role || "user");
}

export function requireSessionAuth(req: Request, res: Response, next: NextFunction) {
  if (attachSessionUser(req)) {
    bridgeDirectorLoanLegacyFinanceGuard(req);
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
    bridgeDirectorLoanLegacyFinanceGuard(req);
    return next();
  }

  return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
}

export { AUTH_COOKIE_NAME };
