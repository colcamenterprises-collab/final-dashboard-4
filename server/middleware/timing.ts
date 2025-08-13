// API timing middleware for performance monitoring
import type { Request, Response, NextFunction } from 'express';

export function timing(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const slowThreshold = parseInt(process.env.SLOW_API_MS || '300');
    
    if (duration > slowThreshold) {
      console.warn(`🐌 SLOW API: ${req.method} ${req.path} took ${duration}ms`);
    } else {
      console.log(`⚡ ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  
  next();
}