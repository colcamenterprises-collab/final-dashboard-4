import { Request, Response, NextFunction } from "express";
import { attachSessionUser } from "./sessionAuth";

// AUTH BYPASSED — temporary, re-enable when staff logins are ready
function injectGuestUser(req: Request) {
  (req as any).user = { uid: 1, tenantId: 1, role: "admin" };
  (req as any).tenantId = 1;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  if (!attachSessionUser(req)) {
    injectGuestUser(req);
  }
  next();
}
