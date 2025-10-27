import { Router } from "express";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";

const router = Router();

router.post("/loyverse/sync", async (req, res) => {
  try {
    console.log("[loyverseV2] sync request - query:", req.query, "body:", req.body);
    const { from, to } = req.query as { from: string; to: string };
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: "from/to required (YYYY-MM-DD)", received: { query: req.query, body: req.body } });
    }

    const fromISO = DateTime.fromISO(from, { zone: "Asia/Bangkok" }).startOf("day").toISO();
    const toISO = DateTime.fromISO(to, { zone: "Asia/Bangkok" }).endOf("day").toISO();

    const result = await importReceiptsV2(fromISO!, toISO!);
    res.json({ ...result, fromISO, toISO });
  } catch (error: any) {
    console.error("[loyverseV2] sync failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
