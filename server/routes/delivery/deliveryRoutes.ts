// PATCH O8 — DELIVERY API
import { Router } from "express";
import { createDelivery, assignDriver, updateDeliveryStatus, getActiveDeliveries, getDeliveryHistory } from "../../services/deliveryService";
import { addDriver, getDrivers, setDriverStatus } from "../../services/driverService";

const router = Router();

// CREATE DELIVERY FOR ORDER
router.post("/create", async (req, res) => {
  try {
    const { orderId, deliveryData } = req.body;
    const d = await createDelivery(orderId, deliveryData);
    res.json(d);
  } catch (err) {
    console.error("Delivery create error:", err);
    res.status(500).json({ error: "Failed to create delivery" });
  }
});

// ASSIGN DRIVER
router.post("/assign", async (req, res) => {
  try {
    const { deliveryId, driverId } = req.body;
    const d = await assignDriver(deliveryId, driverId);
    res.json(d);
  } catch (err) {
    console.error("Assign driver error:", err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// UPDATE STATUS
router.post("/update-status", async (req, res) => {
  try {
    const { deliveryId, status } = req.body;
    const d = await updateDeliveryStatus(deliveryId, status);
    res.json(d);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ACTIVE DELIVERIES
router.get("/active", async (_req, res) => {
  try {
    res.json(await getActiveDeliveries());
  } catch (err) {
    console.error("Get active deliveries error:", err);
    res.status(500).json({ error: "Failed to get active deliveries" });
  }
});

// HISTORY
router.get("/history", async (_req, res) => {
  try {
    res.json(await getDeliveryHistory());
  } catch (err) {
    console.error("Get delivery history error:", err);
    res.status(500).json({ error: "Failed to get delivery history" });
  }
});

// DRIVER MANAGEMENT
router.post("/drivers/add", async (req, res) => {
  try {
    const { name, phone } = req.body;
    res.json(await addDriver(name, phone));
  } catch (err) {
    console.error("Add driver error:", err);
    res.status(500).json({ error: "Failed to add driver" });
  }
});

router.post("/drivers/status", async (req, res) => {
  try {
    const { driverId, active } = req.body;
    res.json(await setDriverStatus(driverId, active));
  } catch (err) {
    console.error("Set driver status error:", err);
    res.status(500).json({ error: "Failed to set driver status" });
  }
});

router.get("/drivers", async (_req, res) => {
  try {
    res.json(await getDrivers());
  } catch (err) {
    console.error("Get drivers error:", err);
    res.status(500).json({ error: "Failed to get drivers" });
  }
});

export default router;
