import { Router } from "express";

export const formsRouter = Router();

formsRouter.post("/daily-sales", async (req, res) => {
  // TODO: persist to Prisma (DailySales)
  console.log("[daily-sales] payload", req.body);
  return res.json({ ok: true });
});