import { Request, Response, NextFunction } from "express";
import { attachSessionUser } from "./sessionAuth";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  if (!attachSessionUser(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
