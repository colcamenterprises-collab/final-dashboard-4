import { Request, Response, NextFunction } from "express";

export function bobAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-bob-token"];
  const validToken = process.env.BOB_READONLY_TOKEN || process.env.BOB_API_TOKEN;

  if (!token || token !== validToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
