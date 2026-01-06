import { Router } from "express";
import { buildPnLSnapshot, getLatestSnapshot, getAllSnapshots } from "../services/pnlSnapshot.service";

const router = Router();

router.post("/rebuild", async (req, res) => {
  try {
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({ error: "start and end required" });
    }

    const result = await buildPnLSnapshot(start, end);

    res.json({ status: "ok", ...result });
  } catch (error: any) {
    console.error("P&L Snapshot rebuild error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (start && end) {
      const snapshot = await getLatestSnapshot(start as string, end as string);
      return res.json({ success: true, snapshot });
    }

    const snapshots = await getAllSnapshots();
    res.json({ success: true, snapshots });
  } catch (error: any) {
    console.error("P&L Snapshot fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
