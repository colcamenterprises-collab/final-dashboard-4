import { Router } from "express";

const router = Router();

// Loyverse is fully retired as a live dependency. Historical Loyverse data remains
// read-only elsewhere, but this legacy route must never contact the Loyverse API.
router.get("/shift-report", (_req, res) => {
  res.status(410).json({
    ok: false,
    disabled: true,
    source: "sbb_pos_core",
    liveSourceOfTruth: "sbb_pos_core",
    error: "Loyverse live shift reporting is retired. Use the SBB POS shift/reporting endpoints.",
  });
});

export default router;
