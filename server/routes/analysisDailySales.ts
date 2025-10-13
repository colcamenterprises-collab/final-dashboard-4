import { Router, Request, Response } from "express";

const router = Router();

// CSV Export endpoints disabled - daily_shift_summary table does not exist
// To enable: create the table or point to an existing data source

router.get("/export.csv", async (req: Request, res: Response) => {
  return res.status(503).json({ 
    error: "CSV export not available - daily_shift_summary table does not exist" 
  });
});

router.get("/", async (req: Request, res: Response) => {
  return res.status(503).json({ 
    error: "Daily sales analysis not available - daily_shift_summary table does not exist" 
  });
});

export default router;
