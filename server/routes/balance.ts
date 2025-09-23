// server/routes/balance.ts
import { Router } from "express";
import { getDailyBalances } from "../services/balanceService";

const router = Router();

router.get("/daily", async (req, res) => {
  try {
    const data = await getDailyBalances();
    res.json({ status: "ok", ...data });
  } catch (err) {
    console.error("Balance service error:", err);
    res.status(500).json({ status: "error", error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;