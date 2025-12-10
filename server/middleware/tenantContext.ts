import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      restaurantId: number;
    }
  }
}

export function tenantContext(req: Request, res: Response, next: NextFunction) {
  req.restaurantId = 1;
  next();
}
