// server/routes/balance.ts
import { Router } from "express";
import { getPosBalances, getFormBalances, getCombinedBalances } from "../services/balanceService";

const router = Router();

router.get("/pos", async (req, res) => {
  try {
    const data = await getPosBalances();
    res.json(data);
  } catch (err) {
    console.error("POS balance error:", err);
    res.status(200).json([]);
  }
});

router.get("/forms", async (req, res) => {
  try {
    const data = await getFormBalances();
    res.json(data);
  } catch (err) {
    console.error("Form balance error:", err);
    res.status(200).json([]);
  }
});

router.get("/combined", async (req, res) => {
  try {
    const data = await getCombinedBalances();
    res.json(data);
  } catch (err) {
    console.error("Combined balance error:", err);
    res.status(200).json([]);
  }
});

export default router;
