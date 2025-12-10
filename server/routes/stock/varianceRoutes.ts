import { Router } from "express";
import { StockVarianceService } from "../../services/stockVarianceService";

const router = Router();

router.get("/shift", async (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const result = await StockVarianceService.computeShiftVariance(date);
  res.json({ success: true, variance: result });
});

export default router;
