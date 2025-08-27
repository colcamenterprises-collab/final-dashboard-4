// Error handling middleware - keep LAST in middleware stack
import type { Request, Response, NextFunction } from 'express';

export function errorGuard(err: any, req: Request, res: Response, next: NextFunction) {
  const reqId = req.id || 'unknown';
  
  console.error(`❌ ERROR [${reqId}] ${req.method} ${req.path}:`, err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  // Don't expose internal errors in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    ok: false,
    error: isDev ? err.message : 'Internal server error',
    requestId: reqId
  });
}