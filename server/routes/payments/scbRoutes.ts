// PATCH O5 — SCB QR PAYMENT WEBHOOK
// PATCH O6 — SIGNATURE VERIFICATION
import { Router } from "express";
import { db } from "../../lib/prisma";
import { matchSCBPayment } from "../../services/scbPaymentMatcher";
import { verifySCBSignature } from "../../services/scbSignature";

const router = Router();

// SCB sends POST → /api/payments/scb/webhook
router.post("/webhook", async (req, res) => {
  try {
    if (!verifySCBSignature(req.headers, req.body)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const prisma = db();
    const body = req.body;

    // Extract SCB transaction fields
    const scbTxnId = body?.txnId || body?.transactionId;
    const amount = parseFloat(body?.amount || 0);
    const ref = body?.ref1 || body?.reference || null;

    // store raw log
    await prisma.scb_transactions_v1.create({
      data: {
        scbTxnId,
        amount,
        ref,
        webhookPayload: body,
      },
    });

    // attempt match
    if (ref) {
      await matchSCBPayment(ref, amount);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("SCB WEBHOOK ERROR:", err);
    res.status(500).json({ error: "SCB webhook failed" });
  }
});

export default router;
