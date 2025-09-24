// Request ID middleware for tracing
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function reqId(req: Request, res: Response, next: NextFunction) {
  const id = randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}