import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth/authService";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.replace("Bearer ", "");
  const decoded = AuthService.verify(token);

  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  (req as any).user = decoded;
  (req as any).tenantId = decoded.tenantId;

  next();
}
