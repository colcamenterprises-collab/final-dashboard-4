import { Request, Response, NextFunction } from "express";

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantHeader = req.headers["x-restaurant"] as string | undefined;
    (req as any).tenantId = tenantHeader || "sbb-master-001";
    next();
  } catch (err) {
    console.error("TenantResolver:", err);
    (req as any).tenantId = "sbb-master-001";
    next();
  }
}
