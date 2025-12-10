// PATCH O14 Chunk 5 — Unified Payment Processing Routes
import express from "express";
import { PaymentProviderService } from "../../services/payments/providerService";
import { processStripePayment } from "../../services/payments/stripeAdapter";
import { processScbPayment } from "../../services/payments/scbAdapter";
import { processCustomPayment } from "../../services/payments/customAdapter";
import type { PaymentGateway } from "@prisma/client";

const router = express.Router();

// POST /api/payments/process
router.post("/process", async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "1";
    const { amount, orderId, provider } = req.body;

    if (!amount || !orderId || !provider) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: amount, orderId, provider"
      });
    }

    const config = await PaymentProviderService.getActiveProvider(
      tenantId,
      provider as PaymentGateway
    );

    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Provider "${provider}" not configured or disabled`
      });
    }

    let result;

    switch (provider) {
      case "stripe":
        result = await processStripePayment(amount, orderId, config.credentials);
        break;
      case "scb":
        result = await processScbPayment(amount, orderId, config.credentials);
        break;
      case "cash":
        result = {
          status: "success",
          provider: "cash",
          amount,
          orderId,
          transactionId: `cash_${Date.now()}`
        };
        break;
      case "custom1":
      case "custom2":
        result = await processCustomPayment(amount, orderId, config.credentials);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown provider: ${provider}`
        });
    }

    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[PaymentProcess] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
