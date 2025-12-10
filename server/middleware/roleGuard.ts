import { Request, Response, NextFunction } from "express";
import { PermissionsMatrix } from "../services/auth/permissions";

export function roleGuard(permission: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const role = (req as any).user?.role;

    if (!role) {
      return res.status(401).json({ error: "No session" });
    }

    const allowed = PermissionsMatrix[role]?.[permission];

    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
}
