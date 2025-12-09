// server/routes/kds/kdsRoutes.ts
// PATCH O9 — KITCHEN DISPLAY SYSTEM API
import express from "express";
import { getActiveKDSOrders, updateKDSStatus, getKDSHistory } from "../../services/kdsService";

const router = express.Router();

// Get all active KDS orders
router.get("/active", async (req, res) => {
  try {
    const orders = await getActiveKDSOrders();
    return res.json({ success: true, orders });
  } catch (err) {
    console.error("KDS Active Error:", err);
    return res.status(500).json({ success: false });
  }
});

// Update order KDS status
router.post("/update-status", async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const updated = await updateKDSStatus(orderId, status);
    return res.json({ success: true, updated });
  } catch (err) {
    console.error("KDS Status Error:", err);
    return res.status(500).json({ success: false });
  }
});

// KDS history archive
router.get("/history", async (req, res) => {
  try {
    const history = await getKDSHistory();
    return res.json({ success: true, history });
  } catch (err) {
    console.error("KDS History Error:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
