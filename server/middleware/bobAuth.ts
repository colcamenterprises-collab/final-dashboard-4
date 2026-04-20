import { Request, Response, NextFunction } from "express";

export function bobAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-bob-token"];

  if (!token || token !== process.env.BOB_API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
