// PATCH O6 — QR GENERATION ROUTE (USES SCB DYNAMIC QR BACKEND)
import { Router } from "express";
import { generateDynamicQR } from "../../services/scbDynamicQR";

const router = Router();

// GET /api/payments/qr/dynamic?amount=100&ref=00023
router.get("/dynamic", async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount as string);
    const ref = String(req.query.ref);

    const qr = await generateDynamicQR(amount, ref);
    res.json(qr);
  } catch (err) {
    console.error("QR generation error:", err);
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

export default router;
