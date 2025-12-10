import { Router } from "express";
import { IngredientUsageService } from "../../services/analytics/ingredientUsageService";

const router = Router();

router.get("/daily", async (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const usage = await IngredientUsageService.getDailyUsage(date);
  res.json({ success: true, usage });
});

router.get("/top", async (req, res) => {
  const days = parseInt((req.query.days as string) || "7");
  const data = await IngredientUsageService.getTopIngredients(days);
  res.json({ success: true, data });
});

export default router;
